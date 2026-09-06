import React from 'react';

interface EncryptionBadgeProps {
  confirmed: boolean;
}

export function EncryptionBadge({ confirmed }: EncryptionBadgeProps) {
  return (
    <span
      className="encryption-badge"
      title={confirmed ? 'End-to-end encrypted · SLX2 cipher' : 'Encrypting…'}
    >
      <i
        className={`ti ti-lock${confirmed ? '' : '-open'}`}
        style={{ fontSize: 12 }}
      />
    </span>
  );
}