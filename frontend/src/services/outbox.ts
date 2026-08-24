import type { Socket } from 'socket.io-client';
import { getSocket } from './socket';
import { useChatStore } from '../store/chatStore';
import {
  queueOutgoing,
  listPendingOutgoing,
  getOutgoing,
  removeOutgoing,
  markOutgoingSending,
  requeueAllSending,
  saveOfflineMessage,
} from '../utils/offlineDb';
import { encryptOutgoingText, noteMessageSent } from './e2ee';
import { playOutgoingPop } from '../utils/soundEffects';
import type { OutgoingEntry } from '../utils/offlineDb';
import type { ChatMessage } from '../types';

/** Shape mirrored from the ChatView 'send-message' emits. */
export interface OutgoingPayload {
  conversationId: string;
  /** Optional: pre-encrypted content. When omitted, the dispatcher encrypts
   * message.text under the conversation's current E2EE epoch key. */
  encryptedContent?: string;
  tempId: string;
  recipientId?: string;
  replyTo?: { sender: string; text: string };
  contentType?: ChatMessage['contentType'];
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  duration?: string;
  locationData?: ChatMessage['locationData'];
  contactData?: ChatMessage['contactData'];
  pollData?: ChatMessage['pollData'];
  eventData?: ChatMessage['eventData'];
}

const ACK_TIMEOUT_MS = 8_000;

/**
 * Entry point used by the UI. If we are online the message is emitted right
 * away (encrypted under the current E2EE epoch key); if not, the PLAINTEXT is
 * queued durably so the sync manager can RE-ENCRYPT it with fresh keys at
 * send time.
 */
export async function dispatchMessage(
  conversationId: string,
  message: ChatMessage,
  payload: OutgoingPayload
): Promise<void> {
  const socket = getSocket();

  if (socket?.connected) {
    const encryptedContent =
      payload.encryptedContent ?? (await encryptOutgoingText(conversationId, message.text, payload.recipientId));
    socket.emit('send-message', { ...payload, encryptedContent });
    noteMessageSent(conversationId, payload.recipientId);
    playOutgoingPop();
    void saveOfflineMessage(message);
    return;
  }

  console.info('[Outbox] Offline — queueing message', message.id);

  // Flip the optimistic bubble to "waiting" state in the UI.
  useChatStore.getState().updateDeliveryStatus(conversationId, message.id, 'pending_sync');

  const entry: OutgoingEntry = {
    tempId: message.id,
    conversationId,
    status: 'pending_sync',
    text: message.text,
    recipientId: payload.recipientId,
    replyTo: payload.replyTo,
    contentType: payload.contentType,
    mediaUrl: payload.mediaUrl,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    fileType: payload.fileType,
    duration: payload.duration,
    locationData: payload.locationData,
    contactData: payload.contactData,
    pollData: payload.pollData,
    eventData: payload.eventData,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await queueOutgoing(entry);
}

// ─── Ack tracking ──────────────────────────────────────────────────────────────

interface AckResult {
  ok: boolean;
  canonicalId?: string;
}

const pendingAcks = new Map<string, (result: AckResult) => void>();

/**
 * Called from socket.ts when the backend confirms persistence of a message.
 * Handles both in-flight waits and LATE acks (wait timed out but the server
 * actually got it) — late acks are removed from the queue so a reconnect can
 * never produce a duplicate send.
 */
export function handleSentAck(payload: { tempId?: string; id?: string }): void {
  const tempId = payload?.tempId;
  if (!tempId) return;

  const resolver = pendingAcks.get(tempId);
  if (resolver) {
    pendingAcks.delete(tempId);
    resolver({ ok: true, canonicalId: payload.id || tempId });
    return;
  }

  // Late ack: confirm + clean up without re-emitting.
  const state = useChatStore.getState();
  const conversationId = findConversationForMessage(tempId);
  void removeOutgoing(tempId);
  if (conversationId) {
    state.updateDeliveryStatus(conversationId, tempId, 'sent', payload.id || tempId);
  }
}

function findConversationForMessage(messageId: string): string | null {
  const messages = useChatStore.getState().messages;
  for (const [conversationId, msgs] of Object.entries(messages)) {
    if (msgs.some((m) => m.id === messageId)) {
      return conversationId;
    }
  }
  return null;
}

function waitForAck(tempId: string): Promise<AckResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAcks.delete(tempId);
      resolve({ ok: false });
    }, ACK_TIMEOUT_MS);

    pendingAcks.set(tempId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

// ─── Sync manager ─────────────────────────────────────────────────────────────

let isSyncing = false;

/**
 * Re-encrypts the queued plaintext with the recipient's CURRENT public key
 * (keys may have rotated while the device was offline), then emits and waits
 * for the server ack.
 */
async function sendQueuedEntry(entry: OutgoingEntry): Promise<boolean> {
  const socket = getSocket();
  if (!socket?.connected) return false;

  await markOutgoingSending(entry.tempId);

  // Re-encrypt under the CURRENT epoch key. If keys rotated (or were rotated
  // by the peer) while this device was offline, the fresh epoch key is used
  // here — old keys are never reused for new sends.
  let encryptedContent = await encryptOutgoingText(entry.conversationId, entry.text, entry.recipientId);

  const payload = {
    conversationId: entry.conversationId,
    encryptedContent,
    tempId: entry.tempId,
    recipientId: entry.recipientId,
    replyTo: entry.replyTo,
    contentType: entry.contentType,
    mediaUrl: entry.mediaUrl,
    fileName: entry.fileName,
    fileSize: entry.fileSize,
    fileType: entry.fileType,
    duration: entry.duration,
    locationData: entry.locationData,
    contactData: entry.contactData,
    pollData: entry.pollData,
    eventData: entry.eventData,
  };

  const ackPromise = waitForAck(entry.tempId);
  socket.emit('send-message', payload);
  const result = await ackPromise;

  if (result.ok) {
    await removeOutgoing(entry.tempId);
    useChatStore
      .getState()
      .updateDeliveryStatus(entry.conversationId, entry.tempId, 'sent', result.canonicalId);
    return true;
  }

  // Timed out or connection dropped mid-send — put it back for next reconnect.
  console.warn('[Outbox] Send attempt failed for', entry.tempId, '- requeued');
  await queueOutgoing({ ...entry, status: 'pending_sync' });
  useChatStore.getState().updateDeliveryStatus(entry.conversationId, entry.tempId, 'pending_sync');
  return false;
}

/**
 * Drains the persistent outgoing queue sequentially, oldest-first.
 * Triggered automatically on every socket (re)connect; safe to call anytime.
 */
export async function processOutbox(): Promise<void> {
  if (isSyncing) return;

  const socket = getSocket();
  if (!socket?.connected) return;

  isSyncing = true;
  try {
    // Crash recovery: items stuck mid-flight from a previous session go back
    // into the pending queue before we start draining.
    await requeueAllSending();

    // Sequential drain: one message at a time, stopping whenever the
    // connection drops. The while-loop picks up items queued DURING sync.
    for (;;) {
      if (!getSocket()?.connected) break;

      const entries = await listPendingOutgoing();
      if (entries.length === 0) break;

      const succeeded = await sendQueuedEntry(entries[0]);
      if (!succeeded) break;
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Attach the ack listener. Called once per socket connection from socket.ts.
 */
export function attachOutboxListeners(socket: Socket): void {
  socket.on('message-sent-ack', handleSentAck);
}

// Re-export for convenience so socket.ts has a single import surface.
export { getOutgoing };
