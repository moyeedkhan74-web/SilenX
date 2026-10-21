import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  UserCheck, 
  Inbox, 
  Search, 
  XCircle, 
  Send,
  Users,
  QrCode,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  Lock,
  UserMinus,
  KeyRound
} from 'lucide-react';
import { API_URL } from '../config/webrtc-config';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ContactCard from '../components/features/ContactCard';
import AvatarDisplay from '../components/shared/AvatarDisplay';
import EmptyState from '../components/ui/EmptyState';
import AddContactModal from '../components/AddContactModal';
import CreateGroupModal from '../components/CreateGroupModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatLastSeen } from '../utils/date';
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

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('Delete this request permanently?')) return;
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
      });
    } catch (err) {
      console.error('Delete request failed:', err);
      loadRequests(true);
    }
  };

  const handleResendRequest = async (targetUserId: string, displayName: string) => {
    const confirmed = window.confirm(`Resend contact request to ${displayName}?`);
    if (!confirmed) return;
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) return;
    try {
      const res = await fetch(`${API_URL}/api/requests/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ receiverId: targetUserId }),
      });
      if (res.ok) {
        loadRequests(true);
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.message || 'Failed to resend request');
      }
    } catch (err) {
      console.error('Resend request failed:', err);
      alert('Network error while resending request');
    }
  };

  const pendingRequests = useMemo(() => {
    return requests.filter(
      (r) => r.status === 'pending' && (r.toUserId === currentUserId || r.receiverId === currentUserId)
    );
  }, [requests, currentUserId]);

  const outgoingRequests = useMemo(() => {
    return requests.filter(
      (r) => (r.status === 'pending' || r.status === 'rejected' || r.status === 'declined') &&
        (r.fromUserId === currentUserId || r.senderId === currentUserId)
    );
  }, [requests, currentUserId]);

  const formatCreated = (value?: string | Date) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

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

  const groupedContacts = useMemo(() => {
    const groups: Record<string, typeof filteredContacts> = {};
    const sorted = [...filteredContacts].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    for (const c of sorted) {
      const firstChar = c.displayName ? c.displayName.trim()[0] : '#';
      const letter = /^[A-Za-z]/.test(firstChar) ? firstChar.toUpperCase() : '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    }
    return groups;
  }, [filteredContacts]);

  const startChat = async (uid: string) => {
    const newConvo = await createConversation(uid);
    if (newConvo) {
      setActiveConversation(newConvo.id);
      navigate('/chats');
    }
  };

  return (
    <div className="contacts-tab">
      {/* ============================================================ */}
      {/* MOBILE VIEW (< 768px): Stitch Modern Utilitarian Flat Spec   */}
      {/* ============================================================ */}
      <div className="mobile-only contacts-mobile-wrapper">
        <header className="contacts-mobile-header">
          <div className="contacts-mobile-header__inner">
            <div className="contacts-mobile-header__brand">
              <img src="/silenX-logo.png" alt="SilenX" className="contacts-mobile-header__logo" />
              <h1 className="contacts-mobile-header__title">Contacts</h1>
            </div>
            <button 
              type="button" 
              className="contacts-mobile-header__add-btn" 
              onClick={() => setIsAddOpen(true)}
              aria-label="Add Contact"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </header>

        <div className="contacts-mobile-body">
          {/* Mobile Search Bar */}
          <div className="contacts-mobile-search">
            <Search size={18} className="contacts-mobile-search__icon" />
            <input 
              type="text" 
              placeholder="Search contacts or fingerprints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="contacts-mobile-search__input"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="contacts-mobile-search__clear"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Action Buttons: New Group & Scan / Add */}
          <div className="contacts-mobile-quick-actions">
            <button 
              type="button" 
              className="contacts-quick-btn" 
              onClick={() => setIsGroupOpen(true)}
            >
              <div className="contacts-quick-btn__icon">
                <Users size={20} />
              </div>
              <span className="contacts-quick-btn__label">New Group</span>
            </button>
            <button 
              type="button" 
              className="contacts-quick-btn" 
              onClick={() => setIsAddOpen(true)}
            >
              <div className="contacts-quick-btn__icon">
                <QrCode size={20} />
              </div>
              <span className="contacts-quick-btn__label">Scan / Add</span>
            </button>
          </div>

          {isLoading ? (
            <LoadingSpinner message="Loading your contact directory..." />
          ) : (
            <div className="contacts-mobile-content-stack">
              {/* Mobile Pending Requests */}
              {pendingRequests.length > 0 && (
                <div className="contacts-mobile-section">
                  <div className="contacts-mobile-section__header">
                    <span className="contacts-section-title--pending">
                      PENDING REQUESTS ({pendingRequests.length})
                    </span>
                    <span className="contacts-section-badge">
                      <ShieldCheck size={14} className="text-teal" />
                      E2E Handshakes
                    </span>
                  </div>
                  <div className="contacts-mobile-requests-list">
                    {pendingRequests.map((r) => {
                      const name = r.fromDisplayName || 'Unknown';
                      const uid = r.fromUid || 'SEC_UNKNOWN';
                      const avatar = (r as any).fromAvatarUrl || null;
                      return (
                        <div key={r.id} className="contacts-request-card">
                          <div className="contacts-request-card__top">
                            <AvatarDisplay name={name} avatarUrl={avatar} size={44} status="pending" />
                            <div className="contacts-request-card__info">
                              <div className="contacts-request-card__name-row">
                                <span className="contacts-request-card__name">{name}</span>
                                <ShieldCheck size={14} className="text-teal" />
                              </div>
                              <span className="contacts-request-card__sub">
                                <KeyRound size={12} />
                                {uid}
                              </span>
                            </div>
                          </div>
                          <div className="contacts-request-card__actions">
                            <button 
                              type="button" 
                              className="contacts-req-btn contacts-req-btn--decline" 
                              onClick={() => handleDecline(r.id)}
                            >
                              Decline
                            </button>
                            <button 
                              type="button" 
                              className="contacts-req-btn contacts-req-btn--accept" 
                              onClick={() => handleAccept(r.id)}
                            >
                              <Check size={14} />
                              Accept
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mobile Sent Requests */}
              {outgoingRequests.length > 0 && (
                <div className="contacts-mobile-section">
                  <div className="contacts-mobile-section__header">
                    <span className="contacts-section-title">
                      SENT REQUESTS ({outgoingRequests.length})
                    </span>
                  </div>
                  <div className="contacts-mobile-requests-list">
                    {outgoingRequests.map((r) => {
                      const name = r.toDisplayName || 'Unknown';
                      const uid = r.toUid || 'SEC_UNKNOWN';
                      const avatar = (r as any).toAvatarUrl || null;
                      const isRejected = r.status === 'rejected' || r.status === 'declined';
                      return (
                        <div key={r.id} className="contacts-request-card">
                          <div className="contacts-request-card__top">
                            <AvatarDisplay name={name} avatarUrl={avatar} size={44} status={isRejected ? 'rejected' : 'pending'} />
                            <div className="contacts-request-card__info">
                              <div className="contacts-request-card__name-row">
                                <span className="contacts-request-card__name">{name}</span>
                              </div>
                              <span className="contacts-request-card__sub">
                                <KeyRound size={12} />
                                {uid}
                              </span>
                            </div>
                          </div>
                          <div className="contacts-request-card__actions">
                            <button 
                              type="button" 
                              className="contacts-req-btn contacts-req-btn--decline" 
                              onClick={() => handleDeleteRequest(r.id)}
                            >
                              <XCircle size={14} />
                              {isRejected ? 'Delete' : 'Cancel'}
                            </button>
                            {isRejected && (
                              <button 
                                type="button" 
                                className="contacts-req-btn contacts-req-btn--accept" 
                                onClick={() => handleResendRequest((r as any).toUserId || '', name)}
                              >
                                <Send size={14} />
                                Resend
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mobile All Contacts Section */}
              <div className="contacts-mobile-section">
                <div className="contacts-mobile-section__header">
                  <span className="contacts-section-title">
                    All Contacts <span className="contacts-section-count">({filteredContacts.length})</span>
                  </span>
                  <span className="contacts-section-badge">
                    <Lock size={13} className="text-teal" />
                    Ephemeral enabled
                  </span>
                </div>

                {filteredContacts.length > 0 ? (
                  <div className="contacts-mobile-grouped-list">
                    {Object.keys(groupedContacts).sort().map((letter) => (
                      <div key={letter} className="contacts-mobile-group">
                        <div className="contacts-mobile-group__letter">
                          <span>{letter}</span>
                        </div>
                        <div className="contacts-mobile-group__items">
                          {groupedContacts[letter].map((contact) => (
                            <div 
                              key={contact.id} 
                              className="contacts-mobile-row"
                              onClick={() => startChat(contact.uid)}
                            >
                              <AvatarDisplay 
                                name={contact.displayName} 
                                avatarUrl={contact.avatarUrl} 
                                size={40} 
                                status={contact.status} 
                              />
                              <div className="contacts-mobile-row__info">
                                <div className="contacts-mobile-row__name-row">
                                  <span className="contacts-mobile-row__name">{contact.displayName}</span>
                                  <ShieldCheck size={14} className="text-teal" />
                                </div>
                                <span className={`contacts-mobile-row__sub ${contact.status === 'online' ? 'contacts-sub--active' : ''}`}>
                                  {contact.status === 'online' ? 'Active now' : contact.lastSeen ? `Last seen ${formatLastSeen(contact.lastSeen)}` : contact.uid}
                                </span>
                              </div>
                              <div className="contacts-mobile-row__actions" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  type="button" 
                                  className="contacts-mobile-row__chat-btn" 
                                  onClick={() => startChat(contact.uid)}
                                  aria-label={`Chat with ${contact.displayName}`}
                                >
                                  <MessageSquare size={18} />
                                </button>
                                <button 
                                  type="button" 
                                  className="contacts-mobile-row__more-btn" 
                                  onClick={() => handleUnfriend(contact.id, contact.displayName)}
                                  aria-label={`Unfriend ${contact.displayName}`}
                                  title="Remove contact"
                                >
                                  <UserMinus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="contacts-mobile-empty">
                    <Search size={32} className="text-muted" />
                    <p className="contacts-mobile-empty__title">No contacts found</p>
                    <p className="contacts-mobile-empty__desc">Try searching a different name or cryptographic fingerprint</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DESKTOP VIEW (> 768px): Unchanged Legacy Desktop Layout      */}
      {/* ============================================================ */}
      <div className="desktop-only contacts-desktop-view">
        <div className="contacts-header contacts-header-content">
          <h2>Contacts</h2>
          <div className="contacts-flex-row">
            <button 
              className="add-contact-btn group-btn" 
              onClick={() => setIsGroupOpen(true)}
            >
              <UserPlus size={16} /> Create Group
            </button>
            <button 
              className="add-contact-btn group-btn" 
              onClick={() => setIsAddOpen(true)}
            >
              <UserPlus size={16} /> Add Contact
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {requests.length > 0 && (
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search contacts by name or Secure ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner message="Loading your contact directory..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {pendingRequests.length > 0 && (
              <div className="requests-list">
                <h3 className="contact-h3">
                  <Inbox size={16} /> Incoming Requests ({pendingRequests.length})
                </h3>
                {pendingRequests.map((r) => {
                  const name = r.fromDisplayName || 'Unknown';
                  const uid = r.fromUid || 'SEC_UNKNOWN';
                  const avatar = (r as any).fromAvatarUrl || null;
                  const when = formatCreated(r.createdAt);
                  return (
                    <ContactCard
                      key={r.id}
                      displayName={name}
                      uid={uid}
                      avatarUrl={avatar}
                      status="pending"
                      lastSeen={when ? `Requested ${when}` : undefined}
                      actions={
                        <div className="contacts-flex-row">
                          <button className="btn action-btn" onClick={() => handleDecline(r.id)}>
                            Decline
                          </button>
                          <button className="btn btn-primary action-btn" onClick={() => handleAccept(r.id)}>
                            Accept
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}

            {outgoingRequests.length > 0 && (
              <div className="requests-list">
                <h3 className="section-header-row">
                  <Send size={16} /> Sent Requests ({outgoingRequests.length})
                </h3>
                {outgoingRequests.map((r) => {
                  const name = r.toDisplayName || 'Unknown';
                  const uid = r.toUid || 'SEC_UNKNOWN';
                  const avatar = (r as any).toAvatarUrl || null;
                  const isRejected = r.status === 'rejected' || r.status === 'declined';
                  const when = formatCreated(r.createdAt);
                  return (
                    <ContactCard
                      key={r.id}
                      displayName={name}
                      uid={uid}
                      avatarUrl={avatar}
                      status={isRejected ? 'rejected' : 'pending'}
                      lastSeen={when ? (isRejected ? `Rejected ${when}` : `Sent ${when}`) : undefined}
                      actions={
                        <div className="actions-flex">
                          {isRejected && (
                            <>
                              <button
                                className="btn btn-action btn-action--destructive"
                                onClick={() => handleDeleteRequest(r.id)}
                              >
                                <XCircle size={14} /> Delete
                              </button>
                              <button
                                className="btn btn-primary btn-action btn-action--primary-sm"
                                onClick={() => handleResendRequest((r as any).toUserId || '', name)}
                              >
                                <Send size={14} /> Resend
                              </button>
                            </>
                          )}
                          {!isRejected && (
                            <button
                              className="btn btn-action btn-action--destructive"
                              onClick={() => handleDeleteRequest(r.id)}
                            >
                              <XCircle size={14} /> Cancel
                            </button>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="active-contacts-list">
              <h3 className="section-header-row">
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
                      <div className="actions-flex">
                        <button className="btn btn-primary btn-action btn-action--primary-sm" onClick={() => startChat(contact.uid)}>
                          Secure Chat
                        </button>
                        <button
                          type="button"
                          className="btn btn-action btn-action--unfriend"
                          onClick={() => handleUnfriend(contact.id, contact.displayName)}
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
      </div>

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
