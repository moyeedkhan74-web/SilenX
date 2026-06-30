import React, { useState, useEffect } from 'react';
import { Save, ImageIcon } from 'lucide-react';
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

export const EditProfileModal: React.FC<Props> = ({ isOpen, onClose, profile, onSaved }) => {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  
  const currentUser = useAuthStore((s) => s.user);
  const uid = profile?.uid || currentUser?.uid || 'Loading...';

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
    }
    setDisplayNameError('');
  }, [profile, isOpen]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleFileSelect = (f: File) => {
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(f);
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
          alert('Avatar upload failed');
          return;
        }
      }

      const payload: any = { displayName, avatarUrl: finalAvatarUrl, bio };
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.message || 'Failed to save');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="edit-profile-modal dark">
      <div className="editor-grid">
        <div className="editor-form">
          <h2>Edit Profile</h2>
          
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

          <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <label className="input-label" style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Bio (optional)
            </label>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)} 
              disabled={saving}
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
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="input-label" style={{ display: 'block', fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Avatar (drag & drop or paste URL)
            </label>
            <div className="avatar-uploader" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
              <div className="uploader-inner">
                <ImageIcon size={28} />
                <input type="file" accept="image/*" onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
                <input 
                  className="avatar-url-input" 
                  placeholder="Image URL or leave empty" 
                  value={avatarUrl} 
                  onChange={(e) => setAvatarUrl(e.target.value)} 
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="actions-row">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : <><Save size={14} /> Save</>}
            </Button>
          </div>
        </div>

        <div className="editor-preview">
          <h3>Preview</h3>
          <div className="preview-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <AvatarDisplay name={displayName} avatarUrl={avatarUrl} size={64} />
            <div className="preview-name" style={{ marginTop: '12px', fontWeight: 600 }}>{displayName || 'Your Name'}</div>
            <p className="preview-bio" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bio || 'Your bio appears here.'}</p>

            <div className="uid-section" style={{ width: '100%', marginTop: '16px' }}>
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
