import React from 'react';
import AvatarDisplay from '../shared/AvatarDisplay';
import { formatLastSeen } from '../../utils/date';

interface ContactCardProps {
  displayName: string;
  uid: string;
  avatarUrl?: string | null;
  status?: string;
  lastSeen?: string;
  actions?: React.ReactNode;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  displayName,
  uid,
  avatarUrl,
  status,
  lastSeen,
  actions
}) => {
  const presenceText = (() => {
    if (status === 'online') return 'Online';
    if (lastSeen) {
      const rel = formatLastSeen(lastSeen);
      return rel === 'Offline' || !rel ? 'Offline' : `Last seen ${rel}`;
    }
    return 'Offline';
  })();
  const isOnline = status === 'online';

  return (
    <div
      className="contact-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        marginBottom: '12px',
        gap: '12px',
      }}
    >
      {/* Top row: avatar + text info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <AvatarDisplay name={displayName} avatarUrl={avatarUrl} size={46} status={status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </h4>
          <code
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              display: 'block',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {uid}
          </code>
          {status !== undefined && (
            <span
              style={{
                fontSize: '12px',
                color: isOnline ? 'var(--color-accent)' : 'var(--text-tertiary)',
                fontWeight: isOnline ? 600 : 400,
                display: 'block',
                marginTop: '2px',
              }}
            >
              {presenceText}
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: action buttons */}
      {actions && (
        <div
          className="contact-card-actions"
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

export default ContactCard;
