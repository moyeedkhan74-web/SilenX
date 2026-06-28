import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { KeyManager } from './keyManager';

/**
 * Encrypts a plaintext message to a recipient using their public key and the current user's private key.
 * Uses TweetNaCl's box API (X25519 + xsalsa20-poly1305, a predecessor to chacha20, standard in NaCl).
 */
export function encryptMessage(plaintext: string, recipientPublicKeyBase64: string): string | null {
  try {
    const secretKey = KeyManager.getPrivateKey();
    if (!secretKey) throw new Error('No local private key found');

    const receiverPublicKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
    const messageUint8 = naclUtil.decodeUTF8(plaintext);
    
    // Generate random nonce (24 bytes)
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    // Encrypt the message
    const encryptedBox = nacl.box(messageUint8, nonce, receiverPublicKey, secretKey);

    // Combine nonce and ciphertext: [nonce (24 bytes) ... ciphertext]
    const fullMessage = new Uint8Array(nonce.length + encryptedBox.length);
    fullMessage.set(nonce);
    fullMessage.set(encryptedBox, nonce.length);

    // Return as Base64 encoded string
    return naclUtil.encodeBase64(fullMessage);
  } catch (error) {
    console.error('[Encryption] Failed to encrypt message', error);
    return null;
  }
}

/**
 * Decrypts a ciphertext message from a sender using their public key and the current user's private key.
 */
export function decryptMessage(encryptedMessageBase64: string, senderPublicKeyBase64: string): string | null {
  try {
    const secretKey = KeyManager.getPrivateKey();
    if (!secretKey) throw new Error('No local private key found');

    const senderPublicKey = naclUtil.decodeBase64(senderPublicKeyBase64);
    const fullMessage = naclUtil.decodeBase64(encryptedMessageBase64);

    // Extract the nonce (first 24 bytes)
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    // Extract the ciphertext
    const ciphertext = fullMessage.slice(nacl.box.nonceLength);

    // Decrypt the message
    const decryptedUint8 = nacl.box.open(ciphertext, nonce, senderPublicKey, secretKey);

    if (!decryptedUint8) {
      throw new Error('Message decryption failed (invalid key or tampered payload)');
    }

    return naclUtil.encodeUTF8(decryptedUint8);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt message', error);
    return null;
  }
}
