import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Users, User, Settings, LogOut } from 'lucide-react';
import '../Sidebar.css';

interface SidebarProps {}

const tabs = [
  { path: '/chats', label: 'Chats', icon: <MessageCircle size={20} /> },
  { path: '/contacts', label: 'Contacts', icon: <Users size={20} /> },
  { path: '/profile', label: 'Profile', icon: <User size={20} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
];

export const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    console.log('[Auth] Clearing session and logging out');
    navigate('/login');
  };

  const currentPath = location.pathname;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" aria-label="SlienX">
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, var(--primary-main), var(--primary-light))',
            color: 'var(--color-on-accent)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.06em',
          }}
        >
          SX
        </div>
      </div>

      <nav className="sidebar-nav">
        {tabs.map((tab) => {
          const isActive = currentPath.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(tab.path)}
              data-tooltip={tab.label}
              type="button"
            >
              {tab.icon}
            </button>
          );
        })}
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
