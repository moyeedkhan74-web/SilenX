import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import './EditProfileModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    displayName: string;
    avatarUrl?: string | null;
    bio?: string;
  } | null;
  onSaved: () => void;
}

const EditProfileModal: React.FC<Props> = ({ isOpen, onClose, profile, onSaved }) => {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, avatarUrl, bio }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.message || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Save profile failed:', err);
      alert('Network error while saving profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <h2>Edit Profile</h2>

        <label className="form-label">Display Name</label>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

        <label className="form-label">Avatar URL (optional)</label>
        <input className="input" value={avatarUrl || ''} onChange={(e) => setAvatarUrl(e.target.value)} />

        <label className="form-label">Bio</label>
        <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} />

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
