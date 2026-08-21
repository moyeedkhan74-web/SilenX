import { create } from 'zustand';
import type { Conversation, ChatMessage, UserStatus } from '../types';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from './authStore';
import { apiFetch } from '../utils/apiFetch';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  activeMediaMessage: ChatMessage | null;
  isLoading: boolean;

  // REST API methods
  fetchConversations: () => Promise<void>;
  fetchMessages: (id: string) => Promise<void>;
  createConversation: (recipientUid: string) => Promise<Conversation | null>;
  createGroup: (payload: { name: string; description?: string; avatarUrl?: string; members: string[] }) => Promise<Conversation | null>;
  updateGroup: (groupId: string, payload: { name?: string; description?: string; avatarUrl?: string | null }) => Promise<boolean>;
  hydrateFromStorage: () => void;

  // Local modifications (optimistic updates)
  setConversations: (convos: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setActiveMediaMessage: (message: ChatMessage | null) => void;
  addMessage: (convId: string, msg: ChatMessage) => void;
  setMessages: (convId: string, msgs: ChatMessage[]) => void;
  markMessageRead: (convId: string, messageId: string) => void;
  editMessage: (convId: string, messageId: string, newText: string) => void;
  deleteMessage: (convId: string, messageId: string) => void;
  removeMessage: (convId: string, messageId: string) => void;
  clearConversation: (convId: string) => void;
  reactToMessage: (convId: string, messageId: string, userId: string, emoji: string) => void;
  updatePollState: (convId: string, messageId: string, pollData: any) => void;
  updateUserStatus: (userId: string, status: UserStatus, lastSeen: string) => void;

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

const sortMessagesByTime = (msgs: ChatMessage[]): ChatMessage[] => {
  return [...msgs].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  activeMediaMessage: null,
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
      const res = await apiFetch(`${API_URL}/api/conversations`, {
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
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
      const res = await apiFetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
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
          const sorted = sortMessagesByTime(mergedMessages);
          const nextState = {
            messages: {
              ...state.messages,
              [conversationId]: sorted,
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
      const res = await apiFetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
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

  createGroup: async (payload) => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return null;

      const res = await apiFetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Failed to create group on server:', body?.message || res.statusText);
        return null;
      }

      const response = await res.json();
      const groupMembers = (response.membersList || []).map((member: any) => ({
        id: member.id,
        uid: member.uid,
        email: member.email,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        status: member.status || 'offline',
        lastSeen: member.lastSeen || '',
        bio: member.bio || '',
        showOnlineStatus: member.showOnlineStatus,
      }));

      const newConvo: Conversation = {
        id: response.conversationId || response.id,
        type: 'group',
        name: response.name,
        avatarUrl: response.avatarUrl || null,
        lastMessage: 'Group ready',
        lastMessageTime: '',
        unreadCount: 0,
        members: groupMembers,
        isPinned: false,
        isMuted: false,
      };

      const currentConvos = get().conversations;
      if (!currentConvos.some((c) => c.id === newConvo.id)) {
        const nextConversations = [newConvo, ...currentConvos];
        set({ conversations: nextConversations });
        persistState({ conversations: nextConversations });
      }

      await get().fetchConversations();
      return newConvo;
    } catch (err) {
      console.error('Failed to create group on server:', err);
    }

    return null;
  },

  updateGroup: async (groupId, payload) => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return false;

      const res = await apiFetch(`${API_URL}/api/groups/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedGroup = await res.json();
        set((state) => {
          const nextConvos = state.conversations.map((c) => {
            const matches = c.groupId === groupId || c.id === `conv_group_${groupId}` || c.id === groupId;
            if (matches) {
              return {
                ...c,
                name: updatedGroup.name !== undefined ? updatedGroup.name : c.name,
                avatarUrl: updatedGroup.avatarUrl !== undefined ? updatedGroup.avatarUrl : c.avatarUrl,
                description: updatedGroup.description !== undefined ? updatedGroup.description : c.description,
              };
            }
            return c;
          });
          const nextState = { conversations: nextConvos };
          persistState(nextState);
          return nextState;
        });
        return true;
      }
    } catch (err) {
      console.error('Failed to update group:', err);
    }
    return false;
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
  setActiveMediaMessage: (message) => {
    set({ activeMediaMessage: message });
  },
  addMessage: (convId, msg) =>
    set((state) => {
      const existing = state.messages[convId] || [];
      const updatedMessages = existing.some((m) => m.id === msg.id)
        ? existing.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
        : [...existing, msg];
      const sortedMessages = sortMessagesByTime(updatedMessages);

      // Update conversation's last message & time and move to top
      const updatedConvos = state.conversations.map((c) => {
        if (c.id === convId) {
          const unreadCount = (!msg.isSelf && state.activeConversationId !== convId)
            ? (c.unreadCount || 0) + 1
            : c.unreadCount;

          const previewText = msg.text || (
            msg.contentType === 'image' ? '📷 Photo' :
            msg.contentType === 'video' ? '🎥 Video' :
            msg.contentType === 'voice-note' ? '🎤 Voice note' :
            msg.contentType === 'file' ? `📄 ${msg.fileName || 'File'}` :
            msg.contentType === 'location' ? '📍 Location' :
            msg.contentType === 'contact' ? '👤 Contact' :
            msg.contentType === 'poll' ? '📊 Poll' :
            msg.contentType === 'event' ? '📅 Event' : ''
          );

          return {
            ...c,
            lastMessage: previewText,
            lastMessageTime: msg.time,
            unreadCount,
          };
        }
        return c;
      });

      // Move active conversation to top of list
      const targetConvoIndex = updatedConvos.findIndex((c) => c.id === convId);
      if (targetConvoIndex > 0) {
        const [targetConvo] = updatedConvos.splice(targetConvoIndex, 1);
        updatedConvos.unshift(targetConvo);
      }

      const nextState: Partial<ChatState> = {
        messages: {
          ...state.messages,
          [convId]: sortedMessages,
        },
        conversations: updatedConvos,
      };
      persistState(nextState);
      return nextState;
    }),
  setMessages: (convId, msgs) =>
    set((state) => {
      const sorted = sortMessagesByTime(msgs);
      const nextState: Partial<ChatState> = { messages: { ...state.messages, [convId]: sorted } };
      persistState(nextState);
      return nextState;
    }),
  reactToMessage: (convId, messageId, userId, emoji) =>
    set((state) => {
      const updatedMessages = (state.messages[convId] || []).map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ? [...m.reactions] : [];
        const existingIdx = reactions.findIndex((r) => r.userId === userId);
        if (existingIdx > -1) {
          if (reactions[existingIdx].emoji === emoji || !emoji) {
            reactions.splice(existingIdx, 1);
          } else {
            reactions[existingIdx] = { userId, emoji };
          }
        } else if (emoji) {
          reactions.push({ userId, emoji });
        }
        return { ...m, reactions };
      });
      const nextState: Partial<ChatState> = {
        messages: { ...state.messages, [convId]: updatedMessages }
      };
      persistState(nextState);
      return nextState;
    }),
  updatePollState: (convId, messageId, pollData) =>
    set((state) => {
      const updatedMessages = (state.messages[convId] || []).map((m) =>
        m.id === messageId ? { ...m, pollData } : m
      );
      const nextState: Partial<ChatState> = {
        messages: { ...state.messages, [convId]: updatedMessages }
      };
      persistState(nextState);
      return nextState;
    }),
  updateUserStatus: (userId, status, lastSeen) =>
    set((state) => {
      const updatedConversations = state.conversations.map((c) => {
        const hasMember = c.members.some((m) => m.id === userId);
        if (hasMember) {
          return {
            ...c,
            members: c.members.map((m) =>
              m.id === userId ? { ...m, status, lastSeen } : m
            ),
          };
        }
        return c;
      });
      const nextState = { conversations: updatedConversations };
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
      const res = await apiFetch(`${API_URL}/api/conversations/${encodeURIComponent(convId)}`, {
        method: 'DELETE',
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
