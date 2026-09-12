import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, Inbox, Search } from 'lucide-react';
import { API_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ContactCard from '../components/features/ContactCard';
import EmptyState from '../components/ui/EmptyState';
import AddContactModal from '../components/AddContactModal';
import CreateGroupModal from '../components/CreateGroupModal';
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
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  const { fetchConversations, createConversation, setActiveConversation } = useChatStore();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const hasLoadedRef = useRef(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadRequests = useCallback(async (silent = false) => {
    // Only toggle the full-screen loading spinner on the very first mount
    if (!hasLoadedRef.current && !silent) {
      setIsLoading(true);
    }
    try {
      const originatingUserId = useAuthStore.getState().user?.id;
      const currentToken = useAuthStore.getState().token;
      if (!currentToken) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/api/requests`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (useAuthStore.getState().user?.id !== originatingUserId) return;
        setRequests(data);
        hasLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch strictly on initial mount or when the authenticated user ID changes
  useEffect(() => {
    hasLoadedRef.current = false;
    setRequests([]);
    loadRequests();
  }, [currentUserId, loadRequests]);

  const handleAccept = async (id: string) => {
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) return;
    // Optimistic UI update
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/accept`, { 
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        await fetchConversations();
        loadRequests(true);

        if (data?.conversation?.id) {
          setActiveConversation(data.conversation.id);
          navigate('/chats');
        }
      } else {
        loadRequests(true);
      }
    } catch (err) {
      console.error('Accept failed:', err);
      loadRequests(true);
    }
  };

  const handleDecline = async (id: string) => {
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}/decline`, { 
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        }
      });
      if (!res.ok) {
        loadRequests(true);
      }
    } catch (err) {
      console.error('Decline failed:', err);
      loadRequests(true);
    }
  };

  const handleUnfriend = async (targetUserId: string, displayName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${displayName} from your contacts?`)) {
      return;
    }
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) return;
    setRequests((prev) =>
      prev.filter(
        (r) =>
          !((r.senderId === targetUserId || r.fromUserId === targetUserId) ||
            (r.receiverId === targetUserId || r.toUserId === targetUserId))
      )
    );

    try {
      await fetch(`${API_URL}/api/requests/friends/${encodeURIComponent(targetUserId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      loadRequests(true);
    } catch (err) {
      console.error('Unfriend failed:', err);
      loadRequests(true);
    }
  };

  // Filter pending requests with memoization
  const pendingRequests = useMemo(() => {
    return requests.filter(
      (r) => r.status === 'pending' && (r.toUserId === currentUserId || r.receiverId === currentUserId)
    );
  }, [requests, currentUserId]);

  // Filter accepted contacts with memoization and strict peer deduplication
  const acceptedContacts = useMemo(() => {
    const seenPeerIds = new Set<string>();
    const result: Array<{
      id: string;
      displayName: string;
      uid: string;
      avatarUrl: string | null;
      status: string;
      lastSeen: string;
    }> = [];

    for (const r of requests) {
      if (r.status !== 'accepted') continue;
      const isSender = (r.senderId || r.fromUserId) === currentUserId;
      const contactId = isSender ? (r.receiverId || r.toUserId || '') : (r.senderId || r.fromUserId || '');
      const contactUid = isSender ? (r.toUid || '') : (r.fromUid || '');

      if (!contactId || contactId === currentUserId || seenPeerIds.has(contactId)) {
        continue;
      }
      seenPeerIds.add(contactId);

      result.push({
        id: contactId,
        displayName: isSender ? (r.toDisplayName || 'Unknown') : (r.fromDisplayName || 'Unknown'),
        uid: contactUid,
        avatarUrl: isSender ? ((r as any).toAvatarUrl || null) : ((r as any).fromAvatarUrl || null),
        status: isSender ? ((r as any).toStatus || 'offline') : ((r as any).fromStatus || 'offline'),
        lastSeen: isSender ? ((r as any).toLastSeen || '') : ((r as any).fromLastSeen || '')
      });
    }

    return result;
  }, [requests, currentUserId]);

  const filteredContacts = useMemo(() => {
    if (!debouncedSearch.trim()) return acceptedContacts;
    const q = debouncedSearch.toLowerCase().trim();
    return acceptedContacts.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.uid.toLowerCase().includes(q)
    );
  }, [acceptedContacts, debouncedSearch]);

  const startChat = async (uid: string) => {
    const newConvo = await createConversation(uid);
    if (newConvo) {
      setActiveConversation(newConvo.id);
      navigate('/chats');
    }
  };

  return (
    <div className="contacts-tab" style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div className="contacts-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2>Contacts</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="add-contact-btn" 
            onClick={() => setIsGroupOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserPlus size={16} /> Create Group
          </button>
          <button 
            className="add-contact-btn" 
            onClick={() => setIsAddOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserPlus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {requests.length > 0 && (
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
          <input
            type="text"
            placeholder="Search contacts by name or Secure ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

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
              <UserCheck size={16} /> Secure Contacts ({filteredContacts.length})
            </h3>
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  displayName={contact.displayName}
                  uid={contact.uid}
                  avatarUrl={contact.avatarUrl}
                  status={contact.status}
                  lastSeen={contact.lastSeen}
                  actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" onClick={() => startChat(contact.uid)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                        Secure Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnfriend(contact.id, contact.displayName)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Unfriend
                      </button>
                    </div>
                  }
                />
              ))
            ) : (
              pendingRequests.length === 0 && (
                <EmptyState
                  icon={<UserPlus size={32} />}
                  title={debouncedSearch.trim() ? "No matching contacts found" : "No contacts yet"}
                  description={debouncedSearch.trim() ? "Try searching for a different name or Secure ID." : "Add secure contacts by scanning their QR code or entering their 16-character secure ID."}
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
          loadRequests(true);
        }}
      />

      <CreateGroupModal
        isOpen={isGroupOpen}
        contacts={acceptedContacts.map((contact) => ({
          id: contact.id,
          uid: contact.uid,
          displayName: contact.displayName,
          avatarUrl: contact.avatarUrl,
          status: contact.status,
        }))}
        onClose={() => setIsGroupOpen(false)}
        onCreateSuccess={(conversationId) => {
          setIsGroupOpen(false);
          setActiveConversation(conversationId);
          navigate('/chats');
        }}
      />
    </div>
  );
};

export default ContactsPage;
