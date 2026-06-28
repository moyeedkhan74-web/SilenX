import React, { useState, useEffect } from 'react';
import { Copy, Download, QrCode } from 'lucide-react';
import UIDShareModal from './UIDShareModal';
import './ProfileTab.css';

interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  status: string;
  bio: string;
}

const ProfileTab: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => setProfile(data))
      .catch(err => console.error('Failed to fetch profile:', err));
  }, []);

  const uid = profile?.uid || 'Loading...';

  const copyUid = () => {
    navigator.clipboard.writeText(uid);
    alert('UID copied!');
  };

  const downloadQr = async () => {
    try {
      const res = await fetch('/api/users/me/qr');
      if (!res.ok) throw new Error('Failed to fetch QR');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${uid}_qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('QR download failed:', err);
      alert('Failed to download QR code.');
    }
  };

  return (
    <div className="profile-tab">
      <div className="profile-card">
        <div className="profile-avatar-lg">{profile?.displayName?.[0] || 'U'}</div>
        <h2 className="profile-name">{profile?.displayName || 'Loading...'}</h2>
        <p className="profile-email">{profile?.email || ''}</p>
        <span className={`profile-status ${profile?.status || ''}`}>● {profile?.status === 'online' ? 'Online' : profile?.status || ''}</span>

        <div className="profile-uid-section">
          <label className="profile-uid-label">Your Secure ID</label>
          <div className="profile-uid-display">
            <code className="profile-uid-text">{uid}</code>
          </div>
          <div className="profile-uid-actions">
            <button className="btn-secondary" onClick={copyUid}><Copy size={16} /> Copy UID</button>
            <button className="btn btn-primary" onClick={() => setIsShareOpen(true)}><QrCode size={16} /> Show QR</button>
            <button className="btn-secondary" onClick={downloadQr}><Download size={16} /> Download QR</button>
          </div>
        </div>

        <div className="profile-bio-section">
          <label>Bio</label>
          <p className="profile-bio">{profile?.bio || ''}</p>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 24, width: '100%' }}>Edit Profile</button>
      </div>

      <UIDShareModal 
        isOpen={isShareOpen} 
        onClose={() => setIsShareOpen(false)} 
        uid={uid} 
      />
    </div>
  );
};

export default ProfileTab;
