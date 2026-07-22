import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Users, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import { API_URL } from '../../config/webrtc-config';
import { useIsMobile } from '../../hooks/useIsMobile';
import '../Sidebar.css';

interface SidebarProps {}

export const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.user);
  const [pendingCount, setPendingCount] = useState(0);
  const isMobile = useIsMobile();

  // Fetch pending request count & listen for live updates
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = useAuthStore.getState().token;
        if (!token) return;
        const res = await fetch(`${API_URL}/api/requests`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const pending = data.filter(
            (r: any) =>
              r.status === 'pending' &&
              (r.toUserId === currentUser?.id || r.receiverId === currentUser?.id)
          );
          setPendingCount(pending.length);
        }
      } catch (err) {
        console.error('Failed to fetch request count', err);
      }
    };

    fetchCount();

    const socket = getSocket();
    if (!socket) return;

    socket.on('request:new', () => {
      setPendingCount((c) => c + 1);
    });
    socket.on('request:accepted', () => {
      setPendingCount((c) => Math.max(0, c - 1));
    });
    socket.on('request:declined', () => {
      setPendingCount((c) => Math.max(0, c - 1));
    });

    return () => {
      const s = getSocket();
      s?.off('request:new');
      s?.off('request:accepted');
      s?.off('request:declined');
    };
  }, [currentUser]);

  // Re-fetch count when navigating away from contacts (in case user accepted/declined inline)
  useEffect(() => {
    if (location.pathname !== '/contacts') return;
    const handleVisibility = () => {
      // Refetch when user leaves contacts page
    };
    return handleVisibility;
  }, [location.pathname]);

  const handleLogout = () => {
    console.log('[Auth] Clearing session and logging out');
    navigate('/login');
  };

  const currentPath = location.pathname;

  const tabs = [
    { path: '/chats', label: 'Chats', icon: <MessageCircle size={isMobile ? 22 : 20} />, badge: 0 },
    { path: '/contacts', label: 'Contacts', icon: <Users size={isMobile ? 22 : 20} />, badge: pendingCount },
    { path: '/profile', label: 'Profile', icon: <Users size={isMobile ? 22 : 20} />, badge: 0 },
    { path: '/settings', label: 'Settings', icon: <Settings size={isMobile ? 22 : 20} />, badge: 0 },
  ];

  return (
    <aside className="sidebar">
      {/* Logo — desktop only */}
      {!isMobile && (
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
      )}

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
              <div className="nav-icon-wrapper">
                {tab.icon}
                {tab.badge > 0 && (
                  <span className="nav-badge">{tab.badge > 9 ? '9+' : tab.badge}</span>
                )}
              </div>
              {isMobile && <span className="nav-label">{tab.label}</span>}
            </button>
          );
        })}
        {isMobile && (
          <button className="nav-item logout-nav-item" onClick={handleLogout} type="button">
            <div className="nav-icon-wrapper">
              <LogOut size={20} />
            </div>
            <span className="nav-label">Logout</span>
          </button>
        )}
      </nav>

      {!isMobile && (
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={handleLogout} data-tooltip="Logout" type="button">
            <LogOut size={20} />
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
