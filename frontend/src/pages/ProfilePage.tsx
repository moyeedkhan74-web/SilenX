import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';
import ProfileCard from '../components/features/ProfileCard';
import EditProfileModal from '../components/EditProfileModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import '../components/ProfileTab.css';

interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  status: string;
  bio: string;
  avatarUrl?: string | null;
}

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useAuthStore((s) => s.user);

  const loadProfile = async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: {
          'x-user-id': currentUser.id,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [currentUser]);

  return (
    <div className="profile-tab" style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {isLoading && !profile ? (
        <LoadingSpinner message="Decrypting profile signatures..." />
      ) : (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <ProfileCard 
            profile={profile || (currentUser ? {
              id: currentUser.id,
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              status: currentUser.status,
              bio: currentUser.bio,
              avatarUrl: currentUser.avatarUrl
            } as any : null)} 
            onEditClick={() => setIsEditOpen(true)} 
          />

          <EditProfileModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            profile={profile}
            onSaved={() => loadProfile()}
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
