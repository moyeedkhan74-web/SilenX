import React from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsPanel from '../components/features/SettingsPanel';
import '../components/SettingsTab.css';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      'Are you sure you want to permanently delete your secure account? This action is irreversible.'
    );
    if (!confirmDelete) return;

    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Delete request failed');
      }

      logout();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('slienx-chat-state-')) {
          localStorage.removeItem(key);
        }
      });
      navigate('/login');
    } catch (error) {
      console.error('Failed to delete account:', error);
      window.alert('Account deletion failed. Please try again.');
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
