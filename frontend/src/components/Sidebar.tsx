import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users, User, Settings, LogOut } from 'lucide-react';
import type { TabName } from '../pages/DashboardPage';
import './Sidebar.css';

interface SidebarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

const tabs: { name: TabName; label: string; icon: React.ReactNode }[] = [
  { name: 'chats', label: 'Chats', icon: <MessageCircle size={20} /> },
  { name: 'contacts', label: 'Contacts', icon: <Users size={20} /> },
  { name: 'profile', label: 'Profile', icon: <User size={20} /> },
  { name: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log('[Auth] Clearing session and logging out');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" aria-label="SlienX">
        <img src="/slienx-logo.png" alt="SlienX" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
      </div>

      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            className={`nav-item ${activeTab === tab.name ? 'active' : ''}`}
            onClick={() => onTabChange(tab.name)}
            data-tooltip={tab.label}
            type="button"
          >
            {tab.icon}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" onClick={handleLogout} data-tooltip="Logout" type="button">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
