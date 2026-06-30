import React from 'react';
import AvatarDisplay from '../shared/AvatarDisplay';

interface ContactCardProps {
  displayName: string;
  uid: string;
  avatarUrl?: string | null;
  status?: string;
  actions?: React.ReactNode;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  displayName,
  uid,
  avatarUrl,
  status,
  actions
}) => {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden', flex: 1 }}>
        <AvatarDisplay name={displayName} avatarUrl={avatarUrl} size={48} status={status} />
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {displayName}
          </h4>
          <code style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            wordBreak: 'break-all',
            display: 'block',
            marginTop: '2px'
          }}>
            {uid}
          </code>
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
