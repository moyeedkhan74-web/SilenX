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
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isMobile = useIsMobile();

  useEffect(() => {
    hydrateFromStorage();
    fetchConversations();
  }, [hydrateFromStorage, fetchConversations]);

  // Mobile: show either chat list or chat view, never both
  if (isMobile) {
    return (
      <div className="dashboard-chat-layout" style={{
        display: 'flex',
        flex: 1,
        height: '100%',
        overflow: 'hidden'
      }}>
        {activeConversationId ? (
          <ChatView />
        ) : (
          <ChatList onNewChatClick={() => navigate('/contacts')} />
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
