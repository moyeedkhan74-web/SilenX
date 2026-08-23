import { describe, it, expect, vi, beforeAll } from 'vitest';
import { decryptIncoming } from '../services/e2ee';
import {
  computeSharedSecret,
  encryptWithSymmetricKey,
  encryptMessage,
  storeEpochSessionKey,
} from '../utils/crypto';

// ─── Environment shims (must exist before crypto utils are exercised) ─────────

const localStorageStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => void localStorageStore.set(key, String(value)),
  removeItem: (key: string) => void localStorageStore.delete(key),
  key: (index: number) => Array.from(localStorageStore.keys())[index] ?? null,
  get length() {
    return localStorageStore.size;
  },
} as Storage;

// ─── Test identities ──────────────────────────────────────────────────────────

const ALICE_ID = 'alice-user';
const SELF: { keys?: { privateKey: string; publicKey: string } } = {};
const ALICE: { keys?: { privateKey: string; publicKey: string } } = {};
/** Mutable: lets individual tests simulate the sender having rotated keys. */
let senderCurrentPublicKey = '';

function selfKeys() {
  return SELF.keys!;
}
function aliceKeys() {
  return ALICE.keys!;
}

// ─── Module mocks (hoisted by vitest above static imports) ────────────────────

vi.mock('../services/socket', () => ({
  getSocket: () => null,
  clearPublicKeyCache: () => undefined,
  getPublicKey: vi.fn(async () => senderCurrentPublicKey || null),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: { getState: () => ({ token: 'test-token' }) },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeAll(async () => {
  const { generateKeyPair, storePrivateKey, storePublicKey } = await import('../utils/crypto');
  SELF.keys = generateKeyPair();
  ALICE.keys = generateKeyPair();
  // Our device holds its own key pair; incoming messages were boxed to our
  // public key by the sender.
  storePrivateKey(SELF.keys.privateKey);
  storePublicKey(SELF.keys.publicKey);
  senderCurrentPublicKey = ALICE.keys.publicKey;

  fetchMock.mockImplementation(async (url: string | URL) => {
    if (String(url).includes('/public-keys')) {
      return new Response(
        JSON.stringify({ userId: ALICE_ID, keys: [{ version: 1, publicKey: aliceKeys().publicKey }] }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  });
});

describe('e2ee.decryptIncoming fallback chain', () => {
  it('lazily bootstraps Epoch 1 from the sender public key on first message', async () => {
    const sharedSecret = computeSharedSecret(aliceKeys().publicKey);
    expect(sharedSecret).toBeTruthy();
    const ciphertext = encryptWithSymmetricKey('hello e2ee', sharedSecret!);

    // Fresh conversation: no meta, no stored epochs -> bootstrap must kick in.
    const plain = await decryptIncoming('conv-bootstrap', `SLX2.1.${ciphertext}`, ALICE_ID);
    expect(plain).toBe('hello e2ee');

    // Second message now uses the cached key directly.
    const second = await decryptIncoming(
      'conv-bootstrap',
      `SLX2.1.${encryptWithSymmetricKey('second msg', sharedSecret!)}`,
      ALICE_ID
    );
    expect(second).toBe('second msg');
  });

  it('falls back to other stored epoch keys when the tagged epoch is missing', async () => {
    const conv = 'conv-epoch-scan';
    const rotatedSecret = computeSharedSecret(aliceKeys().publicKey)!;
    // Key exists under epoch 2 but the header claims epoch 9 (rotation race).
    storeEpochSessionKey(conv, 2, rotatedSecret);
    const payload = `SLX2.9.${encryptWithSymmetricKey('raced message', rotatedSecret)}`;

    const plain = await decryptIncoming(conv, payload, ALICE_ID);
    expect(plain).toBe('raced message');
  });

  it('decrypts legacy identity-box payloads with the sender current key', async () => {
    // Box built against OUR public key (what a sender would do); opening it
    // requires the sender's public key + our private key.
    const ciphertext = encryptMessage('legacy hello', selfKeys().publicKey);
    const plain = await decryptIncoming('conv-legacy', ciphertext!, ALICE_ID);
    expect(plain).toBe('legacy hello');
  });

  it('falls back to historical public keys when the current key cannot open the box', async () => {
    // Sender rotated: their CURRENT key differs from the one used to encrypt.
    const { generateKeyPair } = await import('../utils/crypto');
    const rotated = generateKeyPair();
    senderCurrentPublicKey = rotated.publicKey;

    const ciphertext = encryptMessage('old-key message', selfKeys().publicKey);
    const plain = await decryptIncoming('conv-history', ciphertext!, ALICE_ID);
    expect(plain).toBe('old-key message'); // recovered via /public-keys history

    senderCurrentPublicKey = aliceKeys().publicKey; // restore for later tests
    expect(fetchMock).toHaveBeenCalled();
  });

  it('treats non-ciphertext content as plaintext passthrough', async () => {
    const sentence = 'Hello there, friend! How are you today?';
    expect(await decryptIncoming('conv-plain', sentence, ALICE_ID)).toBe(sentence);

    // Short base64-ish strings are far below the minimum box size.
    expect(await decryptIncoming('conv-plain', 'abc', ALICE_ID)).toBe('abc');
  });

  it('returns null for structured ciphertext that no key can open', async () => {
    const { randomBytes } = await import('tweetnacl');
    const util = await import('tweetnacl-util');
    const gibberish = util.encodeBase64(randomBytes(96)); // valid base64, >= 72 bytes

    const plain = await decryptIncoming('conv-gibberish', gibberish, ALICE_ID);
    expect(plain).toBeNull();
  });

  it('returns null for malformed SLX2 headers instead of leaking the payload', async () => {
    const plain = await decryptIncoming('conv-malformed', 'SLX2.banana.not-a-real-body', ALICE_ID);
    expect(plain).toBeNull();
  });

  it('handles empty payloads safely', async () => {
    expect(await decryptIncoming('conv-empty', '', ALICE_ID)).toBeNull();
  });
});
