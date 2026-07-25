import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video, RefreshCw, MoreVertical, Trash2 } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useAuthStore } from '../store/authStore';
import { webrtcService } from '../services/webrtc';
import { API_URL } from '../config/webrtc-config';

interface CallLogEntry {
  id: string;
  callType: 'audio' | 'video';
  status: 'pending' | 'accepted' | 'rejected' | 'missed' | 'ended';
  direction: 'incoming' | 'outgoing';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  otherUser: { id: string; displayName: string; avatarUrl: string | null };
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayDiff = Math.floor(diff / 86400000);
  if (dayDiff === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const CallsPage: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClearLogs = async () => {
    if (!token) return;
    const confirmClear = window.confirm('Are you sure you want to clear all call logs?');
    if (!confirmClear) return;
    try {
      const res = await fetch(`${API_URL}/api/calls/history`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to retrieve or clear call history');
      setLogs([]);
    } catch (err: any) {
      alert(err.message || 'Failed to clear logs');
    }
  };

  const handleDeleteIndividualLog = async (logId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/calls/history/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete call log');
      setLogs((prev) => prev.filter((log) => log.id !== logId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete log entry');
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showMenu]);

  const handleCallBack = async (targetUser: { id: string; displayName: string }, callType: 'audio' | 'video') => {
    if (!currentUser?.displayName) return;
    await webrtcService.startCall(
      targetUser.id,
      callType,
      targetUser.displayName,
      currentUser.displayName,
      currentUser.avatarUrl || undefined
    );
  };

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/calls/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load call history');
      const data: CallLogEntry[] = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getStatusIcon = (log: CallLogEntry) => {
    if (log.status === 'missed') return <PhoneMissed size={16} className="call-log-status-icon missed" />;
    if (log.direction === 'incoming') return <PhoneIncoming size={16} className="call-log-status-icon incoming" />;
    return <PhoneOutgoing size={16} className="call-log-status-icon outgoing" />;
  };

  const getStatusLabel = (log: CallLogEntry): string => {
    if (log.status === 'missed') return 'Missed';
    if (log.status === 'rejected') return log.direction === 'outgoing' ? 'Declined' : 'Rejected';
    if (log.status === 'ended') return log.direction === 'incoming' ? 'Incoming' : 'Outgoing';
    if (log.status === 'accepted') return 'In Progress';
    if (log.status === 'pending') return 'Not Answered';
    return log.direction === 'incoming' ? 'Incoming' : 'Outgoing';
  };

  return (
    <div className="calls-page">
      <style>{`
        .calls-page {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
          overflow: hidden;
        }

        .calls-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-primary);
          flex-shrink: 0;
        }

        .calls-header h1 {
          font-size: 1.4rem;
          font-weight: 700;
          margin: 0;
          color: var(--text-primary);
        }

        .calls-refresh-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .calls-refresh-btn:hover {
          background: var(--bg-hover);
          color: var(--color-primary);
        }

        .calls-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .calls-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--text-secondary);
          padding: 40px;
          text-align: center;
        }

        .calls-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .calls-empty h3 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .calls-empty p {
          margin: 4px 0 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .call-log-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 20px;
          cursor: pointer;
          transition: background 0.15s;
          position: relative;
        }

        .call-log-item:hover {
          background: var(--bg-hover);
        }

        .call-log-avatar {
          flex-shrink: 0;
          position: relative;
        }

        .call-type-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--bg-secondary);
          border: 2px solid var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }

        .call-log-info {
          flex: 1;
          min-width: 0;
        }

        .call-log-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary);
          margin: 0 0 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .call-log-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .call-log-status-icon {
          flex-shrink: 0;
        }

        .call-log-status-icon.missed { color: #ef4444; }
        .call-log-status-icon.incoming { color: #22c55e; }
        .call-log-status-icon.outgoing { color: var(--color-primary); }

        .call-log-status-label.missed { color: #ef4444; }

        .call-log-duration {
          opacity: 0.65;
          font-size: 0.78rem;
        }

        .call-log-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--text-secondary);
          opacity: 0.5;
          flex-shrink: 0;
        }

        .call-log-time {
          font-size: 0.78rem;
          color: var(--text-secondary);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .call-log-item--missed .call-log-name {
          color: #ef4444;
        }

        .call-log-delete-btn {
          opacity: 0;
          transition: all 0.2s ease-in-out;
        }

        .call-log-item:hover .call-log-delete-btn {
          opacity: 1;
        }

        .call-log-delete-btn:hover {
          color: #ef4444 !important;
          background: var(--bg-hover) !important;
        }

        .calls-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .calls-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #ef4444;
          padding: 40px;
          text-align: center;
        }
      `}</style>

      <div className="calls-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="calls-menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              title="Menu"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '50%',
                transition: 'background 0.2s',
              }}
            >
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <div
                className="calls-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 100,
                  minWidth: '155px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    handleClearLogs();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={14} />
                  Clear call logs
                </button>
              </div>
            )}
          </div>
          <h1>📞 Calls</h1>
        </div>
        <button type="button" className="calls-refresh-btn" onClick={fetchLogs} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="calls-loading">Loading call history…</div>
      ) : error ? (
        <div className="calls-error">
          <p>{error}</p>
          <button type="button" onClick={fetchLogs} style={{ padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="calls-empty">
          <div className="calls-empty-icon">
            <Phone size={32} color="var(--text-secondary)" />
          </div>
          <h3>No Call History</h3>
          <p>Your incoming and outgoing calls will appear here with duration.</p>
        </div>
      ) : (
        <div className="calls-list">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`call-log-item ${log.status === 'missed' ? 'call-log-item--missed' : ''}`}
              onClick={() => handleCallBack(log.otherUser, log.callType)}
            >
              <div className="call-log-avatar">
                <Avatar
                  name={log.otherUser.displayName}
                  size={48}
                  avatarUrl={log.otherUser.avatarUrl ?? undefined}
                />
                <div className="call-type-badge" title={log.callType === 'video' ? 'Video Call' : 'Voice Call'}>
                  {log.callType === 'video'
                    ? <Video size={10} />
                    : <Phone size={10} />
                  }
                </div>
              </div>

              <div className="call-log-info">
                <p className="call-log-name">{log.otherUser.displayName}</p>
                <div className="call-log-meta">
                  {getStatusIcon(log)}
                  <span className={`call-log-status-label ${log.status === 'missed' ? 'missed' : ''}`}>
                    {getStatusLabel(log)}
                  </span>
                  {log.durationSeconds !== null && log.durationSeconds > 0 && (
                    <>
                      <span className="call-log-dot" />
                      <span className="call-log-duration">{formatDuration(log.durationSeconds)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="call-log-time" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>{formatTime(log.startedAt)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    title="Remove from call log"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteIndividualLog(log.id);
                    }}
                    className="call-log-delete-btn"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    title={`Call ${log.otherUser.displayName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCallBack(log.otherUser, log.callType);
                    }}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {log.callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallsPage;
