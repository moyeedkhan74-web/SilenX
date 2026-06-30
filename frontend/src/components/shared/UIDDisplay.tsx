import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface UIDDisplayProps {
  uid?: string;
  isLoading?: boolean;
}

export const UIDDisplay: React.FC<UIDDisplayProps> = ({
  uid,
  isLoading = false
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!uid || isLoading || uid === 'Loading...') return;
    navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !uid || uid === 'Loading...') {
    return (
      <div className="uid-display-container loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        minHeight: '42px'
      }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic' }}>
          Generating secure ID...
        </span>
        <div className="dots-loader" style={{ display: 'flex', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'pulse 1.4s infinite' }} />
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'pulse 1.4s infinite 0.2s' }} />
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'pulse 1.4s infinite 0.4s' }} />
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="uid-display-outer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="uid-display-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        gap: '12px'
      }}>
        <code className="profile-uid-text" style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--primary-light)',
          wordBreak: 'break-all',
          flex: 1
        }}>
          {uid}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-icon"
          style={{
            background: 'none',
            border: 'none',
            color: copied ? 'var(--color-success)' : 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          title={copied ? 'Copied!' : 'Copy Secure ID'}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      {copied && (
        <span className="copied-toast" style={{
          color: 'var(--color-success)',
          fontSize: '11px',
          fontWeight: 500,
          alignSelf: 'flex-start'
        }}>
          Copied to clipboard!
        </span>
      )}
    </div>
  );
};

export default UIDDisplay;
