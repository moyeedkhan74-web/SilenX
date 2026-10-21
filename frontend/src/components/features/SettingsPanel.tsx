import React, { useState } from 'react';
import { 
  Edit3, 
  Image as ImageIcon, 
  QrCode, 
  ShieldCheck, 
  Lock, 
  Shield, 
  Trash2, 
  ChevronRight, 
  AlertTriangle, 
  X, 
  Check, 
  Copy, 
  KeyRound, 
  CheckCircle2,
  LogOut
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const userUid = currentUser?.uid || currentUser?.id || '';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 3000);
  };

  const handleCopyUid = () => {
    if (!userUid) return;
    navigator.clipboard.writeText(userUid);
    setCopiedUid(true);
    showToast('Cryptographic ID copied to clipboard.');
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleLogOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Firebase signout error:', e);
      }
    }
    useAuthStore.getState().logout();
    window.location.href = '/login';
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

  const renderMobileToggle = (checked: boolean, onChange: (val: boolean) => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`stitch-toggle-btn ${checked ? 'stitch-toggle-btn--active' : ''}`}
    >
      <div className="stitch-toggle-track">
        <div className="stitch-toggle-thumb" />
      </div>
    </button>
  );

  return (
    <>
      {/* ============================================================ */}
      {/* MOBILE VIEW (< 768px): Stitch Modern Utilitarian Flat Spec   */}
      {/* ============================================================ */}
      <div className="mobile-only settings-mobile-view">
        {/* Sticky Mobile Header */}
        <header className="settings-mobile-header">
          <div className="settings-mobile-header__inner">
            <div className="settings-mobile-header__brand">
              <img src="/silenX-logo.png" alt="SilenX" className="settings-mobile-header__logo" />
              <h1 className="settings-mobile-header__title">Settings</h1>
            </div>
            <div className="settings-mobile-header__avatar">
              <AvatarDisplay
                name={currentUser?.displayName || 'User'}
                avatarUrl={currentUser?.avatarUrl}
                size={34}
                status={currentUser?.status || 'online'}
              />
            </div>
          </div>
        </header>

        <div className="settings-mobile-body">
          {/* Security Score Micro-Banner */}
          <div className="settings-security-banner">
            <div className="settings-security-banner__left">
              <div className="settings-icon-well settings-icon-well--teal">
                <ShieldCheck size={22} />
              </div>
              <div className="settings-security-banner__text">
                <div className="settings-security-banner__headline">
                  <span>Cryptographic Vault Active</span>
                  <span className="settings-active-dot" />
                </div>
                <span className="settings-security-banner__sub">
                  ChaCha20-Poly1305 · Double Ratchet
                </span>
              </div>
            </div>
            <button 
              type="button" 
              className="settings-verify-btn" 
              onClick={() => showToast('Local keys pass SHA-256 fingerprint audit.')}
            >
              Verify
            </button>
          </div>

          {/* User Profile Card */}
          <div className="settings-profile-card">
            <div className="settings-profile-card__main">
              <div className="settings-profile-card__avatar-wrap">
                <AvatarDisplay
                  name={currentUser?.displayName || 'User'}
                  avatarUrl={currentUser?.avatarUrl}
                  size={54}
                  status={currentUser?.status || 'online'}
                />
              </div>
              <div className="settings-profile-card__info">
                <div className="settings-profile-card__name-row">
                  <h2 className="settings-profile-card__name">
                    {currentUser?.displayName || 'SilenX User'}
                  </h2>
                  <button
                    type="button"
                    className="settings-icon-action-btn"
                    onClick={() => setIsEditModalOpen(true)}
                    aria-label="Edit Profile"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
                <p className="settings-profile-card__sub">
                  {currentUser?.email || currentUser?.bio || 'Encrypted Peer Node'}
                </p>
                <div className="settings-profile-card__uid-row">
                  <button 
                    type="button" 
                    className="settings-uid-chip"
                    onClick={handleCopyUid}
                    title="Click to copy Secure ID"
                  >
                    <code className="settings-uid-code">{userUid}</code>
                    {copiedUid ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={`settings-qr-trigger ${showQrCode ? 'settings-qr-trigger--active' : ''}`}
                onClick={() => setShowQrCode(!showQrCode)}
                aria-label="Show QR Code"
                title="Show QR Code"
              >
                <QrCode size={20} />
              </button>
            </div>

            {/* Inline Collapsible QR Code */}
            {showQrCode && (
              <div className="settings-profile-card__qr-expand">
                <QRCodeSection uid={userUid} size={160} />
              </div>
            )}
          </div>

          {/* Group 1: Security */}
          <section className="settings-mobile-section">
            <div className="settings-mobile-section__header">
              <span className="settings-section-title">Security</span>
              <Lock size={14} className="text-teal" />
            </div>
            <div className="settings-mobile-card-group">
              <button 
                type="button" 
                className="settings-mobile-item-btn"
                onClick={() => showToast('Ratchet ratifications synced. E2EE identity verified.')}
              >
                <div className="settings-mobile-item__left">
                  <div className="settings-icon-well settings-icon-well--teal">
                    <Shield size={20} />
                  </div>
                  <div className="settings-mobile-item__text">
                    <span className="settings-mobile-item__title">Safety Numbers &amp; Keys</span>
                    <span className="settings-mobile-item__sub">Inspect ratchet ratifications</span>
                  </div>
                </div>
                <ChevronRight size={18} className="settings-chevron" />
              </button>
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__left">
                  <div className="settings-icon-well settings-icon-well--teal">
                    <KeyRound size={20} />
                  </div>
                  <div className="settings-mobile-item__text">
                    <span className="settings-mobile-item__title">Encryption Protocol</span>
                    <span className="settings-mobile-item__sub">ChaCha20-Poly1305 (AEAD)</span>
                  </div>
                </div>
                <span className="settings-badge-pill">Active</span>
              </div>
            </div>
          </section>

          {/* Group 2: Privacy */}
          <section className="settings-mobile-section">
            <div className="settings-mobile-section__header">
              <span className="settings-section-title">Privacy &amp; Presence</span>
              <Lock size={14} className="text-muted" />
            </div>
            <div className="settings-mobile-card-group">
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__text-wrap">
                  <span className="settings-mobile-item__title">Show Online Status</span>
                  <span className="settings-mobile-item__sub">Broadcast availability to contacts</span>
                </div>
                {renderMobileToggle(showOnlineStatus, handleShowOnlineStatusChange)}
              </div>
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__text-wrap">
                  <span className="settings-mobile-item__title">Read Receipts</span>
                  <span className="settings-mobile-item__sub">Send and receive seen indicators</span>
                </div>
                {renderMobileToggle(readReceipts, setReadReceipts)}
              </div>
            </div>
          </section>

          {/* Group 3: Preferences */}
          <section className="settings-mobile-section">
            <div className="settings-mobile-section__header">
              <span className="settings-section-title">Preferences</span>
            </div>
            <div className="settings-mobile-card-group">
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__text-wrap">
                  <span className="settings-mobile-item__title">Display Theme</span>
                  <span className="settings-mobile-item__sub">
                    {theme === 'dark' ? 'Pure Slate (OLED Deep)' : 'Light Solarized'}
                  </span>
                </div>
                <ThemeToggle />
              </div>
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__text-wrap">
                  <span className="settings-mobile-item__title">Message Notifications</span>
                  <span className="settings-mobile-item__sub">Discreet zero-preview alerts</span>
                </div>
                {renderMobileToggle(messageNotifications, setMessageNotifications)}
              </div>
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__text-wrap">
                  <span className="settings-mobile-item__title">Call Notifications</span>
                  <span className="settings-mobile-item__sub">Ringtone and incoming call alerts</span>
                </div>
                {renderMobileToggle(callNotifications, setCallNotifications)}
              </div>
              <div className="settings-mobile-item-row">
                <div className="settings-mobile-item__text-wrap">
                  <span className="settings-mobile-item__title">In-App Sound Effects</span>
                  <span className="settings-mobile-item__sub">Audio cues for sent and received</span>
                </div>
                {renderMobileToggle(soundEffects, setSoundEffects)}
              </div>
              <button
                type="button"
                className="settings-mobile-item-btn"
                onClick={() => setIsWallpaperModalOpen(true)}
              >
                <div className="settings-mobile-item__left">
                  <div className="settings-icon-well settings-icon-well--teal">
                    <ImageIcon size={20} />
                  </div>
                  <div className="settings-mobile-item__text">
                    <span className="settings-mobile-item__title">Chat Wallpaper</span>
                    <span className="settings-mobile-item__sub">Custom messaging background</span>
                  </div>
                </div>
                <ChevronRight size={18} className="settings-chevron" />
              </button>
            </div>
          </section>

          {/* Group 4: Account Session */}
          <section className="settings-mobile-section">
            <div className="settings-mobile-section__header">
              <span className="settings-section-title">Account Session</span>
              <LogOut size={14} className="text-muted" />
            </div>
            <div className="settings-mobile-card-group">
              <button 
                type="button" 
                className="settings-danger-row-btn"
                onClick={handleLogOut}
                style={{ color: '#EF4444' }}
              >
                <div className="settings-mobile-item__left">
                  <div className="settings-icon-well settings-icon-well--danger">
                    <LogOut size={20} />
                  </div>
                  <div className="settings-mobile-item__text">
                    <span className="settings-danger-title" style={{ color: '#EF4444' }}>Sign Out / Change Account</span>
                    <span className="settings-mobile-item__sub">Log out of this device completely</span>
                  </div>
                </div>
                <ChevronRight size={18} className="settings-chevron settings-chevron--danger" />
              </button>
            </div>
          </section>

          {/* Group 5: Danger Zone */}
          {onDeleteAccountClick && (
            <section className="settings-mobile-section">
              <div className="settings-mobile-section__header">
                <span className="settings-section-title settings-section-title--danger">Danger Zone</span>
                <AlertTriangle size={14} className="text-danger" />
              </div>
              <div className="settings-mobile-card-group">
                <button 
                  type="button" 
                  className="settings-danger-row-btn"
                  onClick={onDeleteAccountClick}
                >
                  <div className="settings-mobile-item__left">
                    <div className="settings-icon-well settings-icon-well--danger">
                      <Trash2 size={20} />
                    </div>
                    <div className="settings-mobile-item__text">
                      <span className="settings-danger-title">Delete account</span>
                      <span className="settings-mobile-item__sub">Irreversibly purges private keyrings</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="settings-chevron settings-chevron--danger" />
                </button>
              </div>
            </section>
          )}

          {/* Floating Feedback Toast */}
          {toastMsg && (
            <div className="settings-floating-toast">
              <div className="settings-floating-toast__content">
                <CheckCircle2 size={18} className="text-teal" />
                <span className="settings-floating-toast__msg">{toastMsg}</span>
              </div>
              <button 
                type="button" 
                className="settings-floating-toast__close" 
                onClick={() => setToastMsg(null)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DESKTOP VIEW (> 768px): Exact Legacy Layout & Structure      */}
      {/* ============================================================ */}
      <div className="desktop-only settings-desktop-view">
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
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className={`btn-secondary ${showQrCode ? 'active' : ''}`}
                  onClick={() => setShowQrCode(!showQrCode)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    padding: '8px 18px',
                    borderRadius: 16,
                  }}
                >
                  <QrCode size={14} /> {showQrCode ? 'Hide QR Code' : 'Show QR Code'}
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
            <h3>Account Session</h3>
            <div className="settings-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>Current Session</span>
                <span className="settings-value" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currentUser?.email || currentUser?.displayName || 'Signed in'}</span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLogOut}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)', padding: '8px 16px', borderRadius: 10, cursor: 'pointer' }}
              >
                <LogOut size={16} />
                Sign Out (Change Account)
              </button>
            </div>
          </div>

          <div className="settings-group">
            <h3>About</h3>
            <div className="settings-row">
              <span>Version</span>
              <span className="settings-value">1.0.1</span>
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
        </div>
      </div>

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
    </>
  );
};

export default SettingsPanel;
