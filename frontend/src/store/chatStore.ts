import { create } from 'zustand';
import type { Conversation, ChatMessage } from '../types';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from './authStore';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  isLoading: boolean;

  // REST API methods
  fetchConversations: () => Promise<void>;
  fetchMessages: (id: string) => Promise<void>;
  createConversation: (recipientUid: string) => Promise<Conversation | null>;
  hydrateFromStorage: () => void;

  // Local modifications (optimistic updates)
  setConversations: (convos: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (convId: string, msg: ChatMessage) => void;
  setMessages: (convId: string, msgs: ChatMessage[]) => void;
  markMessageRead: (convId: string, messageId: string) => void;
  editMessage: (convId: string, messageId: string, newText: string) => void;
  deleteMessage: (convId: string, messageId: string) => void;
  removeMessage: (convId: string, messageId: string) => void;
  clearConversation: (convId: string) => void;

  // Context menu actions
  deleteConversation: (convId: string) => Promise<void>;
  pinConversation: (convId: string) => void;
  muteConversation: (convId: string) => void;
  markAsRead: (convId: string) => void;
}

const getStorageKey = (userId?: string | null) => `slienx-chat-state-${userId || 'guest'}`;

const persistState = (state: Partial<ChatState>) => {
  const currentUser = useAuthStore.getState().user;
  const key = getStorageKey(currentUser?.id);
  const payload = {
    conversations: state.conversations ?? useChatStore.getState().conversations,
    messages: state.messages ?? useChatStore.getState().messages,
    activeConversationId: state.activeConversationId ?? useChatStore.getState().activeConversationId,
  };
  localStorage.setItem(key, JSON.stringify(payload));
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isLoading: false,

  hydrateFromStorage: () => {
    try {
      const currentUser = useAuthStore.getState().user;
      const key = getStorageKey(currentUser?.id);
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      set({
        conversations: parsed.conversations || [],
        messages: parsed.messages || {},
        activeConversationId: parsed.activeConversationId || null,
      });
    } catch (err) {
      console.error('Failed to hydrate chat state:', err);
    }
  },

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const currentUser = useAuthStore.getState().user;
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: {
          'x-user-id': currentUser?.id || 'self',
        }
      });
      if (res.ok) {
        const data = await res.json();
        set({ conversations: data });
        persistState({ conversations: data });
      }
    } catch (err) {
      console.error('Failed to fetch conversations from server:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    try {
      const currentUser = useAuthStore.getState().user;
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: {
          'x-user-id': currentUser?.id || 'self',
        }
      });
      if (res.ok) {
        const data = await res.json();
        set((state) => {
          const mergedMessages = [...(state.messages[conversationId] || [])];
          data.forEach((msg: ChatMessage) => {
            if (!mergedMessages.some((existing) => existing.id === msg.id)) {
              mergedMessages.push(msg);
            }
          });
          const nextState = {
            messages: {
              ...state.messages,
              [conversationId]: mergedMessages,
            },
          };
          persistState(nextState);
          return nextState;
        });
      }
    } catch (err) {
      console.error(`Failed to fetch messages for ${conversationId}:`, err);
    }
  },

  createConversation: async (recipientUid: string) => {
    try {
      const currentUser = useAuthStore.getState().user;
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'self',
        },
        body: JSON.stringify({ type: 'direct', recipientUid }),
      });
      if (res.ok) {
        const newConvo: Conversation = await res.json();

        const currentConvos = get().conversations;
        if (!currentConvos.some((c) => c.id === newConvo.id)) {
          const nextConversations = [newConvo, ...currentConvos];
          set({ conversations: nextConversations });
          persistState({ conversations: nextConversations });
        }

        return newConvo;
      }
    } catch (err) {
      console.error('Failed to create conversation on server:', err);
    }
    return null;
  },

  setConversations: (conversations) => {
    set({ conversations });
    persistState({ conversations });
  },
  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    persistState({ activeConversationId: id });
    if (id) {
      get().fetchMessages(id);
    }
  },
  addMessage: (convId, msg) =>
    set((state) => {
      const nextState: Partial<ChatState> = {
        messages: {
          ...state.messages,
          [convId]: [...(state.messages[convId] || []), msg],
        },
      };
      persistState(nextState);
      return nextState;
    }),
  setMessages: (convId, msgs) =>
    set((state) => {
      const nextState: Partial<ChatState> = { messages: { ...state.messages, [convId]: msgs } };
      persistState(nextState);
      return nextState;
    }),
  markMessageRead: (convId, messageId) =>
    set((state) => {
      const nextState: Partial<ChatState> = {
        messages: {
          ...state.messages,
          [convId]: (state.messages[convId] || []).map((m) =>
            m.id === messageId ? { ...m, isRead: true, deliveryStatus: 'read' } : m
          ),
        },
      };
      persistState(nextState);
      return nextState;
    }),
  editMessage: (convId, messageId, newText) =>
    set((state) => {
      const nextState: Partial<ChatState> = {
        messages: {
          ...state.messages,
          [convId]: (state.messages[convId] || []).map((m) =>
            m.id === messageId ? { ...m, text: newText, isEdited: true } : m
          ),
        },
      };
      persistState(nextState);
      return nextState;
    }),
  deleteMessage: (convId, messageId) =>
    set((state) => {
      const nextState: Partial<ChatState> = {
        messages: {
          ...state.messages,
          [convId]: (state.messages[convId] || []).map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, text: 'This message was deleted' } : m
          ),
        },
      };
      persistState(nextState);
      return nextState;
    }),
  removeMessage: (convId, messageId) =>
    set((state) => {
      const nextState: Partial<ChatState> = {
        messages: {
          ...state.messages,
          [convId]: (state.messages[convId] || []).filter((m) => m.id !== messageId),
        },
      };
      persistState(nextState);
      return nextState;
    }),
  clearConversation: (convId) =>
    set((state) => {
      const nextMessages = { ...state.messages };
      delete nextMessages[convId];
      const nextState: Partial<ChatState> = {
        messages: nextMessages,
        conversations: state.conversations.map((conversation) =>
          conversation.id === convId
            ? { ...conversation, lastMessage: '', lastMessageTime: '' }
            : conversation
        ),
      };
      persistState(nextState);
      return nextState;
    }),
  deleteConversation: async (convId) => {
    try {
      const currentUser = useAuthStore.getState().user;
      const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(convId)}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser?.id || 'self',
        },
      });

      if (res.ok) {
        set((state) => {
          const nextConvos = state.conversations.filter((c) => c.id !== convId);
          const nextMessages = { ...state.messages };
          delete nextMessages[convId];
          const activeId = state.activeConversationId === convId ? null : state.activeConversationId;
          const nextState = {
            conversations: nextConvos,
            messages: nextMessages,
            activeConversationId: activeId,
          };
          persistState(nextState);
          return nextState;
        });
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  },
  pinConversation: (convId) => {
    set((state) => {
      const nextConvos = state.conversations.map((c) =>
        c.id === convId ? { ...c, isPinned: !c.isPinned } : c
      );
      const nextState = { conversations: nextConvos };
      persistState(nextState);
      return nextState;
    });
  },
  muteConversation: (convId) => {
    set((state) => {
      const nextConvos = state.conversations.map((c) =>
        c.id === convId ? { ...c, isMuted: !c.isMuted } : c
      );
      const nextState = { conversations: nextConvos };
      persistState(nextState);
      return nextState;
    });
  },
  markAsRead: (convId) => {
    set((state) => {
      const nextConvos = state.conversations.map((c) =>
        c.id === convId ? { ...c, unreadCount: 0 } : c
      );
      const nextState = { conversations: nextConvos };
      persistState(nextState);
      return nextState;
    });
  },
}));
