
const COLORS = ['#2E5BBA', '#4ECDC4', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B'];

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
}

export function Avatar({ name = '', size = 40, online }: AvatarProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: hashColor(name),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: size * 0.38,
          fontWeight: 700,
          userSelect: 'none',
          letterSpacing: '-0.5px',
        }}
      >
        {name.charAt(0).toUpperCase()}
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
            background: online ? '#4CAF50' : '#BDBDBD',
            border: '2px solid var(--bg-primary)',
          }}
        />
      )}
    </div>
  );
}

export default Avatar;
