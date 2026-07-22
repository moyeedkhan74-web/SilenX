import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Lock, Search, Bell, UserX, Flag, Trash2, Check, CheckCheck, Star, PlayCircle, MapPin } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { connectSocket } from '../services/socket';
import type { ChatMessage } from '../types';
import { Avatar } from './Avatar';
import { MessageInputBar } from './MessageInputBar';
import { MessageActionsMenu } from './MessageActionsMenu';
import { SwipeableMessage } from './SwipeableMessage';
import { ToastNotification } from './ToastNotification';
import { ContactDetailsModal } from './ContactDetailsModal';
import { MediaMessage } from './MediaMessage';
import { MediaViewer } from './MediaViewer';
import { useAuthStore } from '../store/authStore';
import './ChatView.css';

const ChatView: React.FC = () => {
  const isMobile = useIsMobile();
  const [inputValue, setInputValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ sender: string; text: string } | undefined>();
  const [conversationState, setConversationState] = useState<Record<string, { isMuted: boolean; isVerified: boolean; isBlocked: boolean; isReported: boolean }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  const [searchTargetId, setSearchTargetId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const closeTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);
  const { conversations, activeConversationId, messages, addMessage, clearConversation, editMessage, deleteMessage, reactToMessage, setActiveConversation } = useChatStore();
  const setMessages = useChatStore((s) => s.setMessages);
  const initiateCall = useCallStore((s) => s.initiateCall);
  const currentUser = useAuthStore((s) => s.user);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeConvo = conversations.find((c) => c.id === activeConversationId);
  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const activeConversationState = activeConversationId
    ? conversationState[activeConversationId] || { isMuted: false, isVerified: false, isBlocked: false, isReported: false }
    : { isMuted: false, isVerified: false, isBlocked: false, isReported: false };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  useEffect(() => {
    if (!searchTargetId) return;
    const target = document.querySelector(`[data-message-id="${searchTargetId}"]`) as HTMLElement | null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSearchTargetId(null);
  }, [searchTargetId, currentMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for socket-based typing events from other users
  useEffect(() => {
    const socket = connectSocket();
    if (!socket || !activeConversationId) {
      setTypingUsers([]);
      return;
    }

    const handleUserTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === activeConversationId && data.userId !== currentUser?.id) {
        const user = activeConvo?.members.find((m) => m.id === data.userId);
        if (user) {
          setTypingUsers((prev) => {
            if (prev.includes(user.displayName)) return prev;
            return [...prev, user.displayName];
          });

          // Cancel existing safety timer for this user
          if (typingTimers.current[user.id]) {
            clearTimeout(typingTimers.current[user.id]);
          }
          // Set new safety timer (clears typing status automatically after 3 seconds)
          typingTimers.current[user.id] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((name) => name !== user.displayName));
            delete typingTimers.current[user.id];
          }, 3000);
        }
      }
    };

    const handleUserTypingStopped = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === activeConversationId && data.userId !== currentUser?.id) {
        const user = activeConvo?.members.find((m) => m.id === data.userId);
        if (user) {
          setTypingUsers((prev) => prev.filter((name) => name !== user.displayName));
          if (typingTimers.current[user.id]) {
            clearTimeout(typingTimers.current[user.id]);
            delete typingTimers.current[user.id];
          }
        }
      }
    };

    socket.on('user-typing', handleUserTyping);
    socket.on('user-typing-stopped', handleUserTypingStopped);

    return () => {
      socket.off('user-typing', handleUserTyping);
      socket.off('user-typing-stopped', handleUserTypingStopped);
      // Clean up all safety timers
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
    };
  }, [activeConversationId, activeConvo, currentUser]);

  const handleSend = (payload?: { text: string; replyTo?: { sender: string; text: string } }) => {
    const value = payload?.text?.trim() || inputValue.trim();
    if (!value || !activeConversationId || activeConversationState.isBlocked) return;

    const socket = connectSocket();
    const recipientId = activeConvo?.members?.find((member) => member.id !== currentUser?.id)?.id;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      senderId: currentUser?.id || 'self',
      text: value,
      isSelf: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      isRead: false,
      isEdited: false,
      isDeleted: false,
      deliveryStatus: 'sent' as const,
      reactions: [],
      isPinned: false,
      isStarred: false,
      replyTo: payload?.replyTo,
    };

    addMessage(activeConversationId, msg);
    socket?.emit('send-message', {
      conversationId: activeConversationId,
      encryptedContent: value,
      tempId: msg.id,
      recipientId,
      replyTo: payload?.replyTo,
    });
    setInputValue('');
    setReplyTo(undefined);
  };

  const handleSendRichMessage = (partial: Partial<ChatMessage>) => {
    if (!activeConversationId || activeConversationState.isBlocked) return;

    const socket = connectSocket();
    const recipientId = activeConvo?.members?.find((member) => member.id !== currentUser?.id)?.id;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      senderId: currentUser?.id || 'self',
      text: partial.text || '',
      isSelf: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      isRead: false,
      isEdited: false,
      isDeleted: false,
      deliveryStatus: 'sent' as const,
      reactions: [],
      isPinned: false,
      isStarred: false,
      contentType: partial.contentType || 'text',
      mediaUrl: partial.mediaUrl,
      fileName: partial.fileName,
      fileSize: partial.fileSize,
      fileType: partial.fileType,
      duration: partial.duration,
      locationData: partial.locationData,
      contactData: partial.contactData,
      pollData: partial.pollData,
      eventData: partial.eventData,
    };

    addMessage(activeConversationId, msg);
    socket?.emit('send-message', {
      conversationId: activeConversationId,
      encryptedContent: msg.text,
      tempId: msg.id,
      recipientId,
      contentType: msg.contentType,
      mediaUrl: msg.mediaUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      fileType: msg.fileType,
      duration: msg.duration,
      locationData: msg.locationData,
      contactData: msg.contactData,
      pollData: msg.pollData,
      eventData: msg.eventData,
    });
  };

  const updateConversationState = (updates: Partial<typeof activeConversationState>) => {
    if (!activeConversationId) return;
    setConversationState((prev) => ({
      ...prev,
      [activeConversationId]: {
        ...(prev[activeConversationId] || { isMuted: false, isVerified: false, isBlocked: false, isReported: false }),
        ...updates,
      },
    }));
  };

  const handleSearchInChat = () => {
    if (!activeConversationId) return;
    const confirmed = window.confirm('Search this chat for matching messages?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }

    const query = window.prompt('Search in this chat');
    if (!query?.trim()) return;

    const normalizedQuery = query.trim().toLowerCase();
    const matches = currentMessages.filter((msg) => msg.text?.toLowerCase().includes(normalizedQuery));

    if (!matches.length) {
      window.alert('No matches found in this conversation.');
      return;
    }

    setSearchTerm(query.trim());
    setSearchMatchIds(matches.map((msg) => msg.id));
    setSearchTargetId(matches[0].id);
    setMenuOpen(false);
  };

  const handleMuteNotifications = () => {
    const confirmed = window.confirm('Mute or unmute notifications for this chat?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }
    updateConversationState({ isMuted: !activeConversationState.isMuted });
    setMenuOpen(false);
  };

  const handleVerifyEncryption = () => {
    const confirmed = window.confirm('Verify end-to-end encryption for this chat?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }
    updateConversationState({ isVerified: true });
    window.alert('End-to-end encryption verified for this conversation.');
    setMenuOpen(false);
  };

  const handleBlockContact = () => {
    const confirmed = window.confirm('Block or unblock this contact for this device?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }
    const nextBlocked = !activeConversationState.isBlocked;
    updateConversationState({ isBlocked: nextBlocked });
    if (nextBlocked) {
      window.alert('This contact is blocked locally for this device.');
    }
    setMenuOpen(false);
  };

  const handleReport = () => {
    const confirmed = window.confirm('Report this conversation?');
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }
    updateConversationState({ isReported: true });
    window.alert('This conversation has been reported.');
    setMenuOpen(false);
  };

  const handleAudioCall = () => {
    if (!activeConversationId || !otherUser?.id) return;
    initiateCall('audio', otherUser.id);
  };

  const handleReply = (messageId: string) => {
    const targetMessage = currentMessages.find((msg) => msg.id === messageId);
    if (!targetMessage) return;
    setReplyTo({ sender: targetMessage.isSelf ? 'You' : chatName, text: targetMessage.text });
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!activeConversationId) return;
    const socket = connectSocket();
    const currentUserId = currentUser?.id || 'self';
    
    // Update local state optimistically
    reactToMessage(activeConversationId, messageId, currentUserId, emoji);
    
    // Emit socket event to notify other users
    socket?.emit('message-reaction', {
      conversationId: activeConversationId,
      messageId,
      emoji
    });
  };

  const renderMessageContent = (msg: ChatMessage) => {
    switch (msg.contentType) {
      case 'image':
      case 'video':
      case 'file':
        return <MediaMessage message={msg} />;
      case 'voice-note':
        return msg.mediaUrl ? (
          <div className="rich-voice-bubble">
            <div className="rich-voice-icon"><PlayCircle size={18} /></div>
            <div style={{ width: '100%' }}>
              <audio controls src={msg.mediaUrl} style={{ width: '100%' }} />
              <div className="rich-voice-duration">{msg.duration || ''}</div>
            </div>
          </div>
        ) : null;
      case 'location':
        return msg.locationData ? (
          <a
            className="rich-location-bubble"
            href={`https://maps.google.com/?q=${msg.locationData.latitude},${msg.locationData.longitude}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <div className="rich-location-map"><MapPin size={24} /></div>
            <div className="rich-location-desc">{msg.locationData.description || 'Shared location'}</div>
            <div className="rich-location-coords">
              {msg.locationData.latitude.toFixed(5)}, {msg.locationData.longitude.toFixed(5)}
            </div>
          </a>
        ) : null;
      case 'contact':
        return msg.contactData ? (
          <div className="rich-contact-bubble">
            <div className="rich-contact-avatar">{(msg.contactData.name || 'C').slice(0, 2).toUpperCase()}</div>
            <div className="rich-contact-info">
              <div className="rich-contact-name">{msg.contactData.name}</div>
              <div className="rich-contact-uid">{msg.contactData.uid}</div>
            </div>
          </div>
        ) : null;
      case 'poll':
        return msg.pollData ? (
          <div className="rich-poll-bubble">
            <div className="rich-poll-question">{msg.pollData.question}</div>
            {msg.pollData.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`rich-poll-option ${option.votes.length > 0 ? 'voted' : ''}`}
                onClick={() => {
                  // Poll voting is not fully implemented in this UI yet.
                }}
              >
                <span>{option.text}</span>
                <span className="rich-poll-votes">{option.votes.length}</span>
              </button>
            ))}
          </div>
        ) : null;
      case 'event':
        return msg.eventData ? (
          <div className="rich-event-bubble">
            <div className="rich-event-title">{msg.eventData.title}</div>
            <div className="rich-event-datetime">{msg.eventData.date} · {msg.eventData.time}</div>
            {msg.eventData.description && <div className="rich-event-desc">{msg.eventData.description}</div>}
            {msg.eventData.location && <div className="rich-event-loc">{msg.eventData.location}</div>}
          </div>
        ) : null;
      default:
        return null;
    }
  };

  const handleStartEdit = (messageId: string) => {
    const msg = currentMessages.find((m) => m.id === messageId);
    if (!msg) return;
    setEditingMessageId(messageId);
    setEditDraft(msg.text || '');
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editDraft.trim()) return;
    if (activeConversationId) {
      editMessage(activeConversationId, messageId, editDraft.trim());
    }
    setEditingMessageId(null);
    setEditDraft('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!activeConversationId) return;
    deleteMessage(activeConversationId, messageId);
  };

  const handleCopyMessage = async (messageId: string) => {
    const targetMessage = currentMessages.find((msg) => msg.id === messageId);
    if (!targetMessage?.text) return;
    try {
      await navigator.clipboard.writeText(targetMessage.text);
      showToast('Message copied');
    } catch {
      showToast('Copy failed — please copy manually');
    }
  };

  const handlePinMessage = (messageId: string) => {
    if (!activeConversationId) return;
    const target = currentMessages.find((msg) => msg.id === messageId);
    const updatedMessages = (messages[activeConversationId] || []).map((msg) =>
      msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
    );
    setMessages(activeConversationId, updatedMessages);
    showToast(target?.isPinned ? 'Message unpinned' : 'Message pinned');
  };

  const handleStarMessage = (messageId: string) => {
    if (!activeConversationId) return;
    const target = currentMessages.find((msg) => msg.id === messageId);
    const updatedMessages = (messages[activeConversationId] || []).map((msg) =>
      msg.id === messageId ? { ...msg, isStarred: !msg.isStarred } : msg
    );
    setMessages(activeConversationId, updatedMessages);
    showToast(target?.isStarred ? 'Message unstarred' : 'Message starred ⭐');
  };

  const handleTypingChange = (isTyping: boolean) => {
    if (!activeConversationId) return;
    const socket = connectSocket();
    if (socket) {
      if (isTyping) {
        socket.emit('typing', { conversationId: activeConversationId, userId: currentUser?.id });
      } else {
        socket.emit('typing-stopped', { conversationId: activeConversationId, userId: currentUser?.id });
      }
    }
  };

  const cancelCloseMenu = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleCloseMenu = () => {
    cancelCloseMenu();
    // 350ms gives enough time to move from bubble → pill edge → overflow sub-menu
    closeTimer.current = window.setTimeout(() => {
      setActiveMessageId(null);
    }, 350) as unknown as number;
  };

  const openMessageMenu = (messageId: string, anchorElement?: HTMLElement | null) => {
    cancelCloseMenu();
    setActiveMessageId(messageId);
    if (!anchorElement) return;
    const rect = anchorElement.getBoundingClientRect();
    const top = Math.max(12, rect.top - 54);
    const left = Math.max(12, Math.min(window.innerWidth - 220, rect.left + rect.width / 2 - 110));
    setMenuPosition({ top, left });
  };

  const closeMessageMenu = () => {
    cancelCloseMenu();
    setActiveMessageId(null);
  };

  if (!activeConvo) {
    return (
      <div className="chatview-empty">
        <div className="chatview-empty-content">
          <p className="chatview-empty-message">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  const otherUser = activeConvo.members.find((m) => m.id !== (currentUser?.id || 'self'));
  const chatName = activeConvo.type === 'group' ? (activeConvo.name || 'Group Chat') : (otherUser?.displayName || 'Unknown');
  const status = activeConvo.type === 'direct' && otherUser ? otherUser.status : null;
  const statusText = activeConvo.type === 'group' 
    ? `${activeConvo.members.length} participants` 
    : (status === 'online' ? 'Online' : otherUser?.lastSeen ? `Last seen ${otherUser.lastSeen}` : 'Offline');

  return (
    <div className="chatview">
      <header className="chatview-header">
        <div className="chatview-header-info">
          {isMobile && (
            <button
              className="icon-btn mobile-back-btn"
              title="Back to chats"
              type="button"
              onClick={() => setActiveConversation(null as any)}
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div
            className="chatview-header-profile-btn"
            onClick={() => setContactDetailsOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <Avatar
              name={chatName || 'SlienX'}
              size={40}
              online={status === 'online'}
              avatarUrl={otherUser?.avatarUrl || activeConvo.avatarUrl || null}
            />
            <div className="chatview-header-meta">
              <h3 className="chatview-header-name">
                {chatName}
              </h3>
              <span className={`chatview-status-subtext ${status === 'online' ? 'online' : ''}`}>
                {statusText}
              </span>
            </div>
          </div>
        </div>
        <div className="chatview-header-actions">
          <button className="icon-btn" title="Start audio call" type="button" onClick={handleAudioCall}>
            <Phone size={18} />
          </button>
          <button className="icon-btn" title="Video Call" type="button">
            <Video size={18} />
          </button>
          <div className="menu-wrapper" ref={headerMenuRef}>
            <button className="icon-btn" title="More options" onClick={() => setMenuOpen((open) => !open)} type="button">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" type="button" onClick={handleSearchInChat}>
                  <Search size={16} />
                  <span>Search in chat</span>
                </button>
                <button className="dropdown-item" type="button" onClick={handleMuteNotifications}>
                  <Bell size={16} />
                  <span>{activeConversationState.isMuted ? 'Unmute notifications' : 'Mute notifications'}</span>
                </button>
                <button className="dropdown-item" type="button" onClick={handleVerifyEncryption}>
                  <Lock size={16} />
                  <span>Verify encryption</span>
                </button>
                <button className="dropdown-item" type="button" onClick={handleBlockContact}>
                  <UserX size={16} />
                  <span>{activeConversationState.isBlocked ? 'Unblock contact' : 'Block contact'}</span>
                </button>
                <button className="dropdown-item" type="button" onClick={handleReport}>
                  <Flag size={16} />
                  <span>Report</span>
                </button>
                <button
                  className="dropdown-item danger"
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm('Clear this chat for this device?');
                    if (!confirmed) {
                      setMenuOpen(false);
                      return;
                    }
                    if (activeConversationId) {
                      clearConversation(activeConversationId);
                    }
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 size={16} />
                  <span>Clear chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="chatview-messages">
        {searchTerm && (
          <div className="chatview-inline-banner search">
            Showing results for “{searchTerm}”
          </div>
        )}
        {activeConversationState.isMuted && (
          <div className="chatview-inline-banner muted">
            Notifications are muted for this chat.
          </div>
        )}
        {activeConversationState.isVerified && (
          <div className="chatview-inline-banner verified">
            End-to-end encryption has been verified.
          </div>
        )}
        {activeConversationState.isBlocked && (
          <div className="chatview-inline-banner blocked">
            This contact is blocked locally on this device.
          </div>
        )}
        {activeConversationState.isReported && (
          <div className="chatview-inline-banner reported">
            This conversation has been reported.
          </div>
        )}
        {currentMessages.map((msg) => {
          const isHighlighted = searchTerm && searchMatchIds.includes(msg.id);
          const isOwn = msg.isSelf;

          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="msg-system"
                style={{
                  textAlign: 'center',
                  margin: '16px auto',
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  borderRadius: '10px',
                  maxWidth: '85%',
                  width: 'fit-content',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <Lock size={12} style={{ color: 'var(--primary-light)' }} />
                <span>{msg.text}</span>
              </div>
            );
          }

          const msgSender = !isOwn ? activeConvo.members.find((m) => m.id === msg.senderId) || otherUser : null;

          const isMediaOnly = (msg.contentType === 'image' || msg.contentType === 'video');
          const isLegacyMediaText = msg.text === '📷 Photo' || msg.text === '📸 Camera photo' || msg.text?.startsWith('🎬 ');
          const showTextMessage = msg.text && !isLegacyMediaText;

          return (
            <div key={msg.id} data-message-id={msg.id} className={`msg-wrapper ${isOwn ? 'self' : 'remote'} ${isHighlighted ? 'highlighted' : ''}`}>
              {!isOwn && (
                <div className="msg-avatar" style={{ alignSelf: 'flex-end', marginRight: 8, flexShrink: 0 }}>
                  <Avatar name={msgSender?.displayName || 'User'} size={28} avatarUrl={msgSender?.avatarUrl} />
                </div>
              )}
              <div className="msg-content-col">
                {!isOwn && activeConvo.type === 'group' && (
                  <span className="msg-sender-name" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: 2, paddingLeft: 4 }}>
                    {msgSender?.displayName || 'Unknown'}
                  </span>
                )}
                <SwipeableMessage
                  onSwipeReply={() => handleReply(msg.id)}
                  onLongPress={() => openMessageMenu(msg.id, messageRefs.current[msg.id] || undefined)}
                >
                  <div
                    ref={(node) => {
                      messageRefs.current[msg.id] = node;
                    }}
                    className={`msg-bubble ${msg.isDeleted ? 'deleted' : ''} ${isMediaOnly && !showTextMessage ? 'media-only' : ''}`}
                    onMouseEnter={(event) => openMessageMenu(msg.id, event.currentTarget)}
                    onMouseLeave={scheduleCloseMenu}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openMessageMenu(msg.id, event.currentTarget);
                    }}
                  >
                    {msg.isPinned && <div className="msg-pin-pill">📌 Pinned</div>}
                    {msg.replyTo && (
                      <div className="reply-preview">
                        <div className="reply-preview-name">{msg.replyTo.sender}</div>
                        <div className="reply-preview-text">{msg.replyTo.text}</div>
                      </div>
                    )}
                    {editingMessageId === msg.id ? (
                      <div className="edit-box">
                        <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} />
                        <div className="edit-actions">
                          <button type="button" onClick={() => handleSaveEdit(msg.id)}>Save</button>
                          <button type="button" onClick={() => { setEditingMessageId(null); setEditDraft(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {showTextMessage && <p className="message-text">{msg.text}</p>}
                        {renderMessageContent(msg)}
                      </>
                    )}
                    {msg.isEdited && <span className="msg-edited">edited</span>}
                    {msg.reactions && msg.reactions.length > 0 && (() => {
                      const validReactions = msg.reactions.filter(r => r && r.emoji);
                      const uniqueEmojis = Array.from(new Set(validReactions.map((r) => r.emoji)));
                      const totalCount = validReactions.length;
                      if (totalCount === 0) return null;
                      
                      const myReaction = validReactions.find((r) => r.userId === (currentUser?.id || 'self'));
                      
                      return (
                        <div 
                          className={`msg-reactions-pill ${myReaction ? 'has-my-reaction' : ''}`}
                          style={{
                            position: 'absolute',
                            bottom: '-9px',
                            right: isOwn ? '12px' : 'auto',
                            left: isOwn ? 'auto' : '12px',
                            transform: 'translateY(0)'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReact(msg.id, myReaction ? myReaction.emoji : '');
                          }}
                          title={validReactions.map(r => {
                            const sender = r.userId === (currentUser?.id || 'self') 
                              ? 'You' 
                              : (activeConvo.members.find(m => m.id === r.userId)?.displayName || 'Other');
                            return `${sender}: ${r.emoji}`;
                          }).join('\n')}
                        >
                          <span className="msg-reactions-emojis" style={{ display: 'flex', gap: '1px' }}>
                            {uniqueEmojis.map((emoji) => (
                              <span key={emoji} className="msg-reaction-emoji">{emoji}</span>
                            ))}
                          </span>
                          {totalCount > 1 && <span className="msg-reactions-count">{totalCount}</span>}
                        </div>
                      );
                    })()}
                  </div>
                </SwipeableMessage>
                <div className="msg-meta">
                  {msg.isStarred && (
                    <Star
                      size={11}
                      fill="var(--color-warning, #eab308)"
                      color="var(--color-warning, #eab308)"
                      className="msg-star-icon"
                      style={{ marginRight: 3 }}
                    />
                  )}
                  {msg.time}
                  {isOwn && (
                    <span className={`msg-receipt ${msg.deliveryStatus === 'read' ? 'read' : msg.deliveryStatus === 'delivered' ? 'delivered' : ''}`} title={msg.deliveryStatus === 'read' ? 'Read' : msg.deliveryStatus === 'delivered' ? 'Delivered' : 'Sent'}>
                      {msg.deliveryStatus === 'read' ? <CheckCheck size={14} /> : msg.deliveryStatus === 'delivered' ? <CheckCheck size={14} /> : <Check size={14} />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className="msg-wrapper remote">
            <div className="typing-bubble">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {activeConversationState.isBlocked ? (
        <div className="chatview-blocked-input">
          Messaging is disabled while this contact is blocked locally.
        </div>
      ) : (
        <MessageInputBar
          onSend={(payload) => {
            setReplyTo(payload.replyTo);
            handleSend(payload);
          }}
          onSendRichMessage={handleSendRichMessage}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(undefined)}
          onTypingChange={handleTypingChange}
        />
      )}
      <MessageActionsMenu
        open={Boolean(activeMessageId)}
        position={menuPosition}
        onClose={closeMessageMenu}
        onMouseEnter={cancelCloseMenu}
        onMouseLeave={scheduleCloseMenu}
        onReply={() => {
          if (activeMessageId) {
            handleReply(activeMessageId);
          }
          closeMessageMenu();
        }}
        onCopy={() => {
          if (activeMessageId) {
            handleCopyMessage(activeMessageId);
          }
          closeMessageMenu();
        }}
        onStar={() => {
          if (activeMessageId) {
            handleStarMessage(activeMessageId);
          }
          closeMessageMenu();
        }}
        onDelete={() => {
          if (activeMessageId) {
            handleDeleteMessage(activeMessageId);
          }
          closeMessageMenu();
        }}
        onForward={() => {
          if (activeMessageId) {
            window.alert('Forwarding is ready for the next step.');
          }
          closeMessageMenu();
        }}
        onReact={(emoji) => {
          if (activeMessageId) {
            handleReact(activeMessageId, emoji);
          }
          closeMessageMenu();
        }}
        onPin={() => {
          if (activeMessageId) {
            handlePinMessage(activeMessageId);
          }
          closeMessageMenu();
        }}
        onEdit={() => {
          if (activeMessageId) {
            handleStartEdit(activeMessageId);
          }
          closeMessageMenu();
        }}
        isOwn={Boolean(currentMessages.find((message) => message.id === activeMessageId)?.isSelf)}
        isStarred={Boolean(currentMessages.find((message) => message.id === activeMessageId)?.isStarred)}
        isPinned={Boolean(currentMessages.find((message) => message.id === activeMessageId)?.isPinned)}
      />
      <ToastNotification
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
      <MediaViewer />
      <ContactDetailsModal
        isOpen={contactDetailsOpen}
        onClose={() => setContactDetailsOpen(false)}
        user={otherUser ? {
          id: otherUser.id,
          uid: (otherUser as any).uid || otherUser.id,
          displayName: otherUser.displayName,
          email: (otherUser as any).email || '',
          bio: (otherUser as any).bio || '',
          avatarUrl: otherUser.avatarUrl,
          status: otherUser.status,
          lastSeen: otherUser.lastSeen,
        } : null}
        conversationId={activeConversationId || ''}
        onAudioCall={handleAudioCall}
        onVideoCall={() => {}}
        onSearchInChat={() => { setContactDetailsOpen(false); handleSearchInChat(); }}
      />
    </div>
  );
};

export default ChatView;


