import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import './ContactsTab.css';
import { useChatStore } from '../store/chatStore';
import { API_URL } from '../config/webrtc-config';

interface ContactsTabProps {
  onAddClick: () => void;
}

interface IncomingRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUid: string;
  fromDisplayName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

const ContactsTab: React.FC<ContactsTabProps> = ({ onAddClick }) => {
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const { fetchConversations } = useChatStore();

  const loadRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/api/requests`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.map((r: any) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() })));
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAccept = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/accept`, { method: 'POST' });
      if (res.ok) {
        await fetchConversations();
        loadRequests();
      }
    } catch (err) {
      console.error('Accept failed:', err);
    }
  };

  const handleDecline = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/decline`, { method: 'POST' });
      if (res.ok) {
        loadRequests();
      }
    } catch (err) {
      console.error('Decline failed:', err);
    }
  };

  return (
    <div className="contacts-tab">
      <div className="contacts-header">
        <h2>Contacts</h2>
        <button className="add-contact-btn" onClick={onAddClick}>+ Add Contact</button>
      </div>

      {requests.length > 0 ? (
        <div className="requests-list">
          <h3>Incoming Requests</h3>
          {requests.map((r) => (
            <div key={r.id} className="request-item">
              <div className="request-meta">
                <div className="request-name">{r.fromDisplayName || 'Unknown'}</div>
                <div className="request-uid">{r.fromUid}</div>
              </div>
              <div className="request-actions">
                <button className="btn" onClick={() => handleDecline(r.id)}>Decline</button>
                <button className="btn btn-primary" onClick={() => handleAccept(r.id)}>Accept</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="contacts-empty">
          <div className="empty-icon-wrap">
            <UserPlus size={32} strokeWidth={1.5} />
          </div>
          <p className="contacts-empty-title">No contacts yet</p>
          <p className="contacts-empty-subtext">Add secure contacts by scanning their QR code or entering their 16-character secure ID.</p>
          <button className="btn btn-primary" onClick={onAddClick}>Add New Contact</button>
        </div>
      )}
    </div>
  );
};

export default ContactsTab;
