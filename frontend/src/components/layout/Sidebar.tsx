import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Users, Settings, LogOut, Phone, AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../config/firebase';
import { getSocket } from '../../services/socket';
import { API_URL } from '../../config/webrtc-config';
import { useIsMobile } from '../../hooks/useIsMobile';
import '../Sidebar.css';

interface SidebarProps {}

export const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [pendingCount, setPendingCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    console.log('[Auth] Confirmed sign out. Clearing session.');
    logout();
    auth?.signOut().catch(() => {});
    navigate('/login');
  };

  const currentPath = location.pathname;

  const tabs = [
    { path: '/chats', label: 'Chats', icon: <MessageCircle size={isMobile ? 22 : 20} />, badge: 0 },
    { path: '/contacts', label: 'Contacts', icon: <Users size={isMobile ? 22 : 20} />, badge: pendingCount },
    { path: '/calls', label: 'Calls', icon: <Phone size={isMobile ? 22 : 20} />, badge: 0 },
    { path: '/settings', label: 'Settings', icon: <Settings size={isMobile ? 22 : 20} />, badge: 0 },
  ];

  return (
    <aside className="sidebar">
      {/* Double Verification Logout Modal rendered at root body level via Portal */}
      {showLogoutConfirm &&
        ReactDOM.createPortal(
          <div className="login-auth-overlay" role="dialog" aria-modal="true" style={{ zIndex: 9999 }}>
            <div className="google-modal-card" style={{ textAlign: 'center', padding: '24px 20px', maxWidth: '340px', width: '90%' }}>
              <button
                className="google-modal-close"
                onClick={() => setShowLogoutConfirm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <div style={{ margin: '0 auto 12px', width: 48, height: 48, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={26} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>Sign Out</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.4 }}>
                Are you sure you want to sign out of SlienX? You will need to sign in again to access your workspace.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: 'pointer'
                  }}
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Logo — desktop only */}
      {!isMobile && (
        <div className="sidebar-logo" aria-label="SlienX">
          <img src="/silenX-logo.png" alt="SilenX logo" />
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
                  <span key={tab.badge} className="nav-badge">{tab.badge > 9 ? '9+' : tab.badge}</span>
                )}
              </div>
              {isMobile && <span className="nav-label">{tab.label}</span>}
            </button>
          );
        })}
        {isMobile && (
          <button className="nav-item logout-nav-item" onClick={handleLogoutClick} type="button">
            <div className="nav-icon-wrapper">
              <LogOut size={20} />
            </div>
            <span className="nav-label">Logout</span>
          </button>
        )}
      </nav>

      {!isMobile && (
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={handleLogoutClick} data-tooltip="Logout" type="button">
            <LogOut size={20} />
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
