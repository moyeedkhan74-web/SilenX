import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, Trash2, Mail, Copy, Check } from 'lucide-react';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import AvatarDisplay from './shared/AvatarDisplay';
import UIDDisplay from './shared/UIDDisplay';
import QRCodeSection from './shared/QRCodeSection';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';
import { uploadToBackblaze } from '../services/backblaze';
import './EditProfileModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: any | null;
  onSaved: () => void;
}

const DEFAULT_ENHANCED_BIO = "Hey!! I'm using SilenX 🔒";

export const EditProfileModal: React.FC<Props> = ({ isOpen, onClose, profile, onSaved }) => {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [copiedBio, setCopiedBio] = useState(false);

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
    }
  }, [isOpen]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) {
      handleFileSelect(f);
    }
  };

  const handleFileSelect = (f: File) => {
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
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
          const uploaded = await uploadToBackblaze(avatarFile, 'avatars');
          finalAvatarUrl = uploaded.url;
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
         // Immediately sync updated user object to local authStore
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="edit-profile-modal dark">
      <div className="editor-grid">
        <div className="editor-form">
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700 }}>Edit Profile</h2>
            {email && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <Mail size={13} style={{ color: 'var(--color-primary)' }} />
                <span>Logged in as: <strong>{email}</strong></span>
              </div>
            )}
          </div>
          
          <Input 
            label="Display Name (required)" 
            value={displayName} 
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (e.target.value.trim()) setDisplayNameError('');
            }}
            error={displayNameError}
            disabled={saving}
          />

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="input-label" style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Bio
              </label>
              <button
                type="button"
                onClick={handleCopyBio}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: copiedBio ? '#22c55e' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedBio ? <Check size={12} /> : <Copy size={12} />}
                {copiedBio ? 'Copied!' : 'Copy Bio'}
              </button>
            </div>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)} 
              disabled={saving}
              placeholder={DEFAULT_ENHANCED_BIO}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                minHeight: '75px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="input-label" style={{ display: 'block', fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Profile Picture
            </label>
            <div 
              className="avatar-uploader-clean" 
              onDrop={onDrop} 
              onDragOver={(e) => e.preventDefault()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}
            >
              <AvatarDisplay name={displayName || 'User'} avatarUrl={avatarUrl} size={60} />
              
              <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} 
                />
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <Upload size={14} /> Upload Photo
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={saving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: '#ef4444'
                      }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Drag & drop an image or click upload (JPG, PNG, WebP)
                </span>
              </div>
            </div>
          </div>

          <div className="actions-row">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : <><Save size={14} /> Save Profile</>}
            </Button>
          </div>
        </div>

        <div className="editor-preview">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 600 }}>Card Preview</h3>
          <div className="preview-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <AvatarDisplay name={displayName} avatarUrl={avatarUrl} size={64} />
            <div className="preview-name" style={{ marginTop: '12px', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{displayName || 'Your Name'}</div>
            <p className="preview-bio" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '12px', wordBreak: 'break-word' }}>
              {bio || DEFAULT_ENHANCED_BIO}
            </p>

            <div className="uid-section" style={{ width: '100%', marginTop: '8px' }}>
              <UIDDisplay uid={uid} isLoading={uid === 'Loading...'} />
              {uid !== 'Loading...' && (
                <div style={{ marginTop: '16px' }}>
                  <QRCodeSection uid={uid} size={150} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EditProfileModal;
