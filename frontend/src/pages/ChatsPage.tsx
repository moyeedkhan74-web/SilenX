import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatList from '../components/features/ChatList';
import ChatView from '../components/ChatView';
import { useChatStore } from '../store/chatStore';
import { useIsMobile } from '../hooks/useIsMobile';

export const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const hydrateFromStorage = useChatStore((s) => s.hydrateFromStorage);
  const hydrateFromIndexedDB = useChatStore((s) => s.hydrateFromIndexedDB);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Instant paint from localStorage, then merge the durable IndexedDB cache
    // so offline history renders before the network fetch completes.
    hydrateFromStorage();
    void hydrateFromIndexedDB();
    fetchConversations();
  }, [hydrateFromStorage, hydrateFromIndexedDB, fetchConversations]);

  // Mobile: show either chat list or chat view, never both.
  // The chat view slides in natively over the list (240ms GPU transform).
  if (isMobile) {
    return (
      <div className={`dashboard-chat-layout chats-mobile ${activeConversationId ? 'chat-open' : ''}`} style={{
        display: 'flex',
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div className="mobile-pane mobile-pane-list" aria-hidden={Boolean(activeConversationId)}>
          <ChatList onNewChatClick={() => navigate('/contacts')} />
        </div>
        {activeConversationId && (
          <div className="mobile-pane mobile-pane-chat">
            <ChatView />
          </div>
        )}
      </div>
    );
  }

  // Desktop: show both side-by-side
  return (
    <div className="dashboard-chat-layout" style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      overflow: 'hidden'
    }}>
      <ChatList onNewChatClick={() => navigate('/contacts')} />
      <ChatView />
    </div>
  );
};

export default ChatsPage;
