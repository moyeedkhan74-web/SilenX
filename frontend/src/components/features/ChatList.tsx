import React, { useState } from 'react';
import { MessageCircle, Lock, Plus, Search } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import EmptyState from '../ui/EmptyState';
import AvatarDisplay from '../shared/AvatarDisplay';
import '../../components/ConversationList.css';

interface ChatListProps {
  onNewChatClick?: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({ onNewChatClick }) => {
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((convo) => {
    const other = convo.members.find((m) => m.id !== 'self');
    const displayName = convo.type === 'group' ? (convo.name || 'Unknown Group') : (other?.displayName || 'Unknown');
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="conversation-list">
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
        {filteredConversations.length === 0 && (
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

        {filteredConversations.map((convo) => {
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
                marginBottom: '4px'
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
                <span className="convo-time" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {convo.lastMessageTime || ''}
                </span>
                {convo.unreadCount > 0 && (
                  <span className="convo-unread" style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
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
    </div>
  );
};

export default ChatList;
