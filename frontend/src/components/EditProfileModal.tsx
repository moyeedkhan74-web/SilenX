import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Upload, 
  Trash2, 
  Mail, 
  Copy, 
  Check, 
  User, 
  Sparkles, 
  ShieldCheck, 
  Camera, 
  Lock, 
  Zap, 
  QrCode, 
  Eye, 
  Edit3,
  RefreshCw
} from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import AvatarDisplay from './shared/AvatarDisplay';
import UIDDisplay from './shared/UIDDisplay';
import QRCodeSection from './shared/QRCodeSection';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';
import { compressImageToDataUrl } from '../services/backblaze';
import ImageCropperModal from './ImageCropperModal';
import './EditProfileModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: any | null;
  onSaved: () => void;
}

const DEFAULT_ENHANCED_BIO = "Hey!! I'm using SilenX 🔒";
const BIO_MAX_LENGTH = 160;

const PRESET_BIOS = [
  "🔒 E2E Encrypted & Anonymous",
  "⚡ Silent Operator | SilenX",
  "🛡️ Privacy is a fundamental right",
  "💬 Reach out via my Secure ID",
  "🚀 Digital Nomad & Tech Enthusiast"
];

export const EditProfileModal: React.FC<Props> = ({ isOpen, onClose, profile, onSaved }) => {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [copiedBio, setCopiedBio] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [showQrPreview, setShowQrPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const uid = profile?.uid || currentUser?.uid || 'Loading...';
  const email = profile?.email || currentUser?.email || '';

  useEffect(() => {
    if (isOpen) {
      const activeUser = profile || currentUser;
      setDisplayName(activeUser?.displayName || '');
      setAvatarUrl(activeUser?.avatarUrl || '');
      setBio(activeUser?.bio !== undefined && activeUser?.bio !== null ? activeUser.bio : DEFAULT_ENHANCED_BIO);
      setDisplayNameError('');
      setAvatarFile(null);
      setCropperSrc(null);
      setIsDragOver(false);
      setActiveTab('edit');
    }
  }, [isOpen, profile, currentUser]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) {
      handleFileSelect(f);
    }
  };

  const handleFileSelect = (f: File) => {
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(String(reader.result));
    reader.readAsDataURL(f);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyBio = () => {
    const textToCopy = bio || DEFAULT_ENHANCED_BIO;
    navigator.clipboard.writeText(textToCopy);
    setCopiedBio(true);
    setTimeout(() => setCopiedBio(false), 2000);
  };

  const handleCopyUid = () => {
    if (uid && uid !== 'Loading...') {
      navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const handleApplyPresetBio = (presetText: string) => {
    setBio(presetText);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      setDisplayNameError('Display Name is required.');
      return;
    }
    
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        try {
          finalAvatarUrl = await compressImageToDataUrl(avatarFile);
        } catch (uploadError) {
          console.error(uploadError);
          alert('Avatar upload failed. Please try again.');
          setSaving(false);
          return;
        }
      }

      const payload: any = {
        displayName: displayName.trim(),
        avatarUrl: finalAvatarUrl,
        bio: bio.trim(),
      };
      
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const updatedUser = await res.json();
        useAuthStore.getState().setUser(updatedUser);
        onSaved();
        onClose();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.message || 'Failed to save profile');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving profile');
    } finally {
      setSaving(false);
    }
  };

  const bioCharCount = bio.length;
  const isBioTooLong = bioCharCount > BIO_MAX_LENGTH;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="edit-profile-modal dark">
      {/* Modal Ambient Glow Layer */}
      <div className="modal-glow-ambient" />

      {/* Header Section */}
      <div className="epm-header">
        <div className="epm-header-left">
          <div className="epm-icon-badge">
            <ShieldCheck size={20} className="epm-badge-svg" />
          </div>
          <div>
            <h2 className="epm-title">Edit Identity Profile</h2>
            <p className="epm-subtitle">Customize your visual persona & encrypted credentials</p>
          </div>
        </div>

        {email && (
          <div className="epm-email-chip">
            <Mail size={13} className="epm-email-icon" />
            <span>{email}</span>
            <span className="epm-verified-dot" title="Verified Session" />
          </div>
        )}
      </div>

      {/* Mobile Tab Switcher */}
      <div className="epm-mobile-tabs">
        <button 
          type="button"
          className={`epm-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          <Edit3 size={14} /> Edit Profile
        </button>
        <button 
          type="button"
          className={`epm-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <Eye size={14} /> Live Card Preview
        </button>
      </div>

      <div className="editor-grid">
        {/* Left Column: Form Editor */}
        <div className={`editor-form ${activeTab === 'preview' ? 'mobile-hidden' : ''}`}>
          
          {/* Display Name Input */}
          <div className="epm-field-group">
            <div className="epm-label-row">
              <label htmlFor="epm-display-name" className="epm-label">
                <User size={14} className="epm-field-icon" />
                <span>Display Name</span>
                <span className="epm-required-badge">*</span>
              </label>
              <span className="epm-helper-tag">Visible in chats</span>
            </div>
            
            <div className="epm-input-wrapper">
              <input
                id="epm-display-name"
                type="text"
                className={`epm-input ${displayNameError ? 'has-error' : ''}`}
                value={displayName}
                placeholder="Enter your handle or name..."
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (e.target.value.trim()) setDisplayNameError('');
                }}
                disabled={saving}
                maxLength={40}
              />
              <span className="epm-char-mini">{displayName.length}/40</span>
            </div>
            {displayNameError && (
              <span className="epm-error-msg">{displayNameError}</span>
            )}
          </div>

          {/* Bio Input Section */}
          <div className="epm-field-group">
            <div className="epm-label-row">
              <label htmlFor="epm-bio" className="epm-label">
                <Sparkles size={14} className="epm-field-icon" />
                <span>Bio & Status</span>
              </label>

              <button
                type="button"
                className={`epm-copy-bio-btn ${copiedBio ? 'copied' : ''}`}
                onClick={handleCopyBio}
                title="Copy current bio to clipboard"
              >
                {copiedBio ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedBio ? 'Copied!' : 'Copy Bio'}</span>
              </button>
            </div>

            <div className="epm-textarea-wrapper">
              <textarea 
                id="epm-bio"
                value={bio} 
                onChange={(e) => setBio(e.target.value)} 
                disabled={saving}
                placeholder={DEFAULT_ENHANCED_BIO}
                className={`epm-textarea ${isBioTooLong ? 'has-error' : ''}`}
              />
              <div className="epm-textarea-footer">
                <span className={`epm-bio-counter ${isBioTooLong ? 'exceeded' : ''}`}>
                  {bioCharCount} / {BIO_MAX_LENGTH}
                </span>
              </div>
            </div>

            {/* Quick Preset Bios Chips */}
            <div className="epm-preset-bios">
              <span className="epm-presets-title">
                <Zap size={12} /> Quick Presets:
              </span>
              <div className="epm-presets-chips">
                {PRESET_BIOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="epm-chip"
                    onClick={() => handleApplyPresetBio(preset)}
                    disabled={saving}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Avatar Dropzone Section */}
          <div className="epm-field-group">
            <label className="epm-label" style={{ marginBottom: '8px' }}>
              <Camera size={14} className="epm-field-icon" />
              <span>Profile Avatar</span>
            </label>

            <div 
              className={`epm-dropzone ${isDragOver ? 'drag-over' : ''} ${avatarUrl ? 'has-avatar' : ''}`} 
              onDrop={onDrop} 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <div className="epm-dropzone-avatar">
                <AvatarDisplay name={displayName || 'User'} avatarUrl={avatarUrl} size={64} />
                <button
                  type="button"
                  className="epm-avatar-overlay-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Change avatar photo"
                >
                  <Camera size={18} />
                </button>
              </div>

              <div className="epm-dropzone-info">
                <div className="epm-dropzone-title">
                  {avatarUrl ? 'Custom Avatar Active' : 'Upload or Drop Picture'}
                </div>
                <div className="epm-dropzone-subtitle">
                  Supports JPG, PNG, WebP up to 5MB (Square ratio recommended)
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} 
                />

                <div className="epm-dropzone-actions">
                  <button
                    type="button"
                    className="epm-btn-upload"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    <Upload size={14} /> {avatarUrl ? 'Replace Photo' : 'Upload Photo'}
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      className="epm-btn-remove"
                      onClick={handleRemoveAvatar}
                      disabled={saving}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Row */}
          <div className="actions-row">
            <Button variant="secondary" onClick={onClose} disabled={saving} className="epm-action-cancel">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || isBioTooLong} className="epm-action-save">
              {saving ? (
                <>
                  <RefreshCw size={15} className="spin-icon" /> Saving Profile...
                </>
              ) : (
                <>
                  <Save size={15} /> Save Changes
                </>
              )}
            </Button>
          </div>

        </div>

        {/* Right Column: Live Card Preview */}
        <div className={`editor-preview ${activeTab === 'edit' ? 'mobile-hidden' : ''}`}>
          <div className="epm-preview-header">
            <div className="epm-preview-title">
              <Eye size={14} /> Live Identity Card
            </div>
            <div className="epm-live-indicator">
              <span className="epm-pulse-dot" /> LIVE PREVIEW
            </div>
          </div>

          <div className="epm-card-container">
            {/* Ambient Graphic Banner */}
            <div className="epm-card-banner">
              <div className="epm-card-banner-grid" />
              <div className="epm-card-badge-tag">
                <Lock size={11} /> ENCRYPTED NODE
              </div>
            </div>

            {/* Avatar & Main Content */}
            <div className="epm-card-body">
              <div className="epm-card-avatar-wrap">
                <AvatarDisplay name={displayName || 'User'} avatarUrl={avatarUrl} size={76} />
                <span className="epm-card-status-pulse" title="Online & Secured" />
              </div>

              <div className="epm-card-name">
                {displayName || 'Your Name'}
              </div>

              <div className="epm-card-bio">
                "{bio || DEFAULT_ENHANCED_BIO}"
              </div>

              {/* Secure ID Box */}
              <div className="epm-card-uid-box">
                <div className="epm-card-uid-header">
                  <span className="epm-uid-label">SECURE UID</span>
                  <button
                    type="button"
                    className="epm-uid-copy-btn"
                    onClick={handleCopyUid}
                    title="Copy UID"
                  >
                    {copiedUid ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    <span>{copiedUid ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                
                <UIDDisplay uid={uid} isLoading={uid === 'Loading...'} />
              </div>

              {/* QR Code Collapsible preview */}
              {uid !== 'Loading...' && (
                <div className="epm-card-qr-section">
                  <button 
                    type="button" 
                    className="epm-qr-toggle-btn"
                    onClick={() => setShowQrPreview(!showQrPreview)}
                  >
                    <QrCode size={14} />
                    <span>{showQrPreview ? 'Hide QR Signatures' : 'Show Instant QR Code'}</span>
                  </button>

                  {showQrPreview && (
                    <div className="epm-qr-container">
                      <QRCodeSection uid={uid} size={140} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Image Cropper Modal Integration */}
      <ImageCropperModal
        imageSrc={cropperSrc || ''}
        isOpen={!!cropperSrc}
        aspectRatio="1:1"
        onCropComplete={(croppedUrl) => {
          setAvatarUrl(croppedUrl);
          setCropperSrc(null);
        }}
        onClose={() => setCropperSrc(null)}
      />
    </Modal>
  );
};

export default EditProfileModal;

