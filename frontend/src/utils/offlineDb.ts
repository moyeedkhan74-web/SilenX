import { openDB, IDBPDatabase } from 'idb';
import type { ChatMessage, Conversation } from '../types';

const DB_NAME = 'silenx_offline_db';
const DB_VERSION = 2;

export interface StoredDraft {
  conversationId: string;
  text: string;
  updatedAt: string;
}

/**
 * A message waiting in the persistent outgoing queue.
 * The payload shape mirrors the socket 'send-message' emit payload; `text`
 * keeps the plaintext so it can be RE-ENCRYPTED with a fresh recipient key
 * at sync time (keys may have rotated while offline).
 */
export interface OutgoingEntry {
  tempId: string;
  conversationId: string;
  status: 'pending_sync' | 'sending';
  text: string;
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
  createdAt: string;
  attempts: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'conversationId' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'tempId' });
          outbox.createIndex('status', 'status', { unique: false });
          outbox.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' });
          // Touch the transaction so upgrade completes atomically with all stores.
          void transaction;
        }
      },
    });
  }
  return dbPromise;
}

// ─── Cached chat history ───────────────────────────────────────────────────────

export async function saveOfflineMessage(message: ChatMessage): Promise<void> {
  try {
    const db = await getDb();
    await db.put('messages', message);
  } catch (error) {
    console.error('[OfflineDb] Error saving message:', error);
  }
}

export async function saveOfflineMessages(messages: ChatMessage[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('messages', 'readwrite');
    await Promise.all(messages.map(msg => tx.store.put(msg)));
    await tx.done;
  } catch (error) {
    console.error('[OfflineDb] Error batch saving messages:', error);
  }
}

export async function getOfflineMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const db = await getDb();
    return await db.getAllFromIndex('messages', 'conversationId', conversationId);
  } catch (error) {
    console.error('[OfflineDb] Error fetching messages:', error);
    return [];
  }
}

export async function getAllOfflineMessages(): Promise<ChatMessage[]> {
  try {
    const db = await getDb();
    return await db.getAll('messages');
  } catch (error) {
    console.error('[OfflineDb] Error fetching all messages:', error);
    return [];
  }
}

export async function deleteOfflineMessage(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('messages', id);
  } catch (error) {
    console.error('[OfflineDb] Error deleting message:', error);
  }
}

// ─── Cached conversations / contacts ──────────────────────────────────────────

export async function saveConversationsCache(conversations: Conversation[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('conversations', 'readwrite');
    await Promise.all(conversations.map((c) => tx.store.put(c)));
    await tx.done;
  } catch (error) {
    console.error('[OfflineDb] Error caching conversations:', error);
  }
}

export async function getConversationsCache(): Promise<Conversation[]> {
  try {
    const db = await getDb();
    return await db.getAll('conversations');
  } catch (error) {
    console.error('[OfflineDb] Error reading conversations cache:', error);
    return [];
  }
}

export async function deleteConversationCache(conversationId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(['conversations', 'messages'], 'readwrite');
    tx.objectStore('conversations').delete(conversationId);
    const msgs = await tx.objectStore('messages').index('conversationId').getAllKeys(conversationId);
    await Promise.all(msgs.map((id) => tx.objectStore('messages').delete(id)));
    await tx.done;
  } catch (error) {
    console.error('[OfflineDb] Error deleting conversation cache:', error);
  }
}

// ─── Persistent outgoing queue ────────────────────────────────────────────────

export async function queueOutgoing(entry: OutgoingEntry): Promise<void> {
  try {
    const db = await getDb();
    await db.put('outbox', entry);
  } catch (error) {
    console.error('[OfflineDb] Error queueing outgoing message:', error);
  }
}

/** All queued messages oldest-first — the sync order. */
export async function listPendingOutgoing(): Promise<OutgoingEntry[]> {
  try {
    const db = await getDb();
    const entries = await db.getAllFromIndex('outbox', 'status', 'pending_sync');
    return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    console.error('[OfflineDb] Error listing pending outgoing:', error);
    return [];
  }
}

export async function getOutgoing(tempId: string): Promise<OutgoingEntry | undefined> {
  try {
    const db = await getDb();
    return await db.get('outbox', tempId);
  } catch (error) {
    console.error('[OfflineDb] Error getting outgoing entry:', error);
    return undefined;
  }
}

export async function removeOutgoing(tempId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('outbox', tempId);
  } catch (error) {
    console.error('[OfflineDb] Error removing outgoing entry:', error);
  }
}

export async function markOutgoingSending(tempId: string): Promise<void> {
  try {
    const db = await getDb();
    const entry = await db.get('outbox', tempId);
    if (entry) {
      entry.status = 'sending';
      entry.attempts = (entry.attempts || 0) + 1;
      await db.put('outbox', entry);
    }
  } catch (error) {
    console.error('[OfflineDb] Error marking outgoing sending:', error);
  }
}

/** Re-queue an in-flight item after a failed attempt (crash recovery). */
export async function requeueAllSending(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('outbox', 'readwrite');
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.value.status === 'sending') {
        cursor.value.status = 'pending_sync';
        await cursor.update(cursor.value);
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (error) {
    console.error('[OfflineDb] Error requeuing sending entries:', error);
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDb();
    return await db.countFromIndex('outbox', 'status', 'pending_sync');
  } catch (error) {
    console.error('[OfflineDb] Error counting pending:', error);
    return 0;
  }
}

// ─── Drafts ───────────────────────────────────────────────────────────────────

export async function saveDraft(conversationId: string, text: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('drafts', {
      conversationId,
      text,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OfflineDb] Error saving draft:', error);
  }
}

export async function getDraft(conversationId: string): Promise<string> {
  try {
    const db = await getDb();
    const draft = await db.get('drafts', conversationId);
    return draft ? draft.text : '';
  } catch (error) {
    console.error('[OfflineDb] Error getting draft:', error);
    return '';
  }
}

export async function clearDraft(conversationId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('drafts', conversationId);
  } catch (error) {
    console.error('[OfflineDb] Error clearing draft:', error);
  }
}
