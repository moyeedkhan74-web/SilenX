
const COLORS = ['var(--color-accent)', 'var(--color-accent-hover)', 'var(--text-secondary)', 'var(--text-primary)'];

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
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
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
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {online !== undefined && (
        <span
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: Math.max(size * 0.26, 10),
            height: Math.max(size * 0.26, 10),
            borderRadius: '50%',
            background: online ? 'var(--color-accent)' : 'var(--text-tertiary)',
            border: '2px solid var(--color-bg)',
          }}
        />
      )}
    </div>
  );
}

export default Avatar;
