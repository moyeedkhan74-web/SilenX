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
  // Build human-readable presence line
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
    <div className="contact-card" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      marginBottom: '12px',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
        <AvatarDisplay name={displayName} avatarUrl={avatarUrl} size={48} status={status} />
        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {displayName}
          </h4>
          <code style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            display: 'block',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {uid}
          </code>
          {/* Presence status line */}
          {status !== undefined && (
            <span style={{
              fontSize: '12px',
              color: isOnline ? 'var(--color-accent)' : 'var(--text-tertiary)',
              fontWeight: isOnline ? 600 : 400,
              display: 'block',
              marginTop: '2px',
            }}>
              {presenceText}
            </span>
          )}
        </div>
      </div>
      {actions && (
        <div className="contact-card-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default ContactCard;
