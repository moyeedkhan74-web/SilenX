import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import type { ChatMessage } from '../types';

let socket: Socket | null = null;

const registerCurrentUser = () => {
  const currentUser = useAuthStore.getState().user;
  if (socket?.connected && currentUser?.id) {
    socket.emit('register', { userId: currentUser.id });
  }
};

export const connectSocket = (): Socket => {
  if (!socket) {
    const options = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    };

    socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);

    socket.on('connect', () => {
      console.log(`[Socket] Connected: ${socket?.id}`);
      registerCurrentUser();
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error(`[Socket] Connection Error: ${error.message}`);
    });

    socket.on('receive-message', (payload: any) => {
      const conversationId = payload?.conversationId;
      const text = payload?.encryptedContent || payload?.text || '';
      if (!conversationId || !text) return;

      const currentState = useChatStore.getState();
      const existingMessages = currentState.messages[conversationId] || [];
      const alreadyExists = existingMessages.some((msg) => msg.id === payload?.tempId || msg.id === payload?.id);
      if (alreadyExists) return;

      const incomingMessage: ChatMessage = {
        id: payload?.tempId || payload?.id || crypto.randomUUID(),
        conversationId,
        senderId: payload?.senderId || 'remote',
        text,
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
      };

      useChatStore.getState().addMessage(conversationId, incomingMessage);
    });

    socket.on('receive-message-reaction', (payload: any) => {
      const { conversationId, messageId, userId, emoji } = payload || {};
      if (!conversationId || !messageId || !userId) return;
      useChatStore.getState().reactToMessage(conversationId, messageId, userId, emoji);
    });
  }

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
