import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const PRIVATE_KEY_STORAGE = 'slienx_private_key';
const PUBLIC_KEY_STORAGE = 'slienx_public_key';
const SESSION_KEYS_PREFIX = 'slienx_session_keys_';
const E2EE_META_PREFIX = 'slienx_e2ee_meta_';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  senderPublicKey?: string;
}

export interface GroupKeyPackage {
  groupId: string;
  symmetricKey: string;
  encryptedKeys: Record<string, string>;
}

/**
 * Generates a new X25519 key pair for the user
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
  };
}

/**
 * Stores the private key in localStorage (in production, use IndexedDB with encryption)
 */
export function storePrivateKey(privateKey: string): void {
  localStorage.setItem(PRIVATE_KEY_STORAGE, privateKey);
}

/**
 * Retrieves the stored private key
 */
export function getPrivateKey(): Uint8Array | null {
  const b64Key = localStorage.getItem(PRIVATE_KEY_STORAGE);
  if (!b64Key) return null;
  return safeDecodeBase64(b64Key);
}

/**
 * Stores the public key in localStorage
 */
export function storePublicKey(publicKey: string): void {
  localStorage.setItem(PUBLIC_KEY_STORAGE, publicKey);
}

/**
 * Retrieves the stored public key
 */
export function getPublicKey(): string | null {
  return localStorage.getItem(PUBLIC_KEY_STORAGE);
}

/**
 * Clears stored keys on logout
 */
export function clearKeys(): void {
  localStorage.removeItem(PRIVATE_KEY_STORAGE);
  localStorage.removeItem(PUBLIC_KEY_STORAGE);
  // Clear session keys
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(SESSION_KEYS_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Decodes a Base64 string, automatically handling:
 * - URL-safe Base64 (`-`, `_` → `+`, `/`)
 * - Missing `=` padding
 * - Invalid characters
 */
export function safeDecodeBase64(b64: string): Uint8Array {
  // Replace URL-safe chars with standard Base64 chars
  let standard = b64.replace(/-/g, '+').replace(/_/g, '/');
  // Add missing padding
  while (standard.length % 4) {
    standard += '=';
  }
  return naclUtil.decodeBase64(standard);
}
export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.box.nonceLength);
}

/**
 * Encrypts a message for a recipient using their public key and our private key
 * Returns a combined payload with nonce + ciphertext
 */
export function encryptMessage(plaintext: string, recipientPublicKeyBase64: string): string | null {
  try {
    const secretKey = getPrivateKey();
    if (!secretKey) throw new Error('No local private key found');

    const recipientPublicKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
    const messageUint8 = naclUtil.decodeUTF8(plaintext);
    const nonce = generateNonce();

    const encryptedBox = nacl.box(messageUint8, nonce, recipientPublicKey, secretKey);

    const fullMessage = new Uint8Array(nonce.length + encryptedBox.length);
    fullMessage.set(nonce);
    fullMessage.set(encryptedBox, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  } catch (error) {
    console.error('[Crypto] Failed to encrypt message:', error);
    return null;
  }
}

/**
 * Decrypts a message from a sender using their public key and our private key
 */
export function decryptMessage(encryptedMessageBase64: string, senderPublicKeyBase64: string): string | null {
  try {
    const secretKey = getPrivateKey();
    if (!secretKey) throw new Error('No local private key found');

    const senderPublicKey = safeDecodeBase64(senderPublicKeyBase64);
    const fullMessage = safeDecodeBase64(encryptedMessageBase64);

    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const ciphertext = fullMessage.slice(nacl.box.nonceLength);

    const decryptedUint8 = nacl.box.open(ciphertext, nonce, senderPublicKey, secretKey);

    if (!decryptedUint8) {
      throw new Error('Message decryption failed (invalid key or tampered payload)');
    }

    return naclUtil.encodeUTF8(decryptedUint8);
  } catch (error) {
    console.error('[Crypto] Failed to decrypt message:', error);
    return null;
  }
}

/**
 * Pre-computes a shared secret for performance (reusable for multiple messages)
 */
export function computeSharedSecret(recipientPublicKeyBase64: string): Uint8Array | null {
  try {
    const secretKey = getPrivateKey();
    if (!secretKey) return null;

    const recipientPublicKey = safeDecodeBase64(recipientPublicKeyBase64);
    return nacl.box.before(recipientPublicKey, secretKey);
  } catch (error) {
    console.error('[Crypto] Failed to compute shared secret:', error);
    return null;
  }
}

/**
 * Encrypts using a pre-computed shared secret (faster for multiple messages)
 */
export function encryptWithSharedSecret(plaintext: string, sharedSecret: Uint8Array): string | null {
  try {
    const messageUint8 = naclUtil.decodeUTF8(plaintext);
    const nonce = generateNonce();
    const encryptedBox = nacl.box.after(messageUint8, nonce, sharedSecret);

    const fullMessage = new Uint8Array(nonce.length + encryptedBox.length);
    fullMessage.set(nonce);
    fullMessage.set(encryptedBox, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  } catch (error) {
    console.error('[Crypto] Failed to encrypt with shared secret:', error);
    return null;
  }
}

/**
 * Decrypts using a pre-computed shared secret
 */
export function decryptWithSharedSecret(encryptedMessageBase64: string, sharedSecret: Uint8Array): string | null {
  try {
    const fullMessage = safeDecodeBase64(encryptedMessageBase64);
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const ciphertext = fullMessage.slice(nacl.box.nonceLength);

    const decryptedUint8 = nacl.box.open.after(ciphertext, nonce, sharedSecret);

    if (!decryptedUint8) {
      throw new Error('Message decryption failed with shared secret');
    }

    return naclUtil.encodeUTF8(decryptedUint8);
  } catch (error) {
    console.error('[Crypto] Failed to decrypt with shared secret:', error);
    return null;
  }
}

/**
 * Generates a random symmetric key for group encryption
 */
export function generateSymmetricKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

/**
 * Encrypts a symmetric key for a specific user using their public key
 */
export function encryptSymmetricKeyForUser(symmetricKey: Uint8Array, recipientPublicKeyBase64: string): string | null {
  try {
    const secretKey = getPrivateKey();
    if (!secretKey) return null;

    const recipientPublicKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
    const nonce = generateNonce();

    const encryptedBox = nacl.box(symmetricKey, nonce, recipientPublicKey, secretKey);

    const fullMessage = new Uint8Array(nonce.length + encryptedBox.length);
    fullMessage.set(nonce);
    fullMessage.set(encryptedBox, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  } catch (error) {
    console.error('[Crypto] Failed to encrypt symmetric key:', error);
    return null;
  }
}

/**
 * Decrypts a symmetric key from a sender
 */
export function decryptSymmetricKey(encryptedKeyBase64: string, senderPublicKeyBase64: string): Uint8Array | null {
  try {
    const secretKey = getPrivateKey();
    if (!secretKey) return null;

    const senderPublicKey = safeDecodeBase64(senderPublicKeyBase64);
    const fullMessage = safeDecodeBase64(encryptedKeyBase64);

    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const ciphertext = fullMessage.slice(nacl.box.nonceLength);

    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, secretKey);
    return decrypted;
  } catch (error) {
    console.error('[Crypto] Failed to decrypt symmetric key:', error);
    return null;
  }
}

/**
 * Encrypts data with a symmetric key (for group messages)
 */
export function encryptWithSymmetricKey(plaintext: string, symmetricKey: Uint8Array): string | null {
  try {
    const messageUint8 = naclUtil.decodeUTF8(plaintext);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encryptedBox = nacl.secretbox(messageUint8, nonce, symmetricKey);

    const fullMessage = new Uint8Array(nonce.length + encryptedBox.length);
    fullMessage.set(nonce);
    fullMessage.set(encryptedBox, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  } catch (error) {
    console.error('[Crypto] Failed to encrypt with symmetric key:', error);
    return null;
  }
}

/**
 * Decrypts data with a symmetric key (for group messages)
 */
export function decryptWithSymmetricKey(encryptedMessageBase64: string, symmetricKey: Uint8Array): string | null {
  try {
    const fullMessage = naclUtil.decodeBase64(encryptedMessageBase64);
    const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = fullMessage.slice(nacl.secretbox.nonceLength);

    const decrypted = nacl.secretbox.open(ciphertext, nonce, symmetricKey);

    if (!decrypted) {
      throw new Error('Symmetric decryption failed');
    }

    return naclUtil.encodeUTF8(decrypted);
  } catch (error) {
    // Debug log instead of error so candidate-key scanning fallback doesn't clutter devtools
    console.debug('[Crypto] Decryption candidate attempt skipped:', error);
    return null;
  }
}

/**
 * Stores a session key for a conversation/group
 */
export function storeSessionKey(conversationId: string, sharedSecret: Uint8Array): void {
  const key = SESSION_KEYS_PREFIX + conversationId;
  localStorage.setItem(key, naclUtil.encodeBase64(sharedSecret));
}

/**
 * Retrieves a stored session key
 */
export function getSessionKey(conversationId: string): Uint8Array | null {
  const key = SESSION_KEYS_PREFIX + conversationId;
  const b64Key = localStorage.getItem(key);
  if (!b64Key) return null;
  return safeDecodeBase64(b64Key);
}

/**
 * Removes a session key
 */
export function removeSessionKey(conversationId: string): void {
  const key = SESSION_KEYS_PREFIX + conversationId;
  localStorage.removeItem(key);
}

/**
 * Checks if user has keys set up
 */
export function hasKeys(): boolean {
  return !!getPrivateKey() && !!getPublicKey();
}

// ─── Key rotation (epoch) support ─────────────────────────────────────────────

/**
 * SHA-256 fingerprint of a public key (hex, first 32 chars). Lets peers
 * verify which key version encrypted a message without transmitting secrets.
 */
export async function fingerprintPublicKey(publicKeyBase64: string): Promise<string> {
  const raw = naclUtil.decodeBase64(publicKeyBase64);
  const bytes = new Uint8Array(raw.byteLength);
  bytes.set(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/**
 * Derives a new epoch shared secret from an ephemeral-ephemeral ECDH secret
 * and the long-lived identity-authenticated ECDH secret:
 *   K_new = SHA-512(ee || auth)[0..32]
 *
 * Mixing in the identity secret authenticates the handshake (defeats MITM),
 * while the ephemeral component provides forward secrecy across epochs.
 * Old secrets are never transmitted or derivable from the new one.
 */
export function deriveRotatedSecret(ephemeralSecret: Uint8Array, authSecret: Uint8Array): Uint8Array | null {
  try {
    const combined = new Uint8Array(ephemeralSecret.length + authSecret.length);
    combined.set(ephemeralSecret, 0);
    combined.set(authSecret, ephemeralSecret.length);
    const hash = nacl.hash(combined);
    return hash.slice(0, nacl.secretbox.keyLength);
  } catch (error) {
    console.error('[Crypto] Failed to derive rotated secret:', error);
    return null;
  }
}

/** Storage key for a specific conversation epoch's session key. */
function epochKeyStorageId(conversationId: string, epoch: number): string {
  return `${SESSION_KEYS_PREFIX}${conversationId}#v${epoch}`;
}

export function storeEpochSessionKey(conversationId: string, epoch: number, secret: Uint8Array): void {
  localStorage.setItem(epochKeyStorageId(conversationId, epoch), naclUtil.encodeBase64(secret));
}

export function getEpochSessionKey(conversationId: string, epoch: number): Uint8Array | null {
  const raw = localStorage.getItem(epochKeyStorageId(conversationId, epoch));
  return raw ? safeDecodeBase64(raw) : null;
}

/** All cached epoch numbers for a conversation, newest first. */
export function listConversationEpochs(conversationId: string): number[] {
  const prefix = `${SESSION_KEYS_PREFIX}${conversationId}#v`;
  const epochs: number[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const epoch = parseInt(key.slice(prefix.length), 10);
      if (!Number.isNaN(epoch)) epochs.push(epoch);
    }
  }
  return epochs.sort((a, b) => b - a);
}

/** Per-conversation rotation bookkeeping persisted locally. */
export interface ConversationE2eeMeta {
  epoch: number;
  /** Epoch start timestamp (ms). */
  createdAt: number;
  /** Messages sent within this epoch. */
  messagesSent: number;
  /** Pending outgoing ephemeral keypair (base64) awaiting a rotate-ack. */
  pendingRatchetPublicKey?: string;
  pendingRatchetPrivateKey?: string;
  pendingEpoch?: number;
}

export function loadConversationMeta(conversationId: string): ConversationE2eeMeta | null {
  try {
    const raw = localStorage.getItem(E2EE_META_PREFIX + conversationId);
    return raw ? (JSON.parse(raw) as ConversationE2eeMeta) : null;
  } catch {
    return null;
  }
}

export function saveConversationMeta(conversationId: string, meta: ConversationE2eeMeta): void {
  localStorage.setItem(E2EE_META_PREFIX + conversationId, JSON.stringify(meta));
}

/**
 * Exports keys for backup
 */
export function exportKeys(): { privateKey: string; publicKey: string } | null {
  const privateKey = getPrivateKey();
  const publicKey = getPublicKey();
  if (!privateKey || !publicKey) return null;
  return {
    privateKey: naclUtil.encodeBase64(privateKey),
    publicKey,
  };
}

/**
 * Imports keys from backup
 */
export function importKeys(data: { privateKey: string; publicKey: string }): void {
  storePrivateKey(data.privateKey);
  storePublicKey(data.publicKey);
}