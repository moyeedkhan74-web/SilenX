import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import naclUtil from 'tweetnacl-util';
import { generateKeyPair, storePrivateKey, storePublicKey, getPrivateKey, getPublicKey, clearKeys, hasKeys, encryptMessage, decryptMessage, computeSharedSecret, storeSessionKey, getSessionKey, encryptWithSharedSecret, decryptWithSharedSecret, encryptSymmetricKeyForUser, generateSymmetricKey, type KeyPair, type EncryptedPayload } from '../utils/crypto';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../config/webrtc-config';
import { setPublicKeyUploadHandler } from '../services/socket';
import { apiFetch } from '../utils/apiFetch';

interface CryptoContextType {
  keyPair: KeyPair | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initializeKeys: () => Promise<void>;
  uploadPublicKey: (explicitPublicKey?: string) => Promise<boolean>;
  fetchPublicKey: (userId: string) => Promise<string | null>;
  encryptForUser: (plaintext: string, recipientUserId: string, recipientPublicKey?: string) => Promise<EncryptedPayload | null>;
  decryptFromUser: (encryptedPayload: EncryptedPayload, senderPublicKey: string) => Promise<string | null>;
  getSharedSecret: (userId: string, publicKey: string) => Uint8Array | null;
  encryptWithSharedSecret: (plaintext: string, conversationId: string, recipientPublicKey: string) => Promise<string | null>;
  decryptWithSharedSecret: (encryptedMessage: string, conversationId: string, senderPublicKey: string) => Promise<string | null>;
  // Group encryption
  createGroupKey: (groupId: string, memberIds: string[]) => Promise<{ symmetricKey: Uint8Array; encryptedKeys: Record<string, string> } | null>;
  encryptForGroup: (plaintext: string, groupId: string) => Promise<string | null>;
  decryptFromGroup: (encryptedMessage: string, groupId: string, senderId: string) => Promise<string | null>;
  hasValidKeys: () => boolean;
}

const CryptoContext = createContext<CryptoContextType | null>(null);

export const CryptoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuthStore();

  // Load existing keys from storage on mount
  useEffect(() => {
    const loadKeys = async () => {
      try {
        if (hasKeys()) {
          const privateKey = getPrivateKey();
          const publicKey = getPublicKey();
          if (privateKey && publicKey) {
            setKeyPair({
              privateKey: naclUtil.encodeBase64(privateKey),
              publicKey,
            });
          }
        }
      } catch (err) {
        console.warn('[CryptoContext] Key loading error:', err);
      } finally {
        setIsInitialized(true);
      }
    };
    loadKeys();
  }, []);

  // Generate or load keys when user logs in
  const initializeKeys = useCallback(async () => {
    if (!user) {
      clearKeys();
      setKeyPair(null);
      setIsInitialized(true);
      return;
    }

    // Skip redundant initialization if keyPair is already loaded in memory
    if (keyPair && isInitialized) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Upload with short exponential backoff — survives Render cold-start 5xx/429s
    const uploadWithRetry = async (pubKey?: string): Promise<boolean> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await uploadPublicKey(pubKey)) return true;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
      return false;
    };

    try {
      // Check if we already have keys in storage
      if (hasKeys()) {
        const privateKey = getPrivateKey();
        const publicKey = getPublicKey();
        if (privateKey && publicKey) {
          const loadedKeyPair = {
            privateKey: naclUtil.encodeBase64(privateKey),
            publicKey,
          };
          setKeyPair(loadedKeyPair);
          // Upload public key to server if not already there
          await uploadWithRetry(publicKey);
          setIsLoading(false);
          return;
        }
      }

      // Generate new key pair
      const newKeyPair = generateKeyPair();
      storePrivateKey(newKeyPair.privateKey);
      storePublicKey(newKeyPair.publicKey);
      setKeyPair(newKeyPair);

      // Upload to backend
      await uploadWithRetry(newKeyPair.publicKey);
    } catch (err) {
      console.error('[CryptoContext] Failed to initialize keys:', err);
      setError('Failed to initialize encryption keys');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Upload public key to backend.
  // IMPORTANT: resolves the key from explicit parameter, React state OR local storage
  const uploadPublicKey = useCallback(async (explicitPublicKey?: string): Promise<boolean> => {
    if (!token) return false;

    const publicKey =
      explicitPublicKey ||
      keyPair?.publicKey ||
      (() => {
        try {
          return localStorage.getItem('slienx_public_key');
        } catch {
          return null;
        }
      })();

    if (!publicKey) {
      console.error('[CryptoContext] No public key available to upload');
      return false;
    }

    try {
      // apiFetch transparently force-refreshes an expired Firebase token on 401
      const res = await apiFetch(`${API_URL}/api/users/public-key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey }),
      });

      if (!res.ok) {
        console.error('[CryptoContext] Failed to upload public key:', await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error('[CryptoContext] Error uploading public key:', err);
      return false;
    }
  }, [keyPair, token]);

  // Register the socket-level "re-upload your key" handler so a peer's
  // request-public-key event triggers our upload even outside login flow.
  useEffect(() => {
    setPublicKeyUploadHandler(() => uploadPublicKey());
    return () => setPublicKeyUploadHandler(null);
  }, [uploadPublicKey]);

  // Fetch a user's public key from backend
  const fetchPublicKey = useCallback(async (userId: string): Promise<string | null> => {
    try {
      // apiFetch transparently force-refreshes an expired Firebase token on 401
      const res = await apiFetch(`${API_URL}/api/users/${userId}/public-key`);

      if (!res.ok) return null;

      const data = await res.json();
      const publicKey: string | null = data?.publicKey || null;
      if (!publicKey) {
        // 200 but empty key → backend knows the user but has no key on file
        // (e.g. wiped by a server restart). Surface it instead of failing silently.
        console.warn(`[CryptoContext] Backend returned 200 but empty public key for ${userId} — peer key missing on server`);
        return null;
      }
      return publicKey;
    } catch (err) {
      console.error('[CryptoContext] Error fetching public key:', err);
      return null;
    }
  }, [token]);

  // Encrypt message for a specific user
  const encryptForUser = useCallback(async (
    plaintext: string,
    recipientUserId: string,
    recipientPublicKey?: string
  ): Promise<EncryptedPayload | null> => {
    if (!keyPair) return null;

    let pubKey = recipientPublicKey;
    if (!pubKey) {
      const fetched = await fetchPublicKey(recipientUserId);
      pubKey = fetched || undefined;
      if (!pubKey) return null;
    }

    const ciphertext = encryptMessage(plaintext, pubKey);
    if (!ciphertext) return null;

    return {
      ciphertext,
      nonce: '', // Nonce is embedded in ciphertext
      senderPublicKey: keyPair.publicKey,
    };
  }, [keyPair, fetchPublicKey]);

  // Decrypt message from a user
  const decryptFromUser = useCallback(async (
    encryptedPayload: EncryptedPayload,
    senderPublicKey: string
  ): Promise<string | null> => {
    if (!keyPair) return null;

    return decryptMessage(encryptedPayload.ciphertext, senderPublicKey);
  }, [keyPair]);

  // Get or compute shared secret for a conversation
  const getSharedSecret = useCallback((userId: string, publicKey: string): Uint8Array | null => {
    if (!keyPair) return null;

    // Check if we have a cached session key
    const cached = getSessionKey(userId);
    if (cached) return cached;

    // Compute new shared secret
    const sharedSecret = computeSharedSecret(publicKey);
    if (sharedSecret) {
      storeSessionKey(userId, sharedSecret);
    }
    return sharedSecret;
  }, [keyPair]);

  // Encrypt using shared secret (for multiple messages to same user)
  const encryptWithSharedSecretFn = useCallback(async (
    plaintext: string,
    conversationId: string,
    recipientPublicKey: string
  ): Promise<string | null> => {
    const sharedSecret = getSharedSecret(conversationId, recipientPublicKey);
    if (!sharedSecret) return null;

    return encryptWithSharedSecret(plaintext, sharedSecret);
  }, [getSharedSecret]);

  // Decrypt using shared secret
  const decryptWithSharedSecretFn = useCallback(async (
    encryptedMessage: string,
    conversationId: string,
    senderPublicKey: string
  ): Promise<string | null> => {
    const sharedSecret = getSharedSecret(conversationId, senderPublicKey);
    if (!sharedSecret) return null;

    return decryptWithSharedSecret(encryptedMessage, sharedSecret);
  }, [getSharedSecret]);

  // Group encryption: create symmetric key and encrypt for each member
  const createGroupKey = useCallback(async (
    _groupId: string,
    memberIds: string[]
  ): Promise<{ symmetricKey: Uint8Array; encryptedKeys: Record<string, string> } | null> => {
    if (!keyPair || !token) return null;

    const symmetricKey = generateSymmetricKey();
    const encryptedKeys: Record<string, string> = {};

    for (const memberId of memberIds) {
      if (memberId === user?.id) continue; // Skip self

      const pubKey = await fetchPublicKey(memberId);
      if (!pubKey) continue;

      const encrypted = encryptSymmetricKeyForUser(symmetricKey, pubKey);
      if (encrypted) {
        encryptedKeys[memberId] = encrypted;
      }
    }

    // Store our own copy of the symmetric key
    const ourEncrypted = encryptSymmetricKeyForUser(symmetricKey, keyPair.publicKey);
    if (ourEncrypted) {
      encryptedKeys[user?.id || 'self'] = ourEncrypted;
    }

    return { symmetricKey, encryptedKeys };
  }, [keyPair, token, user?.id, fetchPublicKey]);

  // Encrypt message for group using symmetric key
  const encryptForGroup = useCallback(async (
    plaintext: string,
    _groupId: string
  ): Promise<string | null> => {
    console.warn('[CryptoContext] Group encryption not fully implemented yet');
    return encryptMessage(plaintext, keyPair?.publicKey || '');
  }, [keyPair]);

  // Decrypt message from group
  const decryptFromGroup = useCallback(async (
    encryptedMessage: string,
    _groupId: string,
    senderId: string
  ): Promise<string | null> => {
    console.warn('[CryptoContext] Group decryption not fully implemented yet');
    return decryptMessage(encryptedMessage, senderId);
  }, []);

  const hasValidKeys = useCallback((): boolean => {
    return hasKeys() && keyPair !== null;
  }, [keyPair]);

  return (
    <CryptoContext.Provider value={{
      keyPair,
      isInitialized,
      isLoading,
      error,
      initializeKeys,
      uploadPublicKey,
      fetchPublicKey,
      encryptForUser,
      decryptFromUser,
      getSharedSecret,
      encryptWithSharedSecret: encryptWithSharedSecretFn,
      decryptWithSharedSecret: decryptWithSharedSecretFn,
      createGroupKey,
      encryptForGroup,
      decryptFromGroup,
      hasValidKeys,
    }}>
      {children}
    </CryptoContext.Provider>
  );
};

export const useCrypto = (): CryptoContextType => {
  const context = useContext(CryptoContext);
  if (!context) {
    throw new Error('useCrypto must be used within a CryptoProvider');
  }
  return context;
};