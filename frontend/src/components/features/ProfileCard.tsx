import React, { useState } from 'react';
import { QrCode, Copy, Download, Edit3, Mail, Check } from 'lucide-react';
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
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedBio, setCopiedBio] = useState(false);

  const uid = profile?.uid || 'Loading...';
  const name = profile?.displayName || 'Loading...';
  const email = profile?.email || '';
  const status = profile?.status || 'offline';
  const defaultEnhancedBio = "Hey!! I'm using SilenX 🔒";
  const bio = profile?.bio && profile.bio.trim() ? profile.bio : defaultEnhancedBio;
  const avatarUrl = profile?.avatarUrl;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleCopyBio = () => {
    navigator.clipboard.writeText(bio);
    setCopiedBio(true);
    setTimeout(() => setCopiedBio(false), 2000);
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
    <div className="profile-card" style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <AvatarDisplay name={name} avatarUrl={avatarUrl} size={88} status={status} />
        <h2 className="profile-name" style={{ marginTop: '16px', marginBottom: '4px', fontSize: '22px', fontWeight: 700 }}>{name}</h2>
        {email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--text-secondary)', fontSize: '13px', background: 'var(--bg-primary)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <Mail size={13} style={{ color: 'var(--color-primary)' }} />
            <span>{email}</span>
          </div>
        )}
        <span className={`profile-status ${status}`} style={{ textTransform: 'capitalize', marginTop: '8px', fontSize: '12px', color: status === 'online' ? 'var(--color-accent)' : 'var(--text-tertiary)' }}>
          ● {status === 'online' ? 'Online' : status}
        </span>
      </div>

      <div className="profile-uid-section" style={{ marginBottom: '24px' }}>
        <label className="profile-uid-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
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
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
          >
            {copiedUid ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
            {copiedUid ? 'Copied!' : 'Copy UID'}
          </button>
          
          <button 
            type="button" 
            className={`btn-secondary ${showQr ? 'active' : ''}`} 
            onClick={() => setShowQr(!showQr)}
            disabled={uid === 'Loading...'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
          >
            <QrCode size={13} /> {showQr ? 'Hide QR' : 'Show QR'}
          </button>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleDownloadQr}
            disabled={uid === 'Loading...'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
          >
            <Download size={13} /> Download
          </button>
        </div>
      </div>

      {showQr && uid !== 'Loading...' && (
        <div style={{ marginBottom: '24px' }}>
          <QRCodeSection uid={uid} size={160} />
        </div>
      )}

      <div className="profile-bio-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>Bio</label>
          <button
            type="button"
            onClick={handleCopyBio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: copiedBio ? '#22c55e' : 'var(--color-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            {copiedBio ? <Check size={12} /> : <Copy size={12} />}
            {copiedBio ? 'Copied Bio!' : 'Copy Bio'}
          </button>
        </div>
        <p className="profile-bio" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', minHeight: '42px', wordBreak: 'break-word' }}>
          {bio}
        </p>
      </div>

      <button 
        type="button" 
        className="btn btn-primary" 
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
        onClick={onEditClick}
      >
        <Edit3 size={15} /> Edit Profile
      </button>
    </div>
  );
};

export default ProfileCard;
