import React, { useEffect, useState } from 'react';
import { UserPlus, UserCheck, Inbox } from 'lucide-react';
import { API_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ContactCard from '../components/features/ContactCard';
import EmptyState from '../components/ui/EmptyState';
import AddContactModal from '../components/AddContactModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import '../components/ContactsTab.css';

interface RequestItem {
  id: string;
  senderId?: string;
  receiverId?: string;
  fromUserId?: string;
  toUserId?: string;
  fromUid?: string;
  toUid?: string;
  fromDisplayName?: string;
  toDisplayName?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'declined';
  createdAt: string;
}

export const ContactsPage: React.FC = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { fetchConversations, createConversation, setActiveConversation } = useChatStore();
  const currentUser = useAuthStore((s) => s.user);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentUser]);

  const handleAccept = async (id: string) => {
    // Optimistic UI: remove from list immediately
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/accept`, { 
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        await fetchConversations();
        loadRequests();
        
        // Auto-redirect to the chat with the added user
        if (data?.conversation?.id) {
          setActiveConversation(data.conversation.id);
          window.location.hash = '#/chats';
          window.history.pushState({}, '', '/chats');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } else {
        // Rollback on server error
        loadRequests();
      }
    } catch (err) {
      console.error('Accept failed:', err);
      loadRequests();
    }
  };

  const handleDecline = async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/decline`, { 
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      if (res.ok) {
        loadRequests();
      }
    } catch (err) {
      console.error('Decline failed:', err);
    }
  };

  // Filter requests
  const pendingRequests = requests.filter(
    (r) => r.status === 'pending' && (r.toUserId === currentUser?.id || r.receiverId === currentUser?.id)
  );

  const acceptedContacts = requests.filter(
    (r) => r.status === 'accepted'
  ).map((r) => {
    const isSender = (r.senderId || r.fromUserId) === currentUser?.id;
    return {
      id: isSender ? (r.receiverId || r.toUserId || '') : (r.senderId || r.fromUserId || ''),
      displayName: isSender ? (r.toDisplayName || 'Unknown') : (r.fromDisplayName || 'Unknown'),
      uid: isSender ? (r.toUid || '') : (r.fromUid || ''),
      avatarUrl: isSender ? ((r as any).toAvatarUrl || null) : ((r as any).fromAvatarUrl || null),
      status: isSender ? ((r as any).toStatus || 'offline') : ((r as any).fromStatus || 'offline'),
      lastSeen: isSender ? ((r as any).toLastSeen || '') : ((r as any).fromLastSeen || '')
    };
  });

  const startChat = async (uid: string) => {
    const newConvo = await createConversation(uid);
    if (newConvo) {
      setActiveConversation(newConvo.id);
      // Navigate to /chats (since we use routing now, redirects can be clean)
      window.location.hash = '#/chats'; // Fallback if routing uses hashes, but the standard redirect is clean
      window.history.pushState({}, '', '/chats');
      // Dispatch popstate event to trigger router reload
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="contacts-tab" style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div className="contacts-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Contacts</h2>
        <button 
          className="add-contact-btn" 
          onClick={() => setIsAddOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={16} /> Add Contact
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading your contact directory..." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {pendingRequests.length > 0 && (
            <div className="requests-list">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '15px' }}>
                <Inbox size={16} /> Incoming Requests ({pendingRequests.length})
              </h3>
              {pendingRequests.map((r) => {
                const name = r.fromDisplayName || 'Unknown';
                const uid = r.fromUid || 'SEC_UNKNOWN';
                const avatar = (r as any).fromAvatarUrl || null;
                return (
                  <ContactCard
                    key={r.id}
                    displayName={name}
                    uid={uid}
                    avatarUrl={avatar}
                    actions={
                      <>
                        <button className="btn" onClick={() => handleDecline(r.id)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                          Decline
                        </button>
                        <button className="btn btn-primary" onClick={() => handleAccept(r.id)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                          Accept
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}

          <div className="active-contacts-list">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '15px' }}>
              <UserCheck size={16} /> Secure Contacts ({acceptedContacts.length})
            </h3>
            {acceptedContacts.length > 0 ? (
              acceptedContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  displayName={contact.displayName}
                  uid={contact.uid}
                  avatarUrl={contact.avatarUrl}
                  status={contact.status}
                  lastSeen={contact.lastSeen}
                  actions={
                    <button className="btn btn-primary" onClick={() => startChat(contact.uid)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                      Secure Chat
                    </button>
                  }
                />
              ))
            ) : (
              pendingRequests.length === 0 && (
                <EmptyState
                  icon={<UserPlus size={32} />}
                  title="No contacts yet"
                  description="Add secure contacts by scanning their QR code or entering their 16-character secure ID."
                  actionButton={
                    <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
                      Add New Contact
                    </button>
                  }
                />
              )
            )}
          </div>
        </div>
      )}

      <AddContactModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)}
        onAddComplete={() => {
          setIsAddOpen(false);
          loadRequests();
        }}
      />
    </div>
  );
};

export default ContactsPage;
