import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Copy, Download, ImageIcon } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './EditProfileModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: any | null;
  onSaved: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\-\s\+]{6,20}$/;

const EditProfileModal: React.FC<Props> = ({ isOpen, onClose, profile, onSaved }) => {
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});
  const uid = profile?.uid || 'SEC_8f7d6e5c4b3a';
  const qrRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
      setEmail(profile.email || '');
      setPhone((profile as any).phone || '');
      setErrors({});
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

  const validate = () => {
    const e: any = {};
    if (email && !EMAIL_REGEX.test(email)) e.email = 'Invalid email';
    if (phone && !PHONE_REGEX.test(phone)) e.phone = 'Invalid phone (numbers, +, dashes allowed)';
    setErrors(e);
    return Object.keys(e).length === 0;
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
    if (!validate()) return;
    setSaving(true);
    try {
      // If there's an avatar file, in a real app we'd upload it. Here we'll use data URL or avatarUrl input.
      const payload: any = { displayName, avatarUrl, bio, phone, email };
      const res = await fetch('/api/users/me', {
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

            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <div className="field-error">{errors.email}</div>}

            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-0100" />
            {errors.phone && <div className="field-error">{errors.phone}</div>}

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
              <div className="preview-email">{email || 'you@example.com'}</div>
              <div className="preview-phone">{phone || ''}</div>
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
