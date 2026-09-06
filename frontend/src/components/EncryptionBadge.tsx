import { Lock, Unlock } from 'lucide-react';

interface EncryptionBadgeProps {
  confirmed: boolean;
}

export function EncryptionBadge({ confirmed }: EncryptionBadgeProps) {
  return (
    <span
      className="encryption-badge"
      title={confirmed ? 'End-to-end encrypted · SLX2 cipher' : 'Encrypting…'}
      style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4, opacity: 0.8 }}
    >
      {confirmed ? (
        <Lock size={11} color="#34d399" />
      ) : (
        <Unlock size={11} color="#fbbf24" />
      )}
    </span>
  );
}