import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Video, Search, Edit3, Copy, QrCode, Bell, Lock, Shield, Star, Trash2, UserX, Image as ImageIcon } from 'lucide-react';
import AvatarDisplay from './shared/AvatarDisplay';
import UIDDisplay from './shared/UIDDisplay';
import QRCodeSection from './shared/QRCodeSection';
import Modal from './ui/Modal';
import { useChatStore } from '../store/chatStore';
import './ContactDetailsModal.css';
import { formatLastSeen } from '../utils/date';

interface ContactDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    uid: string;
    displayName: string;
    email?: string;
    bio?: string;
    avatarUrl?: string | null;
    status?: string;
    lastSeen?: string;
  } | null;
  conversationId: string;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  onSearchInChat?: () => void;
}

export const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({
  isOpen,
  onClose,
  user,
  conversationId,
  onAudioCall,
  onVideoCall,
  onSearchInChat,
}) => {
  const [customName, setCustomName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isChatLocked, setIsChatLocked] = useState(false);

  const messages = useChatStore((s) => s.messages[conversationId] || []);
  const clearConversation = useChatStore((s) => s.clearConversation);

  // Load custom nickname from localStorage if set
  useEffect(() => {
    if (!user?.id) return;
    const storedNicknames = localStorage.getItem('slienx-contact-nicknames');
    if (storedNicknames) {
      try {
        const parsed = JSON.parse(storedNicknames);
        if (parsed[user.id]) {
          setCustomName(parsed[user.id]);
        } else {
          setCustomName(user.displayName);
        }
      } catch {
        setCustomName(user.displayName);
      }
    } else {
      setCustomName(user.displayName);
    }
  }, [user]);

  if (!user) return null;

  const displayNameToUse = customName || user.displayName || 'User';

  const handleSaveNickname = () => {
    if (!user.id) return;
    const stored = localStorage.getItem('slienx-contact-nicknames');
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[user.id] = customName.trim() || user.displayName;
    localStorage.setItem('slienx-contact-nicknames', JSON.stringify(parsed));
    setIsEditingName(false);
    // Reload page or force trigger storage update
    window.dispatchEvent(new Event('storage'));
  };

  const handleCopyUid = () => {
    if (user.uid) {
      navigator.clipboard.writeText(user.uid);
      alert('UID copied to clipboard!');
    }
  };

  const handleClearChatClick = () => {
    const confirmed = window.confirm(`Are you sure you want to clear chat history with ${displayNameToUse}?`);
    if (confirmed) {
      clearConversation(conversationId);
      onClose();
    }
  };

  const handleBlockClick = () => {
    const confirmed = window.confirm(`Block ${displayNameToUse} on this device?`);
    if (confirmed) {
      alert(`${displayNameToUse} has been blocked.`);
      onClose();
    }
  };

  // Count media files in messages
  const mediaMessages = messages.filter((m) => m.contentType === 'image' || m.contentType === 'video' || m.contentType === 'file');

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="contact-details-modal dark">
      <div className="contact-details-container">
        {/* Header Bar */}
        <header className="contact-details-header">
          <button type="button" className="icon-btn-back" onClick={onClose} title="Back">
            <ArrowLeft size={20} />
          </button>
          <h2>Contact info</h2>
        </header>

        <div className="contact-details-body">
          {/* Top Hero Card */}
          <div className="contact-hero-card">
            <AvatarDisplay
              name={displayNameToUse}
              avatarUrl={user.avatarUrl}
              size={96}
              status={user.status || 'online'}
            />
            <div className="contact-name-row">
              {isEditingName ? (
                <div className="edit-nickname-box">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Set custom name..."
                    autoFocus
                  />
                  <button type="button" className="btn-save-nickname" onClick={handleSaveNickname}>
                    Save
                  </button>
                </div>
              ) : (
                <h2 className="contact-display-name">
                  {displayNameToUse}
                  <button
                    type="button"
                    className="btn-icon-inline"
                    onClick={() => setIsEditingName(true)}
                    title="Edit name for this user"
                  >
                    <Edit3 size={16} />
                  </button>
                </h2>
              )}
            </div>

            <p className="contact-status-text">
              ● {user.status === 'online' 
                  ? 'Online' 
                  : (user.lastSeen 
                      ? (formatLastSeen(user.lastSeen) === 'Offline' 
                          ? 'Offline' 
                          : `Last seen ${formatLastSeen(user.lastSeen)}`)
                      : 'Offline')
                }
            </p>
            {user.bio && <p className="contact-bio-text">"{user.bio}"</p>}
            {user.email && <p className="contact-email-text">{user.email}</p>}

            {/* Quick Action Buttons Row */}
            <div className="contact-actions-bar">
              <button type="button" className="action-pill-btn" onClick={onAudioCall}>
                <Phone size={18} />
                <span>Audio</span>
              </button>
              <button type="button" className="action-pill-btn" onClick={onVideoCall}>
                <Video size={18} />
                <span>Video</span>
              </button>
              <button type="button" className="action-pill-btn" onClick={onSearchInChat}>
                <Search size={18} />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Secure ID / UID Section */}
          <div className="contact-section-card">
            <div className="section-label">Secure ID (UID)</div>
            <UIDDisplay uid={user.uid || user.id} />
            <div className="uid-actions-row">
              <button type="button" className="btn-action-sm" onClick={handleCopyUid}>
                <Copy size={14} /> Copy UID
              </button>
              <button type="button" className="btn-action-sm" onClick={() => setShowQr(!showQr)}>
                <QrCode size={14} /> {showQr ? 'Hide QR' : 'Show QR'}
              </button>
            </div>
            {showQr && (
              <div className="qr-container">
                <QRCodeSection uid={user.uid || user.id} size={140} />
              </div>
            )}
          </div>

          {/* Media, links, and docs */}
          <div className="contact-section-card clickable-row">
            <div className="row-left">
              <ImageIcon size={20} className="row-icon" />
              <div className="row-text">
                <span className="row-title">Media, links, and docs</span>
              </div>
            </div>
            <span className="row-count">{mediaMessages.length} ›</span>
          </div>

          {/* WhatsApp Style Options List */}
          <div className="contact-section-card options-group">
            {/* Mute notifications */}
            <div className="contact-option-row">
              <div className="row-left">
                <Bell size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Mute notifications</span>
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={isMuted}
                  onChange={(e) => setIsMuted(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Disappearing messages */}
            <div className="contact-option-row">
              <div className="row-left">
                <Lock size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Disappearing messages</span>
                  <span className="row-subtitle">Off</span>
                </div>
              </div>
            </div>

            {/* Chat lock */}
            <div className="contact-option-row">
              <div className="row-left">
                <Lock size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Chat lock</span>
                  <span className="row-subtitle">Lock and hide this chat on this device.</span>
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={isChatLocked}
                  onChange={(e) => setIsChatLocked(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Advanced chat privacy */}
            <div className="contact-option-row">
              <div className="row-left">
                <Shield size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Advanced chat privacy</span>
                  <span className="row-subtitle">Off</span>
                </div>
              </div>
            </div>

            {/* Add to Favorites */}
            <div className="contact-option-row clickable">
              <div className="row-left">
                <Star size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Add to Favorites</span>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Actions */}
          <div className="contact-section-card options-group danger-group">
            <button type="button" className="contact-danger-btn" onClick={handleClearChatClick}>
              <Trash2 size={18} />
              <span>Clear chat</span>
            </button>

            <button type="button" className="contact-danger-btn" onClick={handleBlockClick}>
              <UserX size={18} />
              <span>Block {displayNameToUse}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ContactDetailsModal;
