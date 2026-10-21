import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Lock,
  Plus,
  Search,
  Pin,
  VolumeX,
  SquarePen,
  X,
  Check,
  CheckCheck,
  Mic,
  Image as ImageIcon,
  FileText,
  Video as VideoIcon,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import EmptyState from '../ui/EmptyState';
import AvatarDisplay from '../shared/AvatarDisplay';
import ChatContextMenu from './ChatContextMenu';
import '../../components/ConversationList.css';
import { getCustomNickname } from '../../utils/nicknames';

interface ChatListProps {
  onNewChatClick?: () => void;
}

export type FilterType = 'all' | 'unread' | 'direct' | 'groups';

export const ChatList: React.FC<ChatListProps> = ({ onNewChatClick }) => {
  const currentUser = useAuthStore((state) => state.user);
  const isMobile = useIsMobile();
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    pinConversation,
    muteConversation,
    markAsRead,
    clearConversation,
  } = useChatStore();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    convoId: string;
    isPinned: boolean;
    isMuted: boolean;
  } | null>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const [, setNicknameTick] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setNicknameTick((t) => t + 1);
    window.addEventListener('silenx:nickname-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('silenx:nickname-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filter conversations by search term and filter chip
  const filtered = conversations.filter((convo) => {
    const other = convo.members.find((m) => m.id !== (currentUser?.id || 'self'));
    const displayName = convo.type === 'group' ? (convo.name || 'Unknown Group') : (other?.displayName || 'Unknown');
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'unread') {
      return (convo.unreadCount || 0) > 0;
    }
    if (filterType === 'direct') {
      return convo.type === 'direct';
    }
    if (filterType === 'groups') {
      return convo.type === 'group';
    }
    return true;
  });

  // Sort conversations: Pinned first
  const sortedConversations = [...filtered].sort((a, b) => {
    const aPinned = a.isPinned ? 1 : 0;
    const bPinned = b.isPinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return 0;
  });

  const handleContextMenu = (e: React.MouseEvent, convoId: string, isPinned: boolean, isMuted: boolean) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      convoId,
      isPinned,
      isMuted,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, convoId: string, isPinned: boolean, isMuted: boolean) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      if (touchStartPos.current) {
        setContextMenu({
          x: touchStartPos.current.x,
          y: touchStartPos.current.y,
          convoId,
          isPinned,
          isMuted,
        });
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, 550);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStartPos.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  const filterChips: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'direct', label: 'Direct' },
    { id: 'groups', label: 'Groups' },
  ];

  const renderPreviewContent = (convo: any, lastMsg: any, displayName: string) => {
    if (!lastMsg) {
      if (convo.lastMessage && !convo.lastMessage.includes('Say hi') && !convo.lastMessage.includes('connection') && !convo.lastMessage.startsWith('SLX2.')) {
        return convo.lastMessage;
      }
      const firstName = (displayName || 'user').split(' ')[0];
      return `Say hi to ${firstName}!`;
    }

    if (lastMsg.contentType === 'image') {
      return (
        <span className="convo-preview-with-icon">
          <ImageIcon size={13} className="convo-preview-icon" />
          Photo
        </span>
      );
    }
    if (lastMsg.contentType === 'video') {
      return (
        <span className="convo-preview-with-icon">
          <VideoIcon size={13} className="convo-preview-icon" />
          Video
        </span>
      );
    }
    if (lastMsg.contentType === 'voice-note') {
      return (
        <span className="convo-preview-with-icon">
          <Mic size={13} className="convo-preview-icon" />
          Voice message
        </span>
      );
    }
    if (lastMsg.contentType === 'file') {
      return (
        <span className="convo-preview-with-icon">
          <FileText size={13} className="convo-preview-icon" />
          {lastMsg.fileName || 'Document'}
        </span>
      );
    }

    const text = lastMsg.text || '';
    if (text === '[Encrypted Message]' || text.startsWith('SLX2.')) {
      return 'Encrypted Message';
    }
    return text;
  };

  return (
    <div className="conversation-list" style={{ position: 'relative' }}>
      {/* Mobile Top Header (Stitch Specification) */}
      {isMobile ? (
        <header className="mobile-chat-header">
          <div className="mobile-chat-header-main">
            <div className="mobile-chat-brand">
              <img src="/silenX-logo.png" alt="SilenX" className="mobile-chat-logo" />
              <h1 className="mobile-chat-title">Chats</h1>
            </div>
            <div className="mobile-chat-header-actions">
              <button
                type="button"
                className="mobile-header-icon-btn"
                aria-label="Search"
                onClick={() => setIsSearchOpen((prev) => !prev)}
              >
                <Search size={20} />
              </button>
              <button
                type="button"
                className="mobile-header-icon-btn"
                aria-label="New chat"
                onClick={onNewChatClick}
              >
                <SquarePen size={20} />
              </button>
            </div>
          </div>
          {isSearchOpen && (
            <div className="mobile-search-bar-row">
              <Search size={16} className="search-icon-inside" />
              <input
                type="text"
                className="convo-search-input"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </header>
      ) : (
        /* Desktop Header */
        <div className="convo-list-header" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2>Chats</h2>
            <button
              className="new-chat-btn"
              title="New conversation"
              type="button"
              onClick={onNewChatClick}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="search-bar-container" style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }} />
            <input
              type="text"
              className="convo-search-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Filter Chips Bar (All, Unread, Direct, Groups) */}
      <div className="filter-chips-bar">
        <div className="filter-chips-scroll">
          {filterChips.map((chip) => {
            const isActive = filterType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                className={`filter-chip ${isActive ? 'active' : ''}`}
                onClick={() => setFilterType(chip.id)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scrollable Chat List */}
      <div className="convo-list-items">
        {sortedConversations.length === 0 && (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="No conversations yet"
            description={searchQuery || filterType !== 'all' ? "No matches found for your filter." : "Search for a user or select a contact to start chatting securely."}
            actionButton={
              !searchQuery && filterType === 'all' && onNewChatClick ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onNewChatClick}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} /> New Chat
                </button>
              ) : undefined
            }
          />
        )}

        {sortedConversations.map((convo) => {
          const other = convo.members.find((m) => m.id !== (currentUser?.id || 'self'));
          const custom = other ? getCustomNickname(other.id, (other as any).uid, (other as any)._id, convo.id) : null;
          const displayName = convo.type === 'group' ? convo.name : (custom || other?.displayName || 'Unknown');
          const isActive = convo.id === activeConversationId;
          const status = convo.type === 'direct' && other ? other.status : undefined;
          const avatarUrl = convo.type === 'group' ? (convo.avatarUrl || null) : (convo.avatarUrl || other?.avatarUrl || null);

          const convoMsgs = useChatStore.getState().messages[convo.id] || [];
          const lastMsg = convoMsgs.length > 0 ? convoMsgs[convoMsgs.length - 1] : null;
          const isLastMsgMine = lastMsg?.senderId === currentUser?.id;

          return (
            <button
              key={convo.id}
              className={`convo-card ${isActive ? 'active' : ''}`}
              onClick={() => setActiveConversation(convo.id)}
              onContextMenu={(e) => handleContextMenu(e, convo.id, !!convo.isPinned, !!convo.isMuted)}
              onTouchStart={(e) => handleTouchStart(e, convo.id, !!convo.isPinned, !!convo.isMuted)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div slot="avatar" style={{ marginRight: '12px' }}>
                <AvatarDisplay
                  name={displayName || ''}
                  avatarUrl={avatarUrl}
                  size={isMobile ? 48 : 40}
                  status={status}
                />
              </div>
              <div className="convo-info" style={{ flex: 1, overflow: 'hidden' }}>
                <div className="convo-name" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  fontSize: '14.5px',
                  color: 'var(--text-primary)',
                }}>
                  <span className="convo-title-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  {convo.type === 'direct' && (
                    <span className="encryption-icon" title="End-to-End Encrypted"><Lock size={13} style={{ color: 'var(--color-accent)' }} /></span>
                  )}
                  {convo.isPinned && (
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                      <Pin size={12} style={{ transform: 'rotate(45deg)' }} />
                    </span>
                  )}
                </div>
                <div className="convo-last-msg" style={{
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {isLastMsgMine && (
                    <span className="delivery-receipt" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      {lastMsg?.deliveryStatus === 'read' || lastMsg?.isRead ? (
                        <CheckCheck size={14} style={{ color: 'var(--color-accent)' }} />
                      ) : lastMsg?.deliveryStatus === 'delivered' ? (
                        <CheckCheck size={14} style={{ color: 'var(--text-tertiary)' }} />
                      ) : (
                        <Check size={14} style={{ color: 'var(--text-tertiary)' }} />
                      )}
                    </span>
                  )}
                  {renderPreviewContent(convo, lastMsg, displayName || '')}
                </div>
              </div>
              <div className="convo-meta" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                marginLeft: '8px',
                gap: '4px',
              }}>
                <span className="convo-time" style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {convo.isMuted && <VolumeX size={10} style={{ opacity: 0.6 }} />}
                  {convo.lastMessageTime || ''}
                </span>
                {convo.unreadCount > 0 && (
                  <span
                    key={convo.unreadCount}
                    className="convo-unread"
                  >
                    {convo.unreadCount > 99 ? '99+' : convo.unreadCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Floating Action Button (Mobile Only, Stitch Specification) */}
      {isMobile && !activeConversationId && (
        <div className="mobile-chat-fab">
          <button
            type="button"
            className="mobile-fab-btn"
            aria-label="Start new chat"
            onClick={onNewChatClick}
          >
            <SquarePen size={24} />
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ChatContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isPinned={contextMenu.isPinned}
          isMuted={contextMenu.isMuted}
          onClose={() => setContextMenu(null)}
          onPin={() => pinConversation(contextMenu.convoId)}
          onMute={() => muteConversation(contextMenu.convoId)}
          onMarkRead={() => markAsRead(contextMenu.convoId)}
          onClear={() => {
            if (window.confirm('Are you sure you want to clear this chat history? This cannot be undone.')) {
              clearConversation(contextMenu.convoId);
            }
          }}
          onDelete={() => {
            if (window.confirm('Do you want to delete this chat? The conversation will be permanently removed.')) {
              deleteConversation(contextMenu.convoId);
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatList;
