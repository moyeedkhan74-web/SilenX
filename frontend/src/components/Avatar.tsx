import { useState, useEffect } from 'react';

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

interface AvatarProps {
  name?: string;
  size?: number;
  online?: boolean;
  avatarUrl?: string | null;
}

export function Avatar({ name = '', size = 40, online, avatarUrl }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset if URL changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [avatarUrl]);

  const showImg = avatarUrl && !imgError;
  const initials = name ? name.charAt(0).toUpperCase() : '?';
  const bg = hashColor(name);

  return (
    <div
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
      {/* Initials circle always rendered as base layer */}
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
        {/* Photo overlaid on top — fades in after loading */}
        {showImg && (
          <img
            src={avatarUrl}
            alt={name}
            loading="lazy"
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
              console.warn(`[Avatar] Failed to load avatar for "${name}", showing initials.`);
              setImgError(true);
            }}
          />
        )}
      </div>
      {online !== undefined && (
        <span
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: Math.max(size * 0.26, 10),
            height: Math.max(size * 0.26, 10),
            borderRadius: '50%',
            background: online ? '#22C55E' : 'var(--text-tertiary, #64748B)',
            border: '2px solid var(--color-bg, #0B101B)',
          }}
        />
      )}
    </div>
  );
}

export default Avatar;
