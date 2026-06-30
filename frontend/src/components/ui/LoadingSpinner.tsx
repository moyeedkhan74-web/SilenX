import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'medium' 
}) => {
  return (
    <div className={`loading-spinner-wrapper spinner-${size}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: '12px'
    }}>
      <div className="loading-spinner" style={{
        width: size === 'small' ? '20px' : size === 'large' ? '48px' : '32px',
        height: size === 'small' ? '20px' : size === 'large' ? '48px' : '32px',
        border: '3px solid var(--bg-tertiary)',
        borderTop: '3px solid var(--primary-light)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <span className="loading-message" style={{
        color: 'var(--text-secondary)',
        fontSize: size === 'small' ? '12px' : '14px',
        fontWeight: 500
      }}>{message}</span>
    </div>
  );
};

export default LoadingSpinner;
