import React, { useState, useEffect } from 'react';
import './SettingsTab.css';

const SettingsTab: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setIsDarkMode(currentTheme === 'dark');
  }, []);

  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsDarkMode(checked);
    const newTheme = checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <div className="settings-tab">
      <div className="settings-card">
        <h2>Settings</h2>

        <div className="settings-group">
          <h3>Appearance</h3>
          <div className="settings-row">
            <span>Dark Mode</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={isDarkMode} 
                onChange={handleThemeChange} 
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
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="settings-row">
            <span>Call Notifications</span>
            <label className="toggle">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-group">
          <h3>Privacy</h3>
          <div className="settings-row">
            <span>Show Online Status</span>
            <label className="toggle">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="settings-row">
            <span>Read Receipts</span>
            <label className="toggle">
              <input type="checkbox" defaultChecked />
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

        <button className="btn-danger" style={{ marginTop: 24, width: '100%' }}>Delete Account</button>
      </div>
    </div>
  );
};

export default SettingsTab;
