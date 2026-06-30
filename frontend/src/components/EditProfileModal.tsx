import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Copy, Download, ImageIcon } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './EditProfileModal.css';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: any | null;
  onSaved: () => void;
}

const EditProfileModal: React.FC<Props> = ({ isOpen, onClose, profile, onSaved }) => {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const uid = profile?.uid || currentUser?.uid || 'Loading...';
  const qrRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleFileSelect = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  const handleCopyUid = async () => {
    await navigator.clipboard.writeText(uid);
    alert('UID copied');
  };

  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uid}_qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // If there's an avatar file, in a real app we'd upload it. Here we'll use data URL or avatarUrl input.
      const payload: any = { displayName, avatarUrl, bio };
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-profile-modal dark" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        <div className="editor-grid">
          <div className="editor-form">
            <h2>Edit Profile</h2>
            <label>Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />

            <label>Avatar (drag & drop or paste URL)</label>
            <div className="avatar-uploader" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
              <div className="uploader-inner">
                <ImageIcon size={28} />
                <input type="file" accept="image/*" onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
                <input className="avatar-url-input" placeholder="Image URL or leave empty" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
              </div>
            </div>

            <div className="actions-row">
              <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : <><Save size={14} /> Save</>}</button>
            </div>
          </div>

          <div className="editor-preview">
            <h3>Preview</h3>
            <div className="preview-card">
              <div className="preview-avatar" style={{backgroundImage: `url(${avatarUrl || ''})`}}>{!avatarUrl && (displayName?.[0] || 'U')}</div>
              <div className="preview-name">{displayName || 'Your Name'}</div>
              <p className="preview-bio">{bio || 'Your bio appears here.'}</p>

              <div className="uid-section">
                <div className="uid-row">
                  <code className="uid-code">{uid}</code>
                  <div className="uid-actions">
                    <button className="btn" onClick={handleCopyUid}><Copy size={14} /></button>
                    <button className="btn" onClick={() => setTimeout(() => { /* noop for visual */ }, 0)}><Download size={14} /></button>
                  </div>
                </div>

                <div className="qr-wrap" ref={qrRef}>
                  <QRCodeCanvas value={uid} size={180} level="H" includeMargin={true} />
                </div>
                <div style={{marginTop:8}}>
                  <button className="btn btn-secondary" onClick={handleDownloadQr}>Download QR</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
