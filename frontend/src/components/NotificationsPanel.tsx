import React, { useEffect, useState } from 'react';
import { connectSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../config/webrtc-config';
import './NotificationsPanel.css';

interface PendingReq {
  id: string;
  senderId: string;
  senderName?: string;
  senderUid?: string;
  senderAvatar?: string | null;
  createdAt: string;
}

const NotificationsPanel: React.FC = () => {
  const [requests, setRequests] = useState<PendingReq[]>([]);
  const user = useAuthStore((s) => s.user);

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/requests`, {
        headers: {
          'x-user-id': user?.id || 'self',
        },
      });
      if (res.ok) {
        const data = await res.json();
        // map incoming friendRequests shape to PendingReq
        const mapped = data.map((r: any) => ({ id: r.id, senderId: r.senderId || r.fromUserId, senderName: r.fromDisplayName || r.senderName || 'Unknown', senderUid: r.fromUid || r.senderUid || '', senderAvatar: r.senderAvatar || null, createdAt: r.createdAt }));
        setRequests(mapped.reverse());
      }
    } catch (err) {
      console.error('Load requests failed', err);
    }
  };

  useEffect(() => {
    load();

    const socket = connectSocket();
    // register current user
    if (user?.id) socket.emit('register', { userId: user.id });

    socket.on('request:new', (payload: any) => {
      const item: PendingReq = {
        id: payload.id,
        senderId: payload.fromUserId || payload.senderId,
        senderName: payload.fromDisplayName || payload.senderName || 'Unknown',
        senderUid: payload.fromUid || payload.senderUid || '',
        senderAvatar: payload.fromAvatar || payload.senderAvatar || null,
        createdAt: payload.createdAt,
      };
      setRequests((s) => [item, ...s]);
    });

    socket.on('request:accepted', (p: any) => {
      // Remove any matching request
      setRequests((s) => s.filter(r => r.id !== p.id));
    });

    socket.on('request:declined', (p: any) => {
      setRequests((s) => s.filter(r => r.id !== p.id));
    });

    return () => {
      const s = getSocket();
      s?.off('request:new');
      s?.off('request:accepted');
      s?.off('request:declined');
    };
  }, [user]);

  const accept = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || 'self',
        },
      });
      if (res.ok) load();
    } catch (err) {
      console.error(err);
    }
  };

  const decline = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/decline`, {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || 'self',
        },
      });
      if (res.ok) load();
    } catch (err) {
      console.error(err);
    }
  };

  if (requests.length === 0) return null;

  return (
    <aside className="notifications-panel">
      <h4>Requests</h4>
      <div className="requests-list">
        {requests.map((r) => (
          <div key={r.id} className="request-item">
            <div className="meta">
              <div className="avatar">{r.senderAvatar ? <img src={r.senderAvatar} alt="avatar" /> : r.senderName?.[0]}</div>
              <div className="text"><div className="name">{r.senderName}</div><div className="uid">{r.senderUid}</div></div>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => decline(r.id)}>✗</button>
              <button className="btn btn-primary" onClick={() => accept(r.id)}>✓</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default NotificationsPanel;
