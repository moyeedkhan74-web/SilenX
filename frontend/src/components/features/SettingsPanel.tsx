import React, { useState } from 'react';
import { Edit3, Image as ImageIcon, QrCode, Copy, Download, Check } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/useTheme';
import ThemeToggle from '../ThemeToggle';
import AvatarDisplay from '../shared/AvatarDisplay';
import UIDDisplay from '../shared/UIDDisplay';
import QRCodeSection from '../shared/QRCodeSection';
import EditProfileModal from '../EditProfileModal';
import WallpaperPicker from '../WallpaperPicker';
import { API_URL } from '../../config/webrtc-config';
import '../../components/SettingsTab.css';

interface SettingsPanelProps {
  onDeleteAccountClick?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onDeleteAccountClick }) => {
  const {
    messageNotifications,
    callNotifications,
    showOnlineStatus,
    readReceipts,
    soundEffects,
    setMessageNotifications,
    setCallNotifications,
    setShowOnlineStatus,
    setReadReceipts,
    setSoundEffects,
  } = useSettingsStore();
  const { theme } = useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const userUid = currentUser?.uid || currentUser?.id || '';

  const handleCopyUid = async () => {
    if (!userUid) return;
    try {
      await navigator.clipboard.writeText(userUid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      alert('Failed to copy Secure ID');
    }
  };

  const handleDownloadQr = async () => {
    if (!userUid) return;
    try {
      const deepLink = `slienx://uid/${userUid}`;
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(deepLink, {
        errorCorrectionLevel: 'H',
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        width: 512,
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${userUid}_qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download QR code');
    }
  };

  /**
   * Toggle showOnlineStatus: save locally, persist to backend, and update
   * the in-memory user record so other components (AvatarDisplay etc.) see the change.
   */
  const handleShowOnlineStatusChange = async (value: boolean) => {
    setShowOnlineStatus(value); // update local settings store immediately (optimistic)
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ showOnlineStatus: value }),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        login({ ...currentUser, ...updatedUser }, token);
      }
    } catch (err) {
      console.error('[Settings] Failed to update showOnlineStatus on server', err);
      // Revert on failure
      setShowOnlineStatus(!value);
    }
  };

  const handleProfileSaved = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updatedUser = await res.json();
        login(updatedUser, token);
      }
    } catch (err) {
      console.error('Failed to sync profile after save', err);
    }
  };

  return (
    <div className="settings-card">
      <div className="settings-group profile-settings-header" style={{ marginBottom: 24 }}>
        <h3>Profile</h3>
        <div className="profile-header-row" style={{ paddingTop: 4 }}>
          <AvatarDisplay
            name={currentUser?.displayName || 'User'}
            avatarUrl={currentUser?.avatarUrl}
            size={48}
            status={currentUser?.status || 'online'}
          />
          <div className="profile-header-meta">
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentUser?.displayName || 'User Profile'}
            </h2>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentUser?.bio || currentUser?.email || 'No bio set'}
            </p>
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-primary)',
                fontWeight: 600,
                display: 'inline-block',
                marginTop: 2,
              }}
            >
              ID: {userUid}
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsEditModalOpen(true)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 18,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            <Edit3 size={13} /> Edit Profile
          </button>
        </div>
      </div>

      <div className="settings-group" style={{ marginBottom: 24 }}>
        <h3>My Secure ID &amp; QR Code</h3>
        <div style={{ marginTop: 8 }}>
          <UIDDisplay uid={userUid} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyUid}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                padding: '8px 12px',
              }}
            >
              {copiedUid ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
              {copiedUid ? 'Copied!' : 'Copy UID'}
            </button>
            <button
              type="button"
              className={`btn-secondary ${showQrCode ? 'active' : ''}`}
              onClick={() => setShowQrCode(!showQrCode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                padding: '8px 12px',
              }}
            >
              <QrCode size={13} /> {showQrCode ? 'Hide QR' : 'Show QR'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadQr}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                padding: '8px 12px',
              }}
            >
              <Download size={13} /> Download
            </button>
          </div>
          {showQrCode && (
            <div style={{ marginTop: 16 }}>
              <QRCodeSection uid={userUid} size={180} />
            </div>
          )}
        </div>
      </div>



      <div className="settings-group">
        <h3>Appearance</h3>
        <div className="settings-row">
          <span>Theme</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <ThemeToggle />
          </div>
        </div>
        <div className="settings-row">
          <span>Chat Wallpaper</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsWallpaperModalOpen(true)}
            style={{
              padding: '6px 14px',
              fontSize: 12.5,
              borderRadius: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <ImageIcon size={14} /> Change Wallpaper
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3>Notifications</h3>
        <div className="settings-row">
          <span>Message Notifications</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={messageNotifications}
              onChange={(e) => setMessageNotifications(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="settings-row">
          <span>Call Notifications</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={callNotifications}
              onChange={(e) => setCallNotifications(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="settings-row">
          <span>In-App Sound Effects</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={soundEffects}
              onChange={(e) => setSoundEffects(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>Privacy</h3>
        <div className="settings-row">
          <span>Show Online Status</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => handleShowOnlineStatusChange(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="settings-row">
          <span>Read Receipts</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={readReceipts}
              onChange={(e) => setReadReceipts(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>About</h3>
        <div className="settings-row">
          <span>Version</span>
          <span className="settings-value">1.0.0</span>
        </div>
        <div className="settings-row">
          <span>Encryption</span>
          <span className="settings-value encryption-label" style={{ color: 'var(--color-primary)' }}>
            ChaCha20-Poly1305
          </span>
        </div>
      </div>

      {onDeleteAccountClick && (
        <button
          className="btn-danger"
          onClick={onDeleteAccountClick}
          style={{ marginTop: 24, width: '100%' }}
        >
          Delete Account
        </button>
      )}

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={currentUser}
        onSaved={handleProfileSaved}
      />
      <WallpaperPicker
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
      />
    </div>
  );
};

export default SettingsPanel;
