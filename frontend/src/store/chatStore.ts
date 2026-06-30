import { create } from 'zustand';
import type { Conversation, ChatMessage } from '../types';
import { API_URL } from '../config/webrtc-config';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  isLoading: boolean;
  
  // REST API methods
  fetchConversations: () => Promise<void>;
  fetchMessages: (id: string) => Promise<void>;
  createConversation: (recipientUid: string) => Promise<Conversation | null>;
  
  // Local modifications (optimistic updates)
  setConversations: (convos: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (convId: string, msg: ChatMessage) => void;
  setMessages: (convId: string, msgs: ChatMessage[]) => void;
  markMessageRead: (convId: string, messageId: string) => void;
  editMessage: (convId: string, messageId: string, newText: string) => void;
  deleteMessage: (convId: string, messageId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isLoading: false,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/api/conversations`);
      if (res.ok) {
        const data = await res.json();
        set({ conversations: data });
      }
    } catch (err) {
      console.error('Failed to fetch conversations from server:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: data,
          },
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch messages for ${conversationId}:`, err);
    }
  },

  createConversation: async (recipientUid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', recipientUid }),
      });
      if (res.ok) {
        const newConvo: Conversation = await res.json();
        
        // Update local list if not already present
        const currentConvos = get().conversations;
        if (!currentConvos.some(c => c.id === newConvo.id)) {
          set({ conversations: [newConvo, ...currentConvos] });
        }
        
        return newConvo;
      }
    } catch (err) {
      console.error('Failed to create conversation on server:', err);
    }
    return null;
  },

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().fetchMessages(id);
    }
  },
  addMessage: (convId, msg) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: [...(state.messages[convId] || []), msg],
      },
    })),
  setMessages: (convId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [convId]: msgs },
    })),
  markMessageRead: (convId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m.id === messageId ? { ...m, isRead: true } : m
        ),
      },
    })),
  editMessage: (convId, messageId, newText) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m.id === messageId ? { ...m, text: newText, isEdited: true } : m
        ),
      },
    })),
  deleteMessage: (convId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, text: 'This message was deleted' } : m
        ),
      },
    })),
}));
