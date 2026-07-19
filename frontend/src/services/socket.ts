import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import type { ChatMessage } from '../types';

let socket: Socket | null = null;

/**
 * Connect (or reconnect) the Socket.io client.
 *
 * @param idToken - Firebase ID token used to authenticate the socket connection on the server.
 *                  The server verifies this token in the io.use() middleware.
 */
export const connectSocket = (idToken: string): Socket => {
  // If an existing socket is open with a different token, disconnect it first
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const options = {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    // Pass the Firebase ID token in the handshake auth object
    auth: { token: idToken },
  };

  socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);

  socket.on('connect', () => {
    console.log(`[Socket] Connected: ${socket?.id}`);
    // No 'register' event needed — identity comes from the server-verified token
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

    const incomingMessage: ChatMessage = {
      id: payload?.tempId || payload?.id || crypto.randomUUID(),
      conversationId,
      senderId: payload?.senderId || 'remote',
      text: encryptedContent,
      isSelf: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
