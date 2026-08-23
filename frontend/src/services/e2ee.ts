import {
  computeSharedSecret,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
  decryptMessage,
  generateKeyPair,
  safeDecodeBase64,
  deriveRotatedSecret,
  storeEpochSessionKey,
  getEpochSessionKey,
  listConversationEpochs,
  loadConversationMeta,
  saveConversationMeta,
} from '../utils/crypto';
import { API_URL } from '../config/webrtc-config';
import { getSocket, getPublicKey } from './socket';
import { useAuthStore } from '../store/authStore';
import nacl from 'tweetnacl';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Rotate ephemeral session secrets every 7 days… */
const ROTATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/** …or every 1,000 messages, whichever comes first. */
const ROTATION_MESSAGE_THRESHOLD = 1_000;
/** Ciphertext header identifying epoch-encrypted payloads. */
const CIPHER_HEADER = 'SLX2';
/** Bound the fallback chain when scanning historical epochs / keys. */
const MAX_FALLBACK_EPOCHS = 8;

interface RotateEventPayload {
  conversationId: string;
  epoch: number;
  ephemeralPublicKey?: string;
  senderId: string;
}

export function isGroupConversation(conversationId: string): boolean {
  return conversationId.startsWith('conv_group_');
}

// ─── Historical public-key cache (fallback decryption) ────────────────────────

interface PublicKeyHistoryEntry {
  version: number;
  publicKey: string;
  fingerprint?: string;
}

const publicKeyHistoryCache: Record<string, PublicKeyHistoryEntry[]> = {};

async function fetchPublicKeyHistory(userId: string): Promise<PublicKeyHistoryEntry[]> {
  if (publicKeyHistoryCache[userId]) return publicKeyHistoryCache[userId];
  try {
    const token = useAuthStore.getState().token;
    if (!token) return [];
    const res = await fetch(`${API_URL}/api/users/${userId}/public-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const keys: PublicKeyHistoryEntry[] = data.keys || [];
    publicKeyHistoryCache[userId] = keys;
    return keys;
  } catch (error) {
    console.warn('[E2EE] Failed to fetch public-key history:', error);
    return [];
  }
}

// ─── Epoch management ─────────────────────────────────────────────────────────

function isGroup(conversationId: string): boolean {
  return isGroupConversation(conversationId);
}

/**
 * Ensures an epoch-1 session key exists for the conversation, bootstrapped
 * from the authenticated identity-key ECDH with the recipient.
 */
async function ensureBootstrapEpoch(conversationId: string, peerId: string): Promise<void> {
  const meta = loadConversationMeta(conversationId);
  if (meta && getEpochSessionKey(conversationId, meta.epoch)) return;
  if (!peerId || isGroup(conversationId)) return;

  const peerPublicKey = await getPublicKey(peerId);
  if (!peerPublicKey) return;

  // Epoch 1 derives directly from the long-lived identity keys.
  let secret = getEpochSessionKey(conversationId, 1);
  if (!secret) {
    const derived = computeSharedSecret(peerPublicKey);
    if (!derived) return;
    secret = derived;
    storeEpochSessionKey(conversationId, 1, secret);
  }

  if (!loadConversationMeta(conversationId)) {
    saveConversationMeta(conversationId, {
      epoch: 1,
      createdAt: Date.now(),
      messagesSent: 0,
    });
  }
}

function rotationDue(meta: { epoch: number; createdAt: number; messagesSent: number }): boolean {
  const ageExceeded = Date.now() - meta.createdAt >= ROTATION_INTERVAL_MS;
  const countExceeded = meta.messagesSent >= ROTATION_MESSAGE_THRESHOLD;
  return ageExceeded || countExceeded;
}

// ─── Rotation handshake ───────────────────────────────────────────────────────

/**
 * Called after each successful send. Bumps the per-epoch message counter and
 * kicks off the rotation handshake when thresholds are crossed.
 */
export function noteMessageSent(conversationId: string, peerId?: string): void {
  if (isGroup(conversationId)) return;

  const meta = loadConversationMeta(conversationId);
  if (!meta) return;

  meta.messagesSent += 1;
  saveConversationMeta(conversationId, meta);

  if (!rotationDue(meta) || meta.pendingRatchetPrivateKey) return;

  const socket = getSocket();
  if (!socket?.connected || !peerId) return;

  // Initiator side of the double-ephemeral handshake.
  const ratchet = generateKeyPair();
  const nextEpoch = meta.epoch + 1;
  meta.pendingRatchetPublicKey = ratchet.publicKey;
  meta.pendingRatchetPrivateKey = ratchet.privateKey;
  meta.pendingEpoch = nextEpoch;
  saveConversationMeta(conversationId, meta);

  socket.emit('key:rotate-request', {
    conversationId,
    targetUserId: peerId,
    epoch: nextEpoch,
    ephemeralPublicKey: ratchet.publicKey,
  });
  console.info(`[E2EE] Rotation initiated for ${conversationId} -> epoch ${nextEpoch}`);
}

/**
 * Responder side: derive the new shared secret locally from
 *   (initiator ephemeral × responder ephemeral) ⊕ identity-authenticated ECDH
 * then acknowledge with our own ephemeral public key.
 */
export async function handleRotateRequest(payload: RotateEventPayload): Promise<void> {
  const { conversationId, epoch, ephemeralPublicKey, senderId } = payload || {};
  if (!conversationId || !ephemeralPublicKey || !senderId || isGroup(conversationId)) return;
  if (getEpochSessionKey(conversationId, epoch)) return; // already rotated

  try {
    const initiatorEphemeralPub = safeDecodeBase64(ephemeralPublicKey!);

    const responderRatchet = generateKeyPair();

    // Authenticated component: our identity private × their identity public.
    const senderIdentityPub = await getPublicKey(senderId);
    if (!senderIdentityPub) return;
    const authSecret = computeSharedSecret(senderIdentityPub);
    if (!authSecret) return;

    // Ephemeral-ephemeral component provides forward secrecy across epochs.
    const myEphemeralPriv = safeDecodeBase64(responderRatchet.privateKey);
    const eeSecret = deriveRotatedSecret(
      naclBefore(initiatorEphemeralPub, myEphemeralPriv),
      authSecret
    );
    if (!eeSecret) return;

    storeEpochSessionKey(conversationId, epoch, eeSecret);

    const meta = loadConversationMeta(conversationId);
    if (meta) {
      meta.epoch = Math.max(meta.epoch, epoch);
      meta.createdAt = Date.now();
      meta.messagesSent = 0;
      saveConversationMeta(conversationId, meta);
    }

    getSocket()?.emit('key:rotate-ack', {
      conversationId,
      targetUserId: senderId,
      epoch,
      ephemeralPublicKey: responderRatchet.publicKey,
    });
    console.info(`[E2EE] Rotation accepted for ${conversationId} -> epoch ${epoch}`);
  } catch (error) {
    console.error('[E2EE] handleRotateRequest failed:', error);
  }
}

/**
 * Initiator side completion: combine the responder's ephemeral key with our
 * pending ephemeral secret using the same derivation as the responder.
 */
export async function handleRotateAck(payload: RotateEventPayload): Promise<void> {
  const { conversationId, epoch, ephemeralPublicKey, senderId } = payload || {};
  if (!conversationId || !ephemeralPublicKey || !senderId || isGroup(conversationId)) return;

  const meta = loadConversationMeta(conversationId);
  if (!meta?.pendingRatchetPrivateKey || meta.pendingEpoch !== epoch) return;

  try {
    const responderEphemeralPub = safeDecodeBase64(ephemeralPublicKey!);
    const myPendingEphemeralPriv = safeDecodeBase64(meta.pendingRatchetPrivateKey);

    const senderIdentityPub = await getPublicKey(senderId);
    if (!senderIdentityPub) return;
    const authSecret = computeSharedSecret(senderIdentityPub);
    if (!authSecret) return;

    const eeSecret = deriveRotatedSecret(
      naclBefore(responderEphemeralPub, myPendingEphemeralPriv),
      authSecret
    );
    if (!eeSecret) return;

    storeEpochSessionKey(conversationId, epoch, eeSecret);

    meta.epoch = epoch;
    meta.createdAt = Date.now();
    meta.messagesSent = 0;
    delete meta.pendingRatchetPublicKey;
    delete meta.pendingRatchetPrivateKey;
    delete meta.pendingEpoch;
    saveConversationMeta(conversationId, meta);
    console.info(`[E2EE] Rotation completed for ${conversationId} -> epoch ${epoch}`);
  } catch (error) {
    console.error('[E2EE] handleRotateAck failed:', error);
  }
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/** Minimal nacl.box.before wrapper kept local to avoid leaking nacl imports. */
function naclBefore(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
  return nacl.box.before(theirPublicKey, mySecretKey);
}

/**
 * Encrypts outgoing message text under the CURRENT conversation epoch key.
 * Returns `SLX2.<epoch>.<ciphertext>` so receivers can select the exact key,
 * falling back gracefully when needed. Group conversations pass through
 * unchanged until group crypto ships.
 */
export async function encryptOutgoingText(
  conversationId: string,
  plaintext: string,
  peerId?: string
): Promise<string> {
  if (isGroup(conversationId)) return plaintext;

  try {
    await ensureBootstrapEpoch(conversationId, peerId || '');

    const meta = loadConversationMeta(conversationId);
    const epoch = meta?.epoch ?? 1;
    const sessionKey = getEpochSessionKey(conversationId, epoch);
    if (!sessionKey) {
      // No key material yet (e.g. recipient key unavailable) — passthrough,
      // matching the app's pre-existing behavior for unencrypted sends.
      return plaintext;
    }

    const ciphertext = encryptWithSymmetricKey(plaintext, sessionKey);
    if (!ciphertext) return plaintext;

    return `${CIPHER_HEADER}.${epoch}.${ciphertext}`;
  } catch (error) {
    console.error('[E2EE] Encryption failed, sending as-is:', error);
    return plaintext;
  }
}

/**
 * Unified incoming decryption with graceful fallbacks:
 *   1. Epoch-tagged payload -> exact epoch key, then newest->oldest cached epochs
 *   2. Legacy payload       -> sender's current identity key, then every cached
 *                              HISTORICAL public key version (fetched once)
 * Returns the plaintext, or null when nothing succeeds (caller shows
 * '[Encrypted Message]').
 */
export async function decryptIncoming(
  conversationId: string,
  encryptedContent: string,
  senderId: string
): Promise<string | null> {
  if (!encryptedContent) return null;

  // ── Epoch-tagged (v2) payload ──
  if (encryptedContent.startsWith(`${CIPHER_HEADER}.`)) {
    const parts = encryptedContent.split('.');
    const epoch = Number.parseInt(parts[1], 10);
    const ciphertextBody = parts.slice(2).join('.');

    if (!Number.isNaN(epoch)) {
      // Exact epoch first — this is almost always the one.
      const exactKey = getEpochSessionKey(conversationId, epoch);
      if (exactKey) {
        const plain = decryptWithSymmetricKey(ciphertextBody, exactKey);
        if (plain !== null) return plain;
      }

      // Fallback: scan cached historical epoch keys, newest -> oldest.
      // Covers messages sent by the peer before our own rotation completed,
      // or while this device was offline across a rotation boundary.
      const cachedEpochs = listConversationEpochs(conversationId)
        .slice(0, MAX_FALLBACK_EPOCHS)
        .filter((candidate) => candidate !== epoch);
      for (const candidate of cachedEpochs) {
        const key = getEpochSessionKey(conversationId, candidate);
        if (!key) continue;
        const plain = decryptWithSymmetricKey(ciphertextBody, key);
        if (plain !== null) return plain;
      }
    }
    return null;
  }

  // ── Legacy identity-box payload ──
  const currentKey = await getPublicKey(senderId);
  if (currentKey) {
    const plain = decryptMessage(encryptedContent, currentKey);
    if (plain !== null) return plain;
  }

  // Fallback: try every cached HISTORICAL public key version of the sender —
  // covers messages received just before the sender rotated their identity key.
  const history = await fetchPublicKeyHistory(senderId);
  for (const entry of history.slice(-MAX_FALLBACK_EPOCHS).reverse()) {
    if (entry.publicKey === currentKey) continue;
    const plain = decryptMessage(encryptedContent, entry.publicKey);
    if (plain !== null) return plain;
  }

  return null;
}
