import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || React.useId();

  return (
    <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      {label && (
        <label htmlFor={inputId} className="input-label" style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`form-input ${className}`}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box'
        }}
        {...props}
      />
      {error && (
        <span className="input-error-text" style={{ color: 'var(--color-danger)', fontSize: '12px', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;
