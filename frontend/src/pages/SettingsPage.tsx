import React from 'react';
import SettingsPanel from '../components/features/SettingsPanel';
import '../components/SettingsTab.css';

export const SettingsPage: React.FC = () => {
  const handleDeleteAccount = () => {
    const confirmDelete = window.confirm(
      'Are you sure you want to permanently delete your secure account? This action is irreversible.'
    );
    if (confirmDelete) {
      alert('Delete account requested. This feature is not fully implemented in the current prototype.');
    }
  };

  return (
    <div className="settings-tab" style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2>Settings</h2>
        <SettingsPanel onDeleteAccountClick={handleDeleteAccount} />
      </div>
    </div>
  );
};

export default SettingsPage;
