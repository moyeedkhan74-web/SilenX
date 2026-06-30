import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import '../../components/SettingsTab.css';

interface SettingsPanelProps {
  onDeleteAccountClick?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onDeleteAccountClick }) => {
  const {
    isDarkMode,
    messageNotifications,
    callNotifications,
    showOnlineStatus,
    readReceipts,
    setDarkMode,
    setMessageNotifications,
    setCallNotifications,
    setShowOnlineStatus,
    setReadReceipts,
  } = useSettingsStore();

  return (
    <div className="settings-card">
      <div className="settings-group">
        <h3>Appearance</h3>
        <div className="settings-row">
          <span>Dark Mode</span>
          <label className="toggle">
            <input 
              type="checkbox" 
              checked={isDarkMode} 
              onChange={(e) => setDarkMode(e.target.checked)} 
            />
            <span className="toggle-slider"></span>
          </label>
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
      </div>

      <div className="settings-group">
        <h3>Privacy</h3>
        <div className="settings-row">
          <span>Show Online Status</span>
          <label className="toggle">
            <input 
              type="checkbox" 
              checked={showOnlineStatus} 
              onChange={(e) => setShowOnlineStatus(e.target.checked)} 
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
          <span className="settings-value" style={{ color: 'var(--secondary-light)' }}>ChaCha20-Poly1305</span>
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
  );
};

export default SettingsPanel;
