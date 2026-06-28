import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatView from '../components/ChatView';
import ContactsTab from '../components/ContactsTab';
import ProfileTab from '../components/ProfileTab';
import SettingsTab from '../components/SettingsTab';
import AddContactModal from '../components/AddContactModal';
import { useChatStore } from '../store/chatStore';
import './DashboardPage.css';

export type TabName = 'chats' | 'contacts' | 'profile' | 'settings';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('chats');
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'chats':
        return (
          <div className="dashboard-chat-layout">
            <ConversationList />
            <ChatView />
          </div>
        );
      case 'contacts':
        return <ContactsTab onAddClick={() => setIsAddContactOpen(true)} />;
      case 'profile':
        return <ProfileTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-page">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="dashboard-main">
        {renderMainContent()}
      </main>

      <AddContactModal 
        isOpen={isAddContactOpen} 
        onClose={() => setIsAddContactOpen(false)}
        onAddComplete={() => {
          setIsAddContactOpen(false);
          setActiveTab('chats');
        }}
      />
    </div>
  );
};

export default DashboardPage;
