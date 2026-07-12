import React from 'react';

const COLORS = ['var(--avatar-color-1)', 'var(--avatar-color-2)', 'var(--avatar-color-3)', 'var(--avatar-color-4)', 'var(--avatar-color-5)', 'var(--avatar-color-6)', 'var(--avatar-color-7)', 'var(--avatar-color-8)', 'var(--avatar-color-9)'];

function hashColor(name = '') {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarDisplayProps {
  name?: string;
  avatarUrl?: string | null;
  size?: number;
  online?: boolean;
  status?: string;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  name = '',
  avatarUrl,
  size = 40,
  online,
  status
}) => {
  const isOnline = online !== undefined ? online : status === 'online';
  const initials = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="avatar-display-container" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
          }}
          onError={(e) => {
            // Fallback when image loading fails
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: hashColor(name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-on-accent)',
            fontSize: size * 0.38,
            fontWeight: 700,
            userSelect: 'none',
            letterSpacing: '-0.5px',
          }}
        >
          {initials}
        </div>
      )}
      
      {isOnline !== undefined && (
        <span
          className={`status-dot ${isOnline ? 'online' : 'offline'}`}
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: Math.max(size * 0.26, 10),
            height: Math.max(size * 0.26, 10),
            borderRadius: '50%',
            background: isOnline ? 'var(--color-accent)' : 'var(--text-tertiary)',
            border: '2px solid var(--color-bg)',
          }}
        />
      )}
    </div>
  );
};

export default AvatarDisplay;
