import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  if (!open) return null;

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirm-card">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          {secondaryActionLabel && onSecondaryAction && (
            <button type="button" className="confirm-btn secondary" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          )}
          <button type="button" className="confirm-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm-btn primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
