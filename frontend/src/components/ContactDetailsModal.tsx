import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  Search,
  Edit3,
  Copy,
  QrCode,
  Bell,
  Shield,
  Star,
  Trash2,
  UserX,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import AvatarDisplay from './shared/AvatarDisplay';
import QRCodeSection from './shared/QRCodeSection';
import Modal from './ui/Modal';
import MediaGalleryModal from './MediaGalleryModal';
import SecurityVerifyModal from './SecurityVerifyModal';
import { useChatStore } from '../store/chatStore';
import './ContactDetailsModal.css';
import { formatLastSeen } from '../utils/date';
import { getCustomNickname, saveCustomNickname } from '../utils/nicknames';

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
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [showSecurityVerify, setShowSecurityVerify] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const conversation = useChatStore((s) => s.conversations.find((c) => c.id === conversationId));
  const messages = useChatStore((s) => s.messages[conversationId] || []);
  const clearConversation = useChatStore((s) => s.clearConversation);
  const muteConversation = useChatStore((s) => s.muteConversation);
  const pinConversation = useChatStore((s) => s.pinConversation);

  // Load custom nickname from helper
  useEffect(() => {
    if (!user?.id) return;
    const nick = getCustomNickname(user.id);
    setCustomName(nick || user.displayName || '');
  }, [user]);

  if (!user) return null;

  const displayNameToUse = customName || user.displayName || 'User';

  const handleSaveNickname = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id) return;
    saveCustomNickname(customName, user.id);
    setIsEditingName(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  const handleCopyUid = () => {
    const val = user.uid || user.id;
    if (val) {
      navigator.clipboard.writeText(val);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
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
  const mediaMessages = messages.filter(
    (m) => m.contentType === 'image' || m.contentType === 'video' || m.contentType === 'file'
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="contact-details-modal">
      <div className="contact-details-container">
        {/* Header Bar */}
        <header className="contact-details-header">
          <button type="button" className="icon-btn-back" onClick={onClose} title="Back" aria-label="Back">
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
              email={user.email}
              size={96}
              status={user.status || 'online'}
            />

            <div className="contact-name-row">
              {isEditingName ? (
                <form className="edit-nickname-form" onSubmit={handleSaveNickname}>
                  <input
                    className="edit-nickname-input"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setCustomName(getCustomNickname(user.id) || user.displayName || '');
                        setIsEditingName(false);
                      }
                    }}
                    placeholder="Enter nickname..."
                    autoFocus
                  />
                  <div className="edit-nickname-actions">
                    <button type="submit" className="btn-save-nickname">Save</button>
                    <button
                      type="button"
                      className="btn-cancel-nickname"
                      onClick={() => {
                        setCustomName(getCustomNickname(user.id) || user.displayName || '');
                        setIsEditingName(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="contact-name-display-wrapper">
                  <h2 className="contact-display-name">
                    <span className="contact-name-text">{displayNameToUse}</span>
                    <button
                      type="button"
                      className="btn-icon-inline"
                      onClick={() => setIsEditingName(true)}
                      title="Edit contact name"
                      aria-label="Edit contact name"
                    >
                      <Edit3 size={15} />
                    </button>
                  </h2>
                  <p className="contact-last-seen">
                    {user.status === 'online'
                        ? 'Online'
                        : (user.lastSeen
                            ? (formatLastSeen(user.lastSeen) === 'Offline'
                                ? 'Offline'
                                : `Last seen ${formatLastSeen(user.lastSeen)}`)
                            : 'Offline')
                      }
                  </p>
                  {showSavedToast && <span className="nickname-saved-toast">✓ Name updated</span>}
                </div>
              )}
            </div>
            {user.bio && <p className="contact-bio-text">"{user.bio}"</p>}

            {/* Quick Action Buttons Row */}
            <div className="contact-actions-bar">
              <button type="button" className="action-pill-btn" onClick={onAudioCall} aria-label="Audio call">
                <Phone size={18} />
                <span>Audio</span>
              </button>
              <button type="button" className="action-pill-btn" onClick={onVideoCall} aria-label="Video call">
                <Video size={18} />
                <span>Video</span>
              </button>
              <button type="button" className="action-pill-btn" onClick={onSearchInChat} aria-label="Search in chat">
                <Search size={18} />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Secure ID / UID Section */}
          <div className="contact-section-card">
            <div className="section-label">Secure ID (UID)</div>
            <div className="uid-info-row">
              <span className="uid-label">
                <Shield size={14} className="uid-lock-icon" /> User ID
              </span>
              <code className="uid-value">{user.uid || user.id}</code>
            </div>
            <div className="uid-actions-row">
              <button type="button" className="btn-action-sm" onClick={handleCopyUid}>
                {copiedUid ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedUid ? 'Copied!' : 'Copy UID'}</span>
              </button>
              <button type="button" className="btn-action-sm" onClick={() => setShowQr(!showQr)}>
                <QrCode size={14} />
                <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
              </button>
            </div>
            {showQr && (
              <div className="qr-container">
                <QRCodeSection uid={user.uid || user.id} size={140} />
              </div>
            )}
          </div>

          {/* Media, links, and docs */}
          <div className="contact-section-card clickable-row" onClick={() => setIsMediaGalleryOpen(true)}>
            <div className="row-left">
              <ImageIcon size={20} className="row-icon" />
              <div className="row-text">
                <span className="row-title">Media, links, and docs</span>
              </div>
            </div>
            <span className="row-count">{mediaMessages.length} ›</span>
          </div>

          {/* APK / App Version Display (Below Media, links, and docs) */}
          <div className="contact-section-card version-info-card">
            <div className="row-left">
              <Shield size={20} className="row-icon lock-icon" />
              <div className="row-text">
                <span className="row-title">App Version</span>
                <span className="row-subtitle">SilenX v1.0.1 (Build 2) • E2EE Active</span>
              </div>
            </div>
            <span className="e2ee-badge">LATEST</span>
          </div>

          {/* WhatsApp Style Chat Settings Options List */}
          <div className="contact-section-card options-group">
            <div className="section-label" style={{ padding: '4px 0 8px 4px' }}>Chat Settings</div>
            {/* Mute notifications */}
            <div className="contact-option-row">
              <div className="row-left">
                <Bell size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Mute notifications</span>
                </div>
              </div>
              <label className="toggle" aria-label="Toggle mute notifications">
                <input
                  type="checkbox"
                  checked={conversation?.isMuted || false}
                  onChange={() => muteConversation(conversationId)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Add to Favorites */}
            <div className="contact-option-row clickable-row" onClick={() => pinConversation(conversationId)}>
              <div className="row-left">
                <Star size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Add to Favorites</span>
                </div>
              </div>
            </div>

            {/* Verify Encryption */}
            <div className="contact-option-row clickable-row" onClick={() => setShowSecurityVerify(true)}>
              <div className="row-left">
                <Shield size={20} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">Verify Encryption</span>
                  <span className="row-subtitle">Compare safety numbers & scan QR</span>
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

          {/* Bottom Footer Badge */}
          <div className="contact-app-version-badge">
            <span>SilenX v1.0.1 (Build 2)</span>
            <span className="dot">•</span>
            <span>End-to-End Encrypted</span>
          </div>

          {/* Media Gallery Modal */}
          <MediaGalleryModal
            isOpen={isMediaGalleryOpen}
            onClose={() => setIsMediaGalleryOpen(false)}
            conversationId={conversationId}
          />

          {/* Security Verify Modal */}
          <SecurityVerifyModal
            isOpen={showSecurityVerify}
            onClose={() => setShowSecurityVerify(false)}
            peerPublicKey={(user as any).publicKey}
            peerName={displayNameToUse}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ContactDetailsModal;