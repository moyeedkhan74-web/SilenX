import React, { useState, useRef, useEffect } from 'react';
import { Phone, Video, MoreVertical, Lock, Search, Bell, UserX, Flag, Trash2, Check, CheckCheck } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { getSocket } from '../services/socket';
import { Avatar } from './Avatar';
import { MessageInputBar } from './MessageInputBar';
import './ChatView.css';

const ChatView: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ sender: string; text: string } | undefined>();
  const { conversations, activeConversationId, messages, addMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeConvo = conversations.find((c) => c.id === activeConversationId);
  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = (payload?: { text: string; replyTo?: { sender: string; text: string } }) => {
    const value = payload?.text?.trim() || inputValue.trim();
    if (!value || !activeConversationId) return;

    const socket = getSocket();
    const msg = {
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      senderId: 'self',
      text: value,
      isSelf: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      isEdited: false,
      isDeleted: false,
      replyTo: payload?.replyTo,
    };

    addMessage(activeConversationId, msg);
    socket?.emit('send-message', { conversationId: activeConversationId, encryptedContent: value, tempId: msg.id });
    setInputValue('');
    setReplyTo(undefined);
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

  const otherUser = activeConvo.members.find((m) => m.id !== 'self');
  const chatName = activeConvo.type === 'group' ? (activeConvo.name || 'Group Chat') : (otherUser?.displayName || 'Unknown');
  const status = activeConvo.type === 'direct' && otherUser ? otherUser.status : null;
  const statusText = activeConvo.type === 'group' 
    ? `${activeConvo.members.length} participants` 
    : (status === 'online' ? 'Online' : otherUser?.lastSeen ? `Last seen ${otherUser.lastSeen}` : 'Offline');

  return (
    <div className="chatview">
      <header className="chatview-header">
        <div className="chatview-header-info">
          <Avatar name={chatName || 'SlienX'} size={40} online={status === 'online'} />
          <div className="chatview-header-meta">
            <h3 className="chatview-header-name">
              {chatName}
              <span className="e2ee-badge">
                <Lock size={10} />
                <span>E2EE</span>
              </span>
            </h3>
            <span className={`chatview-status-subtext ${status === 'online' ? 'online' : ''}`}>
              {statusText}
            </span>
          </div>
        </div>
        <div className="chatview-header-actions">
          <button className="icon-btn call-btn" title="Audio Call" type="button">
            <Phone size={18} />
          </button>
          <button className="icon-btn" title="Video Call" type="button">
            <Video size={18} />
          </button>
          <div className="menu-wrapper" ref={menuRef}>
            <button className="icon-btn" title="More options" onClick={() => setMenuOpen((open) => !open)} type="button">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" type="button">
                  <Search size={16} />
                  <span>Search in chat</span>
                </button>
                <button className="dropdown-item" type="button">
                  <Bell size={16} />
                  <span>Mute notifications</span>
                </button>
                <button className="dropdown-item" type="button">
                  <Lock size={16} />
                  <span>Verify encryption</span>
                </button>
                <button className="dropdown-item" type="button">
                  <UserX size={16} />
                  <span>Block contact</span>
                </button>
                <button className="dropdown-item" type="button">
                  <Flag size={16} />
                  <span>Report</span>
                </button>
                <button className="dropdown-item danger" type="button">
                  <Trash2 size={16} />
                  <span>Clear chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="chatview-messages">
        {currentMessages.map((msg) => (
          <div key={msg.id} className={`msg-wrapper ${msg.isSelf ? 'self' : 'remote'}`}>
            <div className={`msg-bubble ${msg.isDeleted ? 'deleted' : ''}`}>
              {msg.replyTo && (
                <div className="reply-preview">
                  <div className="reply-preview-name">{msg.replyTo.sender}</div>
                  <div className="reply-preview-text">{msg.replyTo.text}</div>
                </div>
              )}
              <p className="message-text">{msg.text}</p>
              {msg.isEdited && <span className="msg-edited">edited</span>}
            </div>
            <div className="msg-meta">
              {msg.time}
              {msg.isSelf && (
                <span className={`msg-receipt ${msg.isRead ? 'read' : ''}`} title={msg.isRead ? 'Read' : 'Delivered'}>
                  {msg.isRead ? <CheckCheck size={14} /> : <Check size={14} />}
                </span>
              )}
            </div>
          </div>
        ))}
        {activeConversationId === 'conv1' && currentMessages.length <= 6 && (
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

      <MessageInputBar
        onSend={(payload) => {
          setReplyTo(payload.replyTo);
          handleSend(payload);
        }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
      />
    </div>
  );
};

export default ChatView;
