import React, { useState, useEffect } from 'react';

const COLORS = [
  'var(--avatar-color-1, #14B8A6)', 'var(--avatar-color-2, #0EA5E9)', 'var(--avatar-color-3, #818CF8)',
  'var(--avatar-color-4, #22C55E)', 'var(--avatar-color-5, #8B5CF6)', 'var(--avatar-color-6, #38BDF8)',
  'var(--avatar-color-7, #F59E0B)', 'var(--avatar-color-8, #F97316)', 'var(--avatar-color-9, #6366F1)'
];

function hashColor(name = '') {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

// Google profile photo fallback URL
const getGoogleProfilePhoto = (email?: string | null): string | null => {
  if (!email) return null;
  const emailLower = email.toLowerCase();
  // Match both gmail.com and googlemail.com
  const match = emailLower.match(/^[a-z0-9._%+-]+@([a-z0-9.-]+\.)?(gmail|googlemail)\.com$/);
  if (match) {
    const accountId = emailLower.split('@')[0];
    return `https://lh3.googleusercontent.com/a/${accountId}/photo`;
  }
  return null;
}

interface AvatarDisplayProps {
  name?: string;
  avatarUrl?: string | null;
  email?: string | null;
  size?: number;
  online?: boolean;
  status?: string;
  className?: string;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  name = '',
  avatarUrl,
  email,
  size = 40,
  online,
  status,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasStatus = online !== undefined || status !== undefined;
  const isOnline = online !== undefined ? online : status === 'online';
  const initials = name ? name.charAt(0).toUpperCase() : '?';
  const bg = hashColor(name);
  
  // Google profile photo fallback
  const finalAvatarUrl = avatarUrl || getGoogleProfilePhoto(email) || undefined;
  
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [avatarUrl, email]);

  const showImg = finalAvatarUrl && !imgError;

  return (
    <div
      className={`avatar-display-container ${className}`.trim()}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
        width: size,
        height: size,
        maxWidth: size,
        maxHeight: size,
      }}
    >
      {/* Always render initials circle as background — image layers on top once loaded */}
      <div
        style={{
          width: size,
          height: size,
          maxWidth: size,
          maxHeight: size,
          borderRadius: '50%',
          overflow: 'hidden',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-on-accent, #ffffff)',
          fontSize: size * 0.38,
          fontWeight: 700,
          userSelect: 'none',
          letterSpacing: '-0.5px',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {initials}
        {/* Image overlaid on top — invisible until loaded */}
{showImg && (
          <img
            src={finalAvatarUrl}
            alt={name}
            loading="eager"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              maxWidth: size,
              maxHeight: size,
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.25s ease',
            }}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              console.warn(`[AvatarDisplay] Failed to load avatar for ${name}, showing initials.`);
              setImgError(true);
            }}
          />
        )}
      </div>

      {hasStatus && (
        <span
          className={`status-dot ${isOnline ? 'online' : 'offline'}`}
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: Math.max(size * 0.26, 10),
            height: Math.max(size * 0.26, 10),
            borderRadius: '50%',
            background: isOnline ? '#22C55E' : 'var(--text-tertiary, #64748B)',
            border: '2px solid var(--color-bg, #0B101B)',
          }}
        />
      )}
    </div>
  );
};

export default AvatarDisplay;
