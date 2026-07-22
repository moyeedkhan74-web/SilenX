import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatList from '../components/features/ChatList';
import ChatView from '../components/ChatView';
import { useChatStore } from '../store/chatStore';

export const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const hydrateFromStorage = useChatStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
    fetchConversations();
  }, [hydrateFromStorage, fetchConversations]);

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
