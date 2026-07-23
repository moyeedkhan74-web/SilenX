import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import type { ChatMessage } from '../types';

let socket: Socket | null = null;

/**
 * Connect (or reconnect) the Socket.io client.
 *
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

  const options = {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    // Pass the Firebase ID token in the handshake auth object
    auth: { token },
  };

  socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);

  socket.on('connect', () => {
    console.log(`[Socket] Connected: ${socket?.id}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error(`[Socket] Connection Error: ${error.message}`);
  });

  socket.on('error', (err: { code: string; message: string }) => {
    console.warn('[Socket] Server error:', err.code, err.message);
  });

  socket.on('receive-message', (payload: any) => {
    const conversationId = payload?.conversationId;
    const encryptedContent = payload?.encryptedContent ?? payload?.text ?? '';
    const contentType = payload?.contentType || 'text';
    if (!conversationId) return;
    if (contentType === 'text' && !encryptedContent) return;

    const currentState = useChatStore.getState();
    const existingMessages = currentState.messages[conversationId] || [];
    const alreadyExists = existingMessages.some(
      (msg) => msg.id === payload?.tempId || msg.id === payload?.id
    );
    if (alreadyExists) return;

    const messageDate = payload?.createdAt ? new Date(payload.createdAt) : new Date();

    const incomingMessage: ChatMessage = {
      id: payload?.tempId || payload?.id || crypto.randomUUID(),
      conversationId,
      senderId: payload?.senderId || 'remote',
      text: encryptedContent,
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

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
