import React, { useState, useRef } from 'react';
import { MessageCircle, Lock, Plus, Search, Pin, VolumeX } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import EmptyState from '../ui/EmptyState';
import AvatarDisplay from '../shared/AvatarDisplay';
import ChatContextMenu from './ChatContextMenu';
import '../../components/ConversationList.css';

interface ChatListProps {
  onNewChatClick?: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({ onNewChatClick }) => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    pinConversation,
    muteConversation,
    markAsRead,
    clearConversation
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    convoId: string;
    isPinned: boolean;
    isMuted: boolean;
  } | null>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Filter conversations by search term
  const filtered = conversations.filter((convo) => {
    const other = convo.members.find((m) => m.id !== 'self');
    const displayName = convo.type === 'group' ? (convo.name || 'Unknown Group') : (other?.displayName || 'Unknown');
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
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

  return (
    <div className="conversation-list" style={{ position: 'relative' }}>
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
        
        <div className="search-bar-container" style={{
          position: 'relative',
          width: '100%'
        }}>
          <Search size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)'
          }} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <div className="convo-list-items" style={{ flex: 1, overflowY: 'auto' }}>
        {sortedConversations.length === 0 && (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="No conversations yet"
            description={searchQuery ? "No matches found for your search options." : "Search for a user or selection contact to start chatting securely."}
            actionButton={
              !searchQuery && onNewChatClick ? (
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
          const other = convo.members.find((m) => m.id !== 'self');
          const displayName = convo.type === 'group' ? convo.name : other?.displayName || 'Unknown';
          const isActive = convo.id === activeConversationId;
          const status = convo.type === 'direct' && other ? other.status : undefined;
          const avatarUrl = convo.avatarUrl || other?.avatarUrl;

          return (
            <button
              key={convo.id}
              className={`convo-card ${isActive ? 'active' : ''}`}
              onClick={() => setActiveConversation(convo.id)}
              onContextMenu={(e) => handleContextMenu(e, convo.id, !!convo.isPinned, !!convo.isMuted)}
              onTouchStart={(e) => handleTouchStart(e, convo.id, !!convo.isPinned, !!convo.isMuted)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                border: 'none',
                background: isActive ? 'var(--bg-secondary)' : 'transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.2s',
                marginBottom: '4px',
                userSelect: 'none'
              }}
            >
              <div slot="avatar" style={{ marginRight: '12px' }}>
                <AvatarDisplay name={displayName || ''} avatarUrl={avatarUrl} size={40} status={status} />
              </div>
              <div className="convo-info" style={{ flex: 1, overflow: 'hidden' }}>
                <div className="convo-name" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}>
                  {displayName}
                  <span className="encryption-icon" title="End-to-End Encrypted"><Lock size={12} /></span>
                  {convo.isPinned && (
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                      <Pin size={12} style={{ transform: 'rotate(45deg)' }} />
                    </span>
                  )}
                </div>
                <div className="convo-last-msg" style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  marginTop: '2px'
                }}>
                  {convo.lastMessage || 'No messages yet'}
                </div>
              </div>
              <div className="convo-meta" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                marginLeft: '8px'
              }}>
                <span className="convo-time" style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {convo.isMuted && <VolumeX size={10} style={{ opacity: 0.6 }} />}
                  {convo.lastMessageTime || ''}
                </span>
                {convo.unreadCount > 0 && (
                  <span className="convo-unread" style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-accent)',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    marginTop: '4px'
                  }}>
                    {convo.unreadCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

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
