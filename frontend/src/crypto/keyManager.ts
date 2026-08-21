import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const STORAGE_KEY = 'slienx_private_key';

export class KeyManager {
  /**
   * Generates a new X25519 key pair for the user and stores the private key locally.
   * Returns the base64 encoded public key to be sent to the backend.
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const keyPair = nacl.box.keyPair();
    const publicKey = naclUtil.encodeBase64(keyPair.publicKey);
    const privateKey = naclUtil.encodeBase64(keyPair.secretKey);

    // Store private key securely in local storage (or IndexedDB for more security)
    localStorage.setItem(STORAGE_KEY, privateKey);

    return { publicKey, privateKey };
  }

  /**
   * Retrieves the locally stored private key for decryption.
   */
  static getPrivateKey(): Uint8Array | null {
    const b64Key = localStorage.getItem(STORAGE_KEY);
    if (!b64Key) return null;
    // Use the safe decode function from frontend utils
    // Fall back to original for backward compatibility
    try {
      return naclUtil.decodeBase64(b64Key);
    } catch {
      // If decode fails, return null
      return null;
    }
  }

  /**
   * Clears the stored private key on logout.
   */
  static clearPrivateKey(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
