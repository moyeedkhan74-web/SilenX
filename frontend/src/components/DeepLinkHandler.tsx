import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';

export const OPEN_CONVERSATION_EVENT = 'silenx:open-conversation';

/**
 * Central deep-link router for conversations. Handles:
 *  - Web push notification clicks (?chat=<id> URL parameter, opened by the
 *    Firebase messaging service worker)
 *  - Android native notification taps (dispatched as CustomEvents from
 *    nativePush.ts)
 *  - Service-worker messages ({ type: 'mark-read', conversationId })
 */
export const DeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const openConversation = (conversationId: string) => {
      if (!conversationId) return;
      useChatStore.getState().setActiveConversation(conversationId);
      navigate('/chats');
    };

    // 1. Web deep link: /?chat=<conversationId>
    try {
      const params = new URLSearchParams(window.location.search);
      const chatParam = params.get('chat');
      if (chatParam) {
        openConversation(chatParam);
        params.delete('chat');
        const cleaned = params.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${cleaned ? `?${cleaned}` : ''}`
        );
      }
    } catch {
      // ignore malformed URLs
    }

    // 2. Native notification taps
    const onOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (detail?.conversationId) {
        openConversation(detail.conversationId);
      }
    };
    window.addEventListener(OPEN_CONVERSATION_EVENT, onOpenEvent);

    // 3. Messages posted by the Firebase messaging service worker
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; conversationId?: string } | null;
      if (!data?.type) return;

      if (data.type === 'open-conversation' && data.conversationId) {
        openConversation(data.conversationId);
      } else if (data.type === 'mark-read' && data.conversationId) {
        useChatStore.setState((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === data.conversationId ? { ...c, unreadCount: 0 } : c
          ),
        }));
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      window.removeEventListener(OPEN_CONVERSATION_EVENT, onOpenEvent);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [navigate]);

  return null;
};

export default DeepLinkHandler;
