import React, { useState, useEffect } from 'react';
import ChatList from '../components/features/ChatList';
import ChatView from '../components/ChatView';
import AddContactModal from '../components/AddContactModal';
import { useChatStore } from '../store/chatStore';

export const ChatsPage: React.FC = () => {
  const [isContactSelectorOpen, setIsContactSelectorOpen] = useState(false);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="dashboard-chat-layout" style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      overflow: 'hidden'
    }}>
      <ChatList onNewChatClick={() => setIsContactSelectorOpen(true)} />
      <ChatView />

      <AddContactModal 
        isOpen={isContactSelectorOpen} 
        onClose={() => setIsContactSelectorOpen(false)}
        onAddComplete={() => {
          setIsContactSelectorOpen(false);
          fetchConversations();
        }}
      />
    </div>
  );
};

export default ChatsPage;
