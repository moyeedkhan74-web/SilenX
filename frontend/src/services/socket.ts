import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { auth } from '../config/firebase';
import type { ChatMessage } from '../types';
import { API_URL } from '../config/webrtc-config';
import { processOutbox, attachOutboxListeners } from './outbox';
import { apiFetch } from '../utils/apiFetch';
import { setSocketTokenUpdater } from '../utils/tokenSync';
import {
  decryptIncoming,
  handleRotateRequest,
  handleRotateAck,
} from './e2ee';
import { playIncomingChime } from '../utils/soundEffects';

// Public key cache to avoid fetching on every message.
// L1: memory; L2: localStorage (`slx_pubkey_<id>`) so keys survive reloads and
// history decryption works immediately after app start.
const publicKeyCache: Record<string, string> = {};
const PUBKEY_LS_PREFIX = 'slx_pubkey_';

function readCachedPublicKey(userId: string): string | null {
  if (publicKeyCache[userId]) return publicKeyCache[userId];
  try {
    const stored = localStorage.getItem(PUBKEY_LS_PREFIX + userId);
    if (stored) {
      publicKeyCache[userId] = stored;
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

function writeCachedPublicKey(userId: string, publicKey: string): void {
  publicKeyCache[userId] = publicKey;
  try {
    localStorage.setItem(PUBKEY_LS_PREFIX + userId, publicKey);
  } catch {
    // quota / privacy mode — memory cache still applies
  }
}

/** Drop a cached recipient key so the next fetch gets a fresh one (key rotation). */
export const clearPublicKeyCache = (userId: string): void => {
  delete publicKeyCache[userId];
  try {
    localStorage.removeItem(PUBKEY_LS_PREFIX + userId);
  } catch {
    // ignore
  }
};

// Negative cache: IDs that definitively have no public key. Cleared each time
// the socket reconnects so new key uploads are picked up automatically.
const noKeyCache = new Set<string>();

// Known non-user virtual sender IDs that will never have a public key
const VIRTUAL_SENDER_IDS = new Set(['system', 'bot', 'server', 'admin', '']);

const fetchPublicKeyFromApi = async (userId: string): Promise<{ publicKey: string | null; isNotFound: boolean }> => {
  try {
    // apiFetch transparently force-refreshes an expired Firebase token on 401
    const res = await apiFetch(`${API_URL}/api/users/${userId}/public-key`);
    if (res.status === 404) {
      return { publicKey: null, isNotFound: true };
    }
    if (!res.ok) {
      console.warn(`[Socket] Public key fetch for ${userId} failed — HTTP ${res.status}`);
      return { publicKey: null, isNotFound: false };
    }
    const data = await res.json();
    return { publicKey: data.publicKey || null, isNotFound: !data.publicKey };
  } catch (err) {
    console.warn(`[Socket] Network error fetching public key for ${userId}:`, err);
    return { publicKey: null, isNotFound: false };
  }
};

/** Shared PUT /api/users/public-key uploader (token-refresh safe via apiFetch). */
const uploadPublicKeyToApi = async (publicKey: string): Promise<boolean> => {
  const res = await apiFetch(`${API_URL}/api/users/public-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey }),
  });
  return res.ok;
};

export const clearNegativeKeyCache = (): void => {
  noKeyCache.clear();
};

// ─── Peer public-key recovery handshake ──────────────────────────────────────
// When a peer's key is missing server-side (Render restart before Mongo sync),
// we ask the PEER over the socket to re-upload theirs. CryptoContext registers
// a handler that performs the actual upload when the server relays the ask.
type PublicKeyUploadHandler = () => boolean | Promise<boolean> | void | Promise<void>;
let publicKeyUploadHandler: PublicKeyUploadHandler | null = null;

export const setPublicKeyUploadHandler = (handler: PublicKeyUploadHandler | null): void => {
  publicKeyUploadHandler = handler;
};

// Debounce per-peer so a burst of failed decryptions emits at most one request
const pendingKeyRequests = new Set<string>();

const requestPeerPublicKeyUpload = (userId: string): void => {
  if (!socket?.connected || pendingKeyRequests.has(userId)) return;
  pendingKeyRequests.add(userId);
  console.info(`[Socket] Asking peer ${userId} to re-upload their public key`);
  socket.emit('request-public-key', { targetUserId: userId });
  // Give the peer a moment to re-upload, then silently re-fetch so queued
  // history decrypts without needing an app restart.
  setTimeout(() => {
    void (async () => {
      try {
        const retried = await fetchPublicKeyFromApi(userId);
        if (retried.publicKey) {
          console.info(`[Socket] Recovered public key for ${userId} after peer re-upload`);
          noKeyCache.delete(userId);
          writeCachedPublicKey(userId, retried.publicKey);
          void useChatStore.getState().redecryptMessages();
        }
      } catch {
        // next getPublicKey() call will retry through the normal path
      }
    })();
  }, 6_000);
  // Allow a fresh request after 30s in case the peer was offline this time.
  setTimeout(() => pendingKeyRequests.delete(userId), 30_000);
};

export const getPublicKey = async (userId: string): Promise<string | null> => {
  // Immediately bail on virtual / system senders — they never have public keys
  if (!userId || VIRTUAL_SENDER_IDS.has(userId)) return null;

  // Check positive caches first
  const cached = readCachedPublicKey(userId);
  if (cached) return cached;

  // Check negative cache — don't hammer the server for IDs we know are keyless
  if (noKeyCache.has(userId)) return null;

  try {
    let result = await fetchPublicKeyFromApi(userId);
    let publicKey = result.publicKey;

    // Auto-heal: If this is the current user and local storage has a key, sync to server
    const currentUserId = useAuthStore.getState().user?.id;
    if (!publicKey && userId === currentUserId) {
      const localKey = localStorage.getItem('slienx_public_key');
      if (localKey) {
        console.info(`[Socket] Syncing local public key to server for ${userId}`);
        if (await uploadPublicKeyToApi(localKey)) {
          publicKey = localKey;
        }
      }
    }

    // Retry once on empty/failed responses before deciding whether to cache negative result
    if (!publicKey && !result.isNotFound) {
      console.warn(`[Socket] Retrying public key fetch for ${userId} after initial failure/cold-start`);
      result = await fetchPublicKeyFromApi(userId);
      publicKey = result.publicKey;
    }

    if (publicKey) {
      writeCachedPublicKey(userId, publicKey);
      return publicKey;
    }

    // ONLY populate negative cache if the server definitively confirmed 404/no key.
    // Network errors/cold-starts (isNotFound: false) must NOT pollute negative cache.
    if (result.isNotFound) {
      noKeyCache.add(userId);
      console.warn(`[Socket] No public key registered for ${userId} (404)`);
    }

    // Last resort: ask the peer (over the live socket) to re-upload their key
    requestPeerPublicKeyUpload(userId);
  } catch (error) {
    console.error('[Socket] Failed to fetch public key:', error);
  }
  return null;
};


let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let networkRecoveryListenerAttached = false;

const ensureNetworkRecoveryListener = () => {
  if (networkRecoveryListenerAttached || typeof window === 'undefined') {
    return;
  }

  const handleOnline = () => {
    console.log('[Socket] Network restored, attempting reconnection...');
    if (socket && !socket.connected) {
      socket.connect();
    }
  };

  window.addEventListener('online', handleOnline);
  networkRecoveryListenerAttached = true;

  const cleanup = () => {
    window.removeEventListener('online', handleOnline);
    networkRecoveryListenerAttached = false;
  };

  if (socket) {
    (socket as Socket & { __cleanupNetworkListener?: () => void }).__cleanupNetworkListener = cleanup;
  }
};

export const shouldReconnectSocket = (socketInstance: Pick<Socket, 'connected' | 'disconnected'> | null): boolean => {
  return !!socketInstance && socketInstance.disconnected;
};

const HEARTBEAT_INTERVAL_MS = 20_000; // 20 seconds

/**
 * Connect (or reconnect) the Socket.io client.
 * Automatically retrieves the Firebase ID token from the useAuthStore
 * if not provided as an argument. If socket is already connected and
 * the token matches, it returns the existing socket without reconnecting.
 */
export const connectSocket = (idToken?: string): Socket => {
  const token = idToken || useAuthStore.getState().token;

  if (socket) {
    const currentToken = socket.auth && typeof socket.auth === 'object'
      ? (socket.auth as any).token
      : null;

    if (!token || currentToken === token) {
      if (shouldReconnectSocket(socket)) {
        console.info('[Socket] Reconnecting existing socket');
        socket.connect();
      }
      return socket;
    }

    // Token changed, disconnect the old one
    socket.disconnect();
    socket = null;
  }

  if (!token) {
    // If no token is loaded yet, return a disconnected socket instance for safety
    console.warn('[Socket] No Firebase ID token available; creating disconnected socket.');
    return io(SOCKET_URL || '', { autoConnect: false });
  }

  ensureNetworkRecoveryListener();

  const options = {
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'] as Array<'websocket' | 'polling'>,
    // Pass the Firebase ID token in the handshake auth object
    auth: { token },
  };

  socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);

  // Offline-first: listen for server acks and drain the persistent outbox
  attachOutboxListeners(socket);

  socket.on('connect', () => {
    console.log(`[Socket] Connected: ${socket?.id}`);
    // Clear the negative key cache on every (re)connect so keys uploaded while
    // offline or after a server restart are picked up immediately.
    clearNegativeKeyCache();
    // Drain any messages queued while offline, then resume heartbeats
    void processOutbox();
    // Automatically re-attempt decryption on any messages stuck as '[Encrypted Message]' during cold-start
    void useChatStore.getState().redecryptMessages();
    // Start heartbeat pings to keep the server aware we are active
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('heartbeat');
      }
    }, HEARTBEAT_INTERVAL_MS);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${reason}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  socket.on('connect_error', async (error) => {
    console.error(`[Socket] Connection Error: ${error.message}`);
    if (error.message === 'UNAUTHORIZED' || error.message?.includes('UNAUTHORIZED')) {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          console.info('[Socket] UNAUTHORIZED received — Force-refreshing Firebase token...');
          const freshToken = await currentUser.getIdToken(true);
          useAuthStore.getState().setToken(freshToken);
          // Update the active socket handshake credential and reconnect
          updateSocketToken(freshToken);
        }
      } catch (refreshErr) {
        console.warn('[Socket] Token refresh on connect_error failed:', refreshErr);
      }
    }
  });

  socket.on('error', (err: { code: string; message: string }) => {
    console.warn('[Socket] Server error:', err.code, err.message);
  });

socket.on('receive-message', async (payload: any) => {
    const conversationId = payload?.conversationId;
    const encryptedContent = payload?.encryptedContent ?? payload?.text ?? '';
    const contentType = payload?.contentType || 'text';
    const senderId = payload?.senderId;
    
    if (!conversationId) return;
    if (contentType === 'text' && !encryptedContent) return;

    const currentState = useChatStore.getState();
    const existingMessages = currentState.messages[conversationId] || [];
    const alreadyExists = existingMessages.some(
      (msg) => msg.id === payload?.tempId || msg.id === payload?.id
    );
    if (alreadyExists) return;

    const messageDate = payload?.createdAt ? new Date(payload.createdAt) : new Date();

    // Decrypt message content through the unified E2EE pipeline (epoch keys,
    // then identity keys, then historical key versions). Plaintext-looking
    // content passes through unchanged; total failure shows '[Encrypted Message]'.
    let decryptedText = encryptedContent;

    const isLikelyPlaintext = !encryptedContent ||
      encryptedContent.length < 20 || // Very short, likely not encrypted
      /^[a-zA-Z0-9\s]+$/.test(encryptedContent); // Only alphanumeric, likely plaintext

    if (senderId && encryptedContent && !isLikelyPlaintext) {
      try {
        const currentUserId = useAuthStore.getState().user?.id || '';
        const plaintext = await decryptIncoming(conversationId, encryptedContent, senderId, currentUserId);
        decryptedText = plaintext !== null ? plaintext : '[Encrypted Message]';
      } catch (error) {
        console.error('[Socket] Failed to decrypt message:', error);
        decryptedText = '[Encrypted Message]';
      }
    }

    const incomingMessage: ChatMessage = {
      id: payload?.tempId || payload?.id || crypto.randomUUID(),
      conversationId,
      senderId: senderId || 'remote',
      text: decryptedText,
      encryptedContent: payload?.encryptedContent ?? payload?.text ?? undefined,
      isSelf: false,
      time: messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: messageDate.toISOString(),
      isRead: false,
      isEdited: false,
      isDeleted: false,
      deliveryStatus: 'received',
      reactions: [],
      isPinned: false,
      isStarred: false,
      replyTo: payload?.replyTo,
      contentType: payload?.contentType || 'text',
      mediaUrl: payload?.mediaUrl,
      fileName: payload?.fileName,
      fileSize: payload?.fileSize,
      duration: payload?.duration,
      locationData: payload?.locationData,
      contactData: payload?.contactData,
      pollData: payload?.pollData,
      eventData: payload?.eventData,
    };

    useChatStore.getState().addMessage(conversationId, incomingMessage);

    // In-app banner + chime for messages landing OUTSIDE the active chat.
    if (conversationId !== useChatStore.getState().activeConversationId) {
      const convo = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      const senderMember = convo?.members?.find((m) => m.id === senderId);
      const contentType = payload?.contentType || 'text';
      let preview: string;
      if (contentType === 'text' || contentType === 'system') {
        preview = decryptedText;
      } else if (contentType === 'image') preview = '📷 [Image]';
      else if (contentType === 'video') preview = '🎥 [Video]';
      else if (contentType === 'voice-note') preview = '🎤 [Voice Note]';
      else if (contentType === 'file') preview = `📄 [${payload?.fileName || 'File'}]`;
      else if (contentType === 'location') preview = '📍 [Location]';
      else if (contentType === 'contact') preview = '👤 [Contact]';
      else if (contentType === 'poll') preview = '📊 [Poll]';
      else if (contentType === 'event') preview = '📅 [Event]';
      else preview = decryptedText;

      window.dispatchEvent(
        new CustomEvent('silenx:inapp-notification', {
          detail: {
            conversationId,
            senderName:
              payload?.senderDisplayName ||
              senderMember?.displayName ||
              convo?.name ||
              'New message',
            senderAvatarUrl: senderMember?.avatarUrl || null,
            preview,
            timestamp: messageDate.toISOString(),
          },
        })
      );
      void playIncomingChime();
    }
});

  // E2EE key-rotation handshake events
  socket.on('key:rotate-request-received', (payload: any) => {
    void handleRotateRequest(payload);
  });

  socket.on('key:rotate-ack-received', (payload: any) => {
    void handleRotateAck(payload);
  });

  // A peer could not find our public key on the server (server restarted /
  // key lost) — re-upload ours immediately via the CryptoContext handler.
  socket.on('upload-your-public-key', async () => {
    console.info('[Socket] Peer requested our public key re-upload');
    // Our key may exist locally but be missing server-side; clear the server
    // fetch path is irrelevant here — just push the local key up again.
    try {
      if (publicKeyUploadHandler) {
        await publicKeyUploadHandler();
      } else {
        const localKey = localStorage.getItem('slienx_public_key');
        if (localKey) {
          await uploadPublicKeyToApi(localKey);
        }
      }
    } catch (err) {
      console.warn('[Socket] Public key re-upload failed:', err);
    }
  });

socket.on('receive-message-reaction', (payload: any) => {
    const { conversationId, messageId, userId, emoji } = payload || {};
    if (!conversationId || !messageId || !userId) return;
    useChatStore.getState().reactToMessage(conversationId, messageId, userId, emoji);
  });

  // When your friend request is accepted, instantly add the new conversation to the chat list
  socket.on('request:accepted', (payload: any) => {
    if (payload?.conversation) {
      const convo = payload.conversation;
      useChatStore.setState((state) => {
        const alreadyExists = state.conversations.some((c) => c.id === convo.id);
        if (alreadyExists) return {};
        return { conversations: [convo, ...state.conversations] };
      });
    }
    // Also trigger a full refresh incase state is stale
    useChatStore.getState().fetchConversations();
  });

  socket.on('poll-voted', (payload: any) => {
    const { conversationId, messageId, pollData } = payload || {};
    if (!conversationId || !messageId || !pollData) return;
    useChatStore.getState().updatePollState(conversationId, messageId, pollData);
  });

  socket.on('user-status-changed', (payload: any) => {
    const { userId, status, lastSeen } = payload || {};
    if (!userId || !status) return;
    useChatStore.getState().updateUserStatus(userId, status, lastSeen);
  });

  socket.on('message-read', (payload: any) => {
    const { conversationId, messageId } = payload || {};
    if (!conversationId || !messageId) return;
    useChatStore.getState().markMessageRead(conversationId, messageId);
  });

  socket.on('messages-read', (payload: any) => {
    const { conversationId } = payload || {};
    if (!conversationId) return;
    const currentState = useChatStore.getState();
    const msgs = currentState.messages[conversationId] || [];
    const updated = msgs.map((m) => (m.isSelf ? { ...m, isRead: true, deliveryStatus: 'read' as const } : m));
    useChatStore.setState({
      messages: {
        ...currentState.messages,
        [conversationId]: updated,
      },
    });
    // Persist read status to local storage & IndexedDB cache
    const key = `slienx-chat-state-${useAuthStore.getState().user?.id || 'guest'}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored.messages = { ...stored.messages, [conversationId]: updated };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch (e) {
      console.warn('[Socket] Failed to persist messages-read state:', e);
    }
  });

  socket.on('group-updated', (payload: any) => {
    const { groupId, name, description, avatarUrl } = payload || {};
    if (!groupId) return;
    useChatStore.setState((state) => {
      const nextConvos = state.conversations.map((c) => {
        const matches = c.groupId === groupId || c.id === `conv_group_${groupId}` || c.id === groupId;
        if (matches) {
          return {
            ...c,
            name: name !== undefined ? name : c.name,
            avatarUrl: avatarUrl !== undefined ? avatarUrl : c.avatarUrl,
            description: description !== undefined ? description : c.description,
          };
        }
        return c;
      });
      return { conversations: nextConvos };
    });
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

/**
 * Dynamically refresh the handshake credential of the ACTIVE socket without
 * dropping the connection. Firebase rotates the ID token hourly; without this
 * the next reconnect would fail with UNAUTHORIZED until a full re-login.
 * The new token is applied on the next handshake; if the socket is currently
 * disconnected we nudge it so recovery starts immediately with fresh auth.
 */
export const updateSocketToken = (newToken: string): void => {
  if (!socket || !newToken) return;
  const currentToken = socket.auth && typeof socket.auth === 'object'
    ? (socket.auth as any).token
    : null;
  if (currentToken === newToken) return;

  socket.auth = { token: newToken };
  if (!socket.connected && !socket.active) {
    // Fully disconnected (attempts exhausted) — kick a reconnect manually.
    socket.connect();
  }
};

// Let apiFetch push refreshed tokens into the live socket without a circular import
setSocketTokenUpdater(updateSocketToken);

export const disconnectSocket = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};