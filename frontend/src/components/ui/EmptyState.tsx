import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionButton?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionButton,
}) => {
  return (
    <div className="empty-state-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 24px',
      maxWidth: '400px',
      margin: '0 auto',
      height: '100%',
      justifySelf: 'center',
      alignSelf: 'center'
    }}>
      <div className="empty-state-icon-wrapper" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--primary-light)',
        marginBottom: '20px',
        fontSize: '24px'
      }}>
        {icon}
      </div>
      <h3 className="empty-state-title" style={{
        marginTop: 0,
        marginBottom: '8px',
        color: 'var(--text-primary)',
        fontSize: '18px',
        fontWeight: 600
      }}>{title}</h3>
      <p className="empty-state-description" style={{
        marginTop: 0,
        marginBottom: actionButton ? '24px' : 0,
        color: 'var(--text-tertiary)',
        fontSize: '14px',
        lineHeight: 1.5
      }}>{description}</p>
      {actionButton}
    </div>
  );
};

export default EmptyState;
