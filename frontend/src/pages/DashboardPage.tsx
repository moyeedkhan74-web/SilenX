import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import MainContent from '../components/layout/MainContent';
import { useChatStore } from '../store/chatStore';
import { useIsMobile } from '../hooks/useIsMobile';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isMobile = useIsMobile();
  const location = useLocation();

  const isChatOpen = isMobile && location.pathname.startsWith('/chats') && Boolean(activeConversationId);

  return (
    <div className={`dashboard-page ${isChatOpen ? 'chat-open' : ''}`}>
      <Sidebar />
      <MainContent>
        <Outlet />
      </MainContent>
    </div>
  );
};

export default DashboardPage;
