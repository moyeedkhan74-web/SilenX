import React from 'react';
import { MessageCircle, Lock, Plus } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import './ConversationList.css';

const ConversationList: React.FC = () => {
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();

  return (
    <div className="conversation-list">
      <div className="convo-list-header">
        <h2>Chats</h2>
        <button className="new-chat-btn" title="New conversation" type="button">
          <Plus size={18} />
        </button>
      </div>

      <div className="convo-list-items">
        {conversations.length === 0 && (
          <div className="convo-empty">
            <span className="convo-empty-icon"><MessageCircle size={32} /></span>
            <p style={{ color: 'var(--primary-light)', fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>No conversations yet</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Search for a user to start chatting</p>
          </div>
        )}

        {conversations.map((convo) => {
          const other = convo.members.find((m) => m.id !== 'self');
          const displayName = convo.type === 'group' ? convo.name : other?.displayName || 'Unknown';
          const avatar = convo.type === 'group' ? (convo.name?.[0] || 'G') : (other?.displayName?.[0] || '?');
          const isActive = convo.id === activeConversationId;
          const status = convo.type === 'direct' && other ? other.status : null;

          return (
            <button
              key={convo.id}
              className={`convo-card ${isActive ? 'active' : ''}`}
              onClick={() => setActiveConversation(convo.id)}
            >
              <div className="avatar-wrapper">
                <div className="convo-avatar">{avatar}</div>
                {status && (
                  <span className={`status-indicator ${status}`} aria-label={`Status: ${status}`} />
                )}
              </div>
              <div className="convo-info">
                <div className="convo-name">
                  {displayName}
                  <span className="encryption-icon" title="End-to-End Encrypted"><Lock size={12} /></span>
                </div>
                <div className="convo-last-msg">{convo.lastMessage || 'No messages yet'}</div>
              </div>
              <div className="convo-meta">
                <span className="convo-time">{convo.lastMessageTime || ''}</span>
                {convo.unreadCount > 0 && (
                  <span className="convo-unread">{convo.unreadCount}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;
