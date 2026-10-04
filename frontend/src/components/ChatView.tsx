import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Lock, Search, Bell, UserX, Flag, Trash2, Check, CheckCheck, Clock,
  Star, MapPin, Pin, Image as ImageIcon, X, Copy, Forward, Send as ReplyIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useChatStore } from '../store/chatStore';
import { connectSocket } from '../services/socket';
import { livekitService } from '../services/livekit';
import { dispatchMessage } from '../services/outbox';
import type { ChatMessage } from '../types';
import { Avatar } from './Avatar';
import { MessageInputBar } from './MessageInputBar';
import { MessageActionsMenu } from './MessageActionsMenu';
import { SwipeableMessage } from './SwipeableMessage';
import { ToastNotification } from './ToastNotification';
import { ContactDetailsModal } from './ContactDetailsModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { MediaMessage } from './MediaMessage';
import { MediaViewer } from './MediaViewer';
import VoiceNotePlayer from './VoiceNotePlayer';
import { EncryptionBadge } from './EncryptionBadge';
import { FilePreviewModal } from './FilePreviewModal';
import { SecurityVerifyModal } from './SecurityVerifyModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import WallpaperPicker from './WallpaperPicker';
import './ChatView.css';
import { formatLastSeen, formatMessageTime } from '../utils/date';

export const ChatView: React.FC = () => {
  const isMobile = useIsMobile();
  const [inputValue, setInputValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ sender: string; text: string } | undefined>();
  const [conversationState, setConversationState] = useState<Record<string, { isMuted: boolean; isVerified: boolean; isBlocked: boolean; isReported: boolean }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  const [searchTargetId, setSearchTargetId] = useState<string | null>(null);
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({}); 
  const closeTimer = useRef<number | null>(null);

  const { chatWallpaper, chatWallpaperFit, chatWallpaperDim } = useSettingsStore();

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  const { conversations, activeConversationId, messages, addMessage, clearConversation, editMessage, deleteMessage, reactToMessage, setActiveConversation, markAsRead } = useChatStore();
  const setMessages = useChatStore((s) => s.setMessages);
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
    setSelectedMessageIds([]);
  }, [activeConversationId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically emit read receipts when conversation is active or receives messages
  useEffect(() => {
    if (activeConversationId) {
      const socket = connectSocket();
      socket?.emit('read-receipt', { conversationId: activeConversationId });
      socket?.emit('mark-messages-read', { conversationId: activeConversationId });
      markAsRead(activeConversationId);
    }
  }, [activeConversationId, currentMessages.length, markAsRead]);

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
    const isOffline = !socket?.connected;
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
      deliveryStatus: isOffline ? 'pending_sync' : 'sent',
      reactions: [],
      isPinned: false,
      isStarred: false,
      replyTo: payload?.replyTo,
    };

    addMessage(activeConversationId, msg);
    void dispatchMessage(activeConversationId, msg, {
      conversationId: activeConversationId,
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
    const isOffline = !socket?.connected;
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
      deliveryStatus: isOffline ? 'pending_sync' : 'sent',
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
    void dispatchMessage(activeConversationId, msg, {
      conversationId: activeConversationId,
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
    setSearchBarOpen((prev) => !prev);
    if (searchBarOpen) {
      setSearchTerm('');
      setSearchMatchIds([]);
      setCurrentSearchIndex(0);
    }
    setMenuOpen(false);
  };

  const handleMuteNotifications = () => {
    const nextMuted = !activeConversationState.isMuted;
    updateConversationState({ isMuted: nextMuted });
    showToast(nextMuted ? 'Notifications muted for this chat' : 'Notifications unmuted');
    setMenuOpen(false);
  };

  const handleVerifyEncryption = () => {
    updateConversationState({ isVerified: true });
    setSecurityModalOpen(true);
    setMenuOpen(false);
  };

  const handleBlockContact = () => {
    const nextBlocked = !activeConversationState.isBlocked;
    updateConversationState({ isBlocked: nextBlocked });
    showToast(nextBlocked ? 'Contact blocked on this device' : 'Contact unblocked');
    setMenuOpen(false);
  };

  const handleReport = () => {
    updateConversationState({ isReported: true });
    showToast('Conversation reported successfully');
    setMenuOpen(false);
  };

  const handleAudioCall = async () => {
    if (!activeConversationId || !currentUser?.displayName) return;
    const target = otherUser || activeConvo?.members.find((m) => m.id !== currentUser?.id);
    if (!target?.id) {
      showToast('No other members in group to call.');
      return;
    }

    const started = await livekitService.startCall(
      target.id,
      'audio',
      chatName,
      currentUser.displayName,
      currentUser.avatarUrl || undefined
    );

    if (!started) {
      showToast('Unable to start audio call. Check your connection and try again.');
    }
  };

  const handleVideoCall = async () => {
    if (!activeConversationId || !currentUser?.displayName) return;
    const target = otherUser || activeConvo?.members.find((m) => m.id !== currentUser?.id);
    if (!target?.id) {
      showToast('No other members in group to call.');
      return;
    }

    const started = await livekitService.startCall(
      target.id,
      'video',
      chatName,
      currentUser.displayName,
      currentUser.avatarUrl || undefined
    );

    if (!started) {
      showToast('Unable to start video call. Check your connection and try again.');
    }
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
          <VoiceNotePlayer mediaUrl={msg.mediaUrl} seedId={msg.id} durationHint={msg.duration} />
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

  const handleDownloadMessage = async (messageId: string) => {
    const targetMessage = currentMessages.find((msg) => msg.id === messageId);
    if (!targetMessage?.mediaUrl) return;

    try {
      const response = await fetch(targetMessage.mediaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = targetMessage.fileName || targetMessage.text || 'attachment';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch {
      showToast('Download failed');
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
    showToast(target?.isStarred ? 'Message unstarred' : 'Message starred');
  };

  const toggleSelectMessage = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedMessageIds([]), []);

  useEffect(() => {
    if (selectedMessageIds.length === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMessageIds.length, clearSelection]);

  const handleReplySelected = () => {
    if (selectedMessageIds.length !== 1) return;
    handleReply(selectedMessageIds[0]);
    clearSelection();
  };

  const handleSelectAction = (action: 'copy' | 'star' | 'forward' | 'delete') => {
    const ids = selectedMessageIds;
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const targets = currentMessages.filter((msg) => idSet.has(msg.id));
    const plural = `${ids.length} message${ids.length > 1 ? 's' : ''}`;

    if (action === 'copy') {
      const text = targets.map((msg) => msg.text).filter(Boolean).join('\n');
      if (!text) {
        showToast('Nothing to copy');
        return;
      }
      navigator.clipboard
        .writeText(text)
        .then(() => showToast(`${plural} copied`))
        .catch(() => showToast('Copy failed — please copy manually'));
      clearSelection();
      return;
    }

    if (action === 'star') {
      if (!activeConversationId) return;
      const shouldStar = !targets.every((msg) => msg.isStarred);
      setMessages(
        activeConversationId,
        (messages[activeConversationId] || []).map((msg) =>
          idSet.has(msg.id) ? { ...msg, isStarred: shouldStar } : msg
        )
      );
      showToast(shouldStar ? `${plural} starred` : `Removed ${plural} from starred`);
      clearSelection();
      return;
    }

    if (action === 'delete') {
      ids.forEach((id) => handleDeleteMessage(id));
      showToast(`${plural} deleted`);
      clearSelection();
      return;
    }

    showToast(`Forwarding ${plural} — forwarding is coming soon`);
    clearSelection();
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
    const menuWidth = 260;
    const menuHeight = 60;
    const top = Math.max(16, Math.min(window.innerHeight - menuHeight - 16, rect.top - 54));
    const left = Math.max(16, Math.min(window.innerWidth - menuWidth - 16, rect.left + rect.width / 2 - menuWidth / 2));
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
  const formattedLastSeen = otherUser?.lastSeen ? formatLastSeen(otherUser.lastSeen) : 'Offline';
  const statusText = activeConvo.type === 'group' 
    ? `${activeConvo.members.length} participants` 
    : (status === 'online' ? 'Online' : formattedLastSeen === 'Offline' ? 'Offline' : `Last seen ${formattedLastSeen}`);

  return (
    <div
      className="chatview"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          setDroppedFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
    {isDraggingOver && (
        <div className="chat-drag-overlay">
          <div className="chat-drag-icon">
            <ImageIcon size={36} />
          </div>
          <div className="chat-drag-text">Drop files to preview and send</div>
          <div className="chat-drag-subtext">Images, videos, documents, or audio clips</div>
        </div>
      )}
    {selectedMessageIds.length > 0 ? (
        <header className="chatview-selection-header">
          <div className="chatview-selection-header-left">
            <button
              className="icon-btn-selection active"
              type="button"
              onClick={clearSelection}
            >
              <X size={18} />
            </button>
            <span className="chatview-selection-count">
              {selectedMessageIds.length} selected
            </span>
          </div>
          <div className="chatview-selection-header-right">
            <button
              className="icon-btn-selection"
              type="button"
              onClick={() => handleSelectAction('copy')}
            >
              <Copy size={16} />
            </button>
            <button
              className="icon-btn-selection"
              type="button"
              onClick={() => handleSelectAction('star')}
            >
              <Star size={16} />
            </button>
            <button
              className="icon-btn-selection"
              type="button"
              onClick={() => handleSelectAction('forward')}
            >
              <Forward size={16} />
            </button>
            <button
              className="icon-btn-selection"
              type="button"
              onClick={() => handleSelectAction('delete')}
            >
              <Trash2 size={16} />
            </button>
            <button
              className="icon-btn-selection"
              type="button"
              onClick={handleReplySelected}
              disabled={selectedMessageIds.length !== 1}
              title={selectedMessageIds.length === 1 ? 'Reply' : 'Select a single message to reply'}
            >
              <ReplyIcon size={16} />
            </button>
          </div>
        </header>
      ) : (
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
              onClick={() => {
                if (activeConvo?.type === 'group') {
                  setGroupDetailsOpen(true);
                } else {
                  setContactDetailsOpen(true);
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}
            >
              <Avatar
                name={chatName || 'SlienX'}
                size={40}
                online={status === 'online'}
                avatarUrl={activeConvo.type === 'group' ? (activeConvo.avatarUrl || null) : (otherUser?.avatarUrl || activeConvo.avatarUrl || null)}
              />
              <div className="chatview-header-meta">
                <h3 className="chatview-header-name">
                  {chatName}
                  <span className="e2ee-badge" title="End-to-end encrypted">
                    <Lock size={10} strokeWidth={2.6} />
                    E2EE
                  </span>
                </h3>
                <span className={`chatview-status-subtext ${status === 'online' ? 'online' : ''}`}>
                  {statusText}
                </span>
              </div>
            </div>
            <div className="chatview-header-actions">
              <button className="icon-btn call-btn" title="Start audio call" type="button" onClick={handleAudioCall}>
                <Phone size={18} />
              </button>
              <button className="icon-btn call-btn" title="Start video call" type="button" onClick={handleVideoCall}>
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
                      className="dropdown-item"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setWallpaperPickerOpen(true);
                      }}
                    >
                      <ImageIcon size={16} />
                      <span>Chat wallpaper</span>
                    </button>
                    <button
                      className="dropdown-item danger"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setClearConfirmOpen(true);
                      }}
                    >
                      <Trash2 size={16} />
                      <span>Clear chat</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {searchBarOpen && (
        <div
          className="chatview-search-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
            zIndex: 9,
          }}
        >
          <Search size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search messages in this conversation..."
            value={searchTerm}
            onChange={(e) => {
              const query = e.target.value;
              setSearchTerm(query);
              if (!query.trim()) {
                setSearchMatchIds([]);
                setCurrentSearchIndex(0);
                return;
              }
              const matches = currentMessages.filter((msg) =>
                msg.text?.toLowerCase().includes(query.toLowerCase())
              );
              setSearchMatchIds(matches.map((m) => m.id));
              setCurrentSearchIndex(0);
              if (matches.length > 0) {
                setSearchTargetId(matches[0].id);
              }
            }}
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          />
          {searchTerm.trim() && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                fontWeight: 600,
                padding: '0 4px',
                whiteSpace: 'nowrap',
              }}
            >
              {searchMatchIds.length > 0
                ? `${currentSearchIndex + 1} of ${searchMatchIds.length}`
                : 'No matches'}
            </span>
          )}
          {searchMatchIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                className="icon-btn"
                style={{ width: 28, height: 28, padding: 0 }}
                title="Previous match"
                onClick={() => {
                  const nextIdx =
                    (currentSearchIndex - 1 + searchMatchIds.length) % searchMatchIds.length;
                  setCurrentSearchIndex(nextIdx);
                  setSearchTargetId(searchMatchIds[nextIdx]);
                }}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                style={{ width: 28, height: 28, padding: 0 }}
                title="Next match"
                onClick={() => {
                  const nextIdx = (currentSearchIndex + 1) % searchMatchIds.length;
                  setCurrentSearchIndex(nextIdx);
                  setSearchTargetId(searchMatchIds[nextIdx]);
                }}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          )}
          <button
            type="button"
            className="icon-btn"
            style={{ width: 28, height: 28, padding: 0 }}
            title="Close search"
            onClick={() => {
              setSearchBarOpen(false);
              setSearchTerm('');
              setSearchMatchIds([]);
              setCurrentSearchIndex(0);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    
    {/* Chat messages area with wallpaper */}
    <div
      className="chatview-messages-container"
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {chatWallpaper && (
        <div
          className="chatview-wallpaper-bg"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            ...(chatWallpaper.startsWith('linear-gradient') || chatWallpaper.startsWith('radial-gradient')
              ? { background: chatWallpaper }
              : {
                  backgroundImage: `url(${chatWallpaper})`,
                  backgroundSize: chatWallpaperFit === 'tile' ? 'auto' : chatWallpaperFit,
                  backgroundRepeat: chatWallpaperFit === 'tile' ? 'repeat' : 'no-repeat',
                  backgroundPosition: 'center',
                }),
          }}
        >
          {chatWallpaperDim > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: `rgba(0, 0, 0, ${chatWallpaperDim})`,
              }}
            />
          )}
        </div>
      )}
        <div
          className="chatview-messages"
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            overflowY: 'auto',
          }}
        >
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
          const isSelected = selectedMessageIds.includes(msg.id);

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
            <div 
              key={msg.id} 
              data-message-id={msg.id} 
              className={`msg-wrapper ${isOwn ? 'self' : 'remote'} ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
            >
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
                  onLongPress={() => {
                    if (selectedMessageIds.length > 0) {
                      toggleSelectMessage(msg.id);
                    } else {
                      setActiveMessageId(null);
                      setSelectedMessageIds([msg.id]);
                    }
                  }}
                  onClick={() => {
                    if (selectedMessageIds.length > 0) {
                      toggleSelectMessage(msg.id);
                    }
                  }}
                >
                  <div
                    ref={(node) => {
                      messageRefs.current[msg.id] = node;
                    }}
                    className={`msg-bubble ${msg.isDeleted ? 'deleted' : ''} ${isMediaOnly && !showTextMessage ? 'media-only' : ''}`}
                    onMouseEnter={(event) => {
                      if (selectedMessageIds.length > 0) return;
                      openMessageMenu(msg.id, event.currentTarget);
                    }}
                    onMouseLeave={scheduleCloseMenu}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openMessageMenu(msg.id, event.currentTarget);
                    }}
                  >
                    {msg.isPinned && <div className="msg-pin-pill"><Pin size={10} style={{ display: 'inline', marginRight: 4 }} /> Pinned</div>}
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
                    {(() => {
                      const isPending = msg.deliveryStatus === 'pending_sync';
                      const isRead = msg.deliveryStatus === 'read' || (msg as any).isRead === true || (msg as any).status === 'read';
                      const isDelivered = msg.deliveryStatus === 'delivered' || (msg as any).status === 'delivered';
                      const statusClass = isRead ? 'read' : isDelivered ? 'delivered' : isPending ? 'pending' : 'sent';
                      const titleText = isRead
                        ? 'Read by recipient (Amethyst Purple Circle)'
                        : isDelivered
                        ? 'Delivered to recipient'
                        : isPending
                        ? 'Waiting to sync — will send when you are back online'
                        : 'Sent';
                      const formattedTime = formatMessageTime(msg.createdAt) || formatMessageTime(msg.time) || msg.time || '';

                      return (
                        <span className="msg-meta-inline">
                          {msg.isStarred && (
                            <Star
                              size={10}
                              fill="var(--color-warning, #eab308)"
                              color="var(--color-warning, #eab308)"
                              className="msg-star-icon"
                              style={{ marginRight: 2 }}
                            />
                          )}
                          <span className="msg-time-text">{formattedTime}</span>
                          {isOwn && (
                            <span className="msg-receipt" title={titleText}>
                              <span className={`msg-receipt-badge ${statusClass}`} key={isRead ? 'badge-read' : statusClass}>
                                {isPending ? (
                                  <Clock size={11} strokeWidth={2.4} />
                                ) : isRead ? (
                                  <CheckCheck size={11} strokeWidth={2.8} />
                                ) : isDelivered ? (
                                  <CheckCheck size={12} strokeWidth={2.2} />
                                ) : (
                                  <Check size={12} strokeWidth={2.2} />
                                )}
                                {isOwn && !isPending && !isRead && !isDelivered && (
                                  <EncryptionBadge confirmed={msg.encryptedContent != null} />
                                )}
                              </span>
                            </span>
                          )}
                        </span>
                      );
                    })()}
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
      onDownload={() => {
        if (activeMessageId) {
          void handleDownloadMessage(activeMessageId);
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
    {contactDetailsOpen && activeConvo && otherUser && (
      <ContactDetailsModal
        isOpen={contactDetailsOpen}
        onClose={() => setContactDetailsOpen(false)}
        user={{
          id: otherUser.id,
          uid: (otherUser as any).uid || otherUser.id,
          displayName: otherUser.displayName,
          email: (otherUser as any).email || '',
          bio: (otherUser as any).bio || '',
          avatarUrl: otherUser.avatarUrl,
          status: otherUser.status,
          lastSeen: otherUser.lastSeen,
        }}
        conversationId={activeConversationId || ''}
        onAudioCall={handleAudioCall}
        onVideoCall={() => {}}
        onSearchInChat={() => { setContactDetailsOpen(false); handleSearchInChat(); }}
      />
    )}
    {groupDetailsOpen && activeConvo?.type === 'group' && (
      <GroupDetailsModal
        isOpen={groupDetailsOpen}
        onClose={() => setGroupDetailsOpen(false)}
        conversation={activeConvo || null}
        onSearchInChat={() => { setGroupDetailsOpen(false); handleSearchInChat(); }}
      />
    )}
    <WallpaperPicker
      isOpen={wallpaperPickerOpen}
      onClose={() => setWallpaperPickerOpen(false)}
    />
    <SecurityVerifyModal
      isOpen={securityModalOpen}
      onClose={() => setSecurityModalOpen(false)}
      peerName={chatName}
      peerPublicKey={(otherUser as any)?.publicKey || null}
    />
    <ConfirmDialog
      open={clearConfirmOpen}
      title="Clear Chat History"
      message="Are you sure you want to clear all messages in this chat? This action cannot be undone on this device."
      confirmLabel="Clear Chat"
      cancelLabel="Cancel"
      onConfirm={() => {
        if (activeConversationId) {
          clearConversation(activeConversationId);
          showToast('Chat history cleared');
        }
        setClearConfirmOpen(false);
      }}
      onCancel={() => setClearConfirmOpen(false)}
    />
    <FilePreviewModal
      isOpen={droppedFiles.length > 0}
      onClose={() => setDroppedFiles([])}
      files={droppedFiles}
      onRemoveFile={(idx) => setDroppedFiles((prev) => prev.filter((_, i) => i !== idx))}
      onAddFiles={(newFiles) => setDroppedFiles((prev) => [...prev, ...newFiles])}
      onSend={async ({ files, caption, isViewOnce }) => {
        setDroppedFiles([]);
        const mediaGroupId = crypto.randomUUID();
        for (let index = 0; index < files.length; index++) {
          const file = files[index];
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
          const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
          const isVoice = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);

          let contentType: ChatMessage['contentType'] = isImage ? 'image' : isVideo ? 'video' : isVoice ? 'voice-note' : 'file';
          if (isViewOnce && (isImage || isVideo)) {
            contentType = 'view-once';
          }

          handleSendRichMessage({
            text: index === 0 && caption ? caption : file.name,
            contentType,
            mediaUrl: dataUrl,
            fileName: file.name,
            fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            fileType: file.type || 'application/octet-stream',
            mediaGroupId,
            isViewOnce,
          });
        }
      }}
    />
  </div>
  );
};

export default ChatView;
