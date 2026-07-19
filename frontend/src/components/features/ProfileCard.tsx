import React, { useState } from 'react';
import { QrCode, Copy, Download, Edit3 } from 'lucide-react';
import AvatarDisplay from '../shared/AvatarDisplay';
import UIDDisplay from '../shared/UIDDisplay';
import QRCodeSection from '../shared/QRCodeSection';

interface ProfileCardProps {
  profile: {
    id: string;
    uid: string;
    email: string;
    displayName: string;
    status: string;
    bio: string;
    avatarUrl?: string | null;
  } | null;
  onEditClick: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onEditClick
}) => {
  const [showQr, setShowQr] = useState(false);

  const uid = profile?.uid || 'Loading...';
  const name = profile?.displayName || 'Loading...';
  const email = profile?.email || '';
  const status = profile?.status || 'offline';
  const bio = profile?.bio || 'No bio provided.';
  const avatarUrl = profile?.avatarUrl;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(uid);
    alert('UID copied!');
  };

  const handleDownloadQr = async () => {
    try {
      const { API_URL } = await import('../../config/webrtc-config');
      const { useAuthStore } = await import('../../store/authStore');
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/users/me/qr`, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
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
    <div className="profile-card">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <AvatarDisplay name={name} avatarUrl={avatarUrl} size={80} status={status} />
        <h2 className="profile-name" style={{ marginTop: '16px', marginBottom: '4px' }}>{name}</h2>
        <p className="profile-email" style={{ marginTop: 0, color: 'var(--text-tertiary)' }}>{email}</p>
        <span className={`profile-status ${status}`} style={{ textTransform: 'capitalize' }}>
          ● {status === 'online' ? 'Online' : status}
        </span>
      </div>

      <div className="profile-uid-section" style={{ marginBottom: '24px' }}>
        <label className="profile-uid-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
          Secure ID
        </label>
        <UIDDisplay uid={uid} isLoading={uid === 'Loading...'} />
        
        <div className="profile-uid-actions" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginTop: '12px'
        }}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleCopyUid}
            disabled={uid === 'Loading...'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px' }}
          >
            <Copy size={13} /> Copy UID
          </button>
          
          <button 
            type="button" 
            className={`btn-secondary ${showQr ? 'active' : ''}`} 
            onClick={() => setShowQr(!showQr)}
            disabled={uid === 'Loading...'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px' }}
          >
            <QrCode size={13} /> {showQr ? 'Hide QR' : 'Show QR'}
          </button>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleDownloadQr}
            disabled={uid === 'Loading...'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px' }}
          >
            <Download size={13} /> Download
          </button>
        </div>
      </div>

      {showQr && uid !== 'Loading...' && (
        <div style={{ marginBottom: '24px' }}>
          <QRCodeSection uid={uid} size={150} />
        </div>
      )}

      <div className="profile-bio-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontWeight: 500 }}>Bio</label>
        <p className="profile-bio" style={{ margin: 0, color: 'var(--text-primary)', minHeight: '36px' }}>{bio}</p>
      </div>

      <button 
        type="button" 
        className="btn btn-primary" 
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        onClick={onEditClick}
      >
        <Edit3 size={15} /> Edit Profile
      </button>
    </div>
  );
};

export default ProfileCard;
