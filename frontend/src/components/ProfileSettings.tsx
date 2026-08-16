import React, { useState } from 'react';
import { ImageCropperModal } from './ImageCropperModal';
import { useAuthStore } from '../store/authStore';
import { Avatar } from './Avatar';
import { Camera } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ padding: '24px', color: '#fff' }}>
      <h2>Profile Settings</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={user?.displayName || 'User'} size={80} avatarUrl={avatarUrl} />
          <label
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: 'var(--color-accent, #6366f1)',
              borderRadius: '50%',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <Camera size={16} />
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
        </div>
        <div>
          <h3>{user?.displayName || 'User'}</h3>
          <p style={{ color: '#a1a1aa', margin: 0 }}>{user?.email || ''}</p>
        </div>
      </div>

      {tempImage && (
        <ImageCropperModal
          isOpen={cropperOpen}
          imageSrc={tempImage}
          aspectRatio="1:1"
          onClose={() => setCropperOpen(false)}
          onCropComplete={(croppedUrl) => {
            setAvatarUrl(croppedUrl);
            setCropperOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default ProfileSettings;