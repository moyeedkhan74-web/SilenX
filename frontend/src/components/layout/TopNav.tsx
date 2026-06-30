import React from 'react';
import { Shield } from 'lucide-react';

interface TopNavProps {
  title?: string;
}

export const TopNav: React.FC<TopNavProps> = ({ title }) => {
  return (
    <header className="top-navigation" style={{
      height: '60px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      backgroundColor: 'var(--bg-primary)',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Shield size={20} style={{ color: 'var(--color-primary)' }} />
        <h1 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>{title || 'SlienX Secure Workspace'}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--color-success)',
          fontWeight: 500,
          border: '1px solid var(--border-color)'
        }}>
          ● Connected
        </span>
      </div>
    </header>
  );
};

export default TopNav;
