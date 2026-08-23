import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { auth } from '../config/firebase';
import { decryptMessage } from '../utils/crypto';
import type { ChatMessage } from '../types';
import { API_URL } from '../config/webrtc-config';
import { processOutbox, attachOutboxListeners } from './outbox';

// Public key cache to avoid fetching on every message
const publicKeyCache: Record<string, string> = {};

/** Drop a cached recipient key so the next fetch gets a fresh one (key rotation). */
export const clearPublicKeyCache = (userId: string): void => {
  delete publicKeyCache[userId];
};

export const getPublicKey = async (userId: string): Promise<string | null> => {
  // Check cache first
  if (publicKeyCache[userId]) return publicKeyCache[userId];

  try {
    const token = useAuthStore.getState().token;
    if (!token) return null;
    const res = await fetch(`${API_URL}/api/users/${userId}/public-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const publicKey = data.publicKey;
      publicKeyCache[userId] = publicKey || '';
      return publicKeyCache[userId];
    }
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
    // Drain any messages queued while offline, then resume heartbeats
    void processOutbox();
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
          if (socket) {
            socket.auth = { token: freshToken };
            socket.connect();
          }
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

    // Decrypt message content if it's encrypted
    let decryptedText = encryptedContent;
    
    // Check if content appears to be plaintext (not Base64 encrypted)
    const isLikelyPlaintext = !encryptedContent || 
      /^[^\s\S]*$/.test(encryptedContent) || // Empty or whitespace only
      encryptedContent.length < 20 || // Very short, likely not encrypted
      /^[a-zA-Z0-9\s]+$/.test(encryptedContent); // Only alphanumeric, likely plaintext

    if (senderId && encryptedContent && !isLikelyPlaintext) {
      // Try to get public key from cache first
      const cachedPublicKey = publicKeyCache[senderId];
      let senderPublicKey = cachedPublicKey;
      
      if (!cachedPublicKey) {
        // Fetch public key and cache it
        const cached = await getPublicKey(senderId);
        senderPublicKey = cached || '';
      }
      
      if (senderPublicKey) {
        try {
          const token = useAuthStore.getState().token;
          if (token) {
            const plaintext = decryptMessage(encryptedContent, senderPublicKey);
            if (plaintext) {
              decryptedText = plaintext;
            } else {
              decryptedText = '[Encrypted Message]';
            }
          } else {
            decryptedText = '[Encrypted Message]';
          }
        } catch (error) {
          console.error('[Socket] Failed to decrypt message:', error);
          decryptedText = '[Encrypted Message]';
        }
      } else {
        decryptedText = '[Encrypted Message]';
      }
    }

    const incomingMessage: ChatMessage = {
      id: payload?.tempId || payload?.id || crypto.randomUUID(),
      conversationId,
      senderId: senderId || 'remote',
      text: decryptedText,
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
    useChatStore.setState((state) => {
      const msgs = state.messages[conversationId] || [];
      const updated = msgs.map((m) => (m.isSelf ? { ...m, isRead: true, deliveryStatus: 'read' as const } : m));
      return {
        messages: {
          ...state.messages,
          [conversationId]: updated,
        },
      };
    });
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