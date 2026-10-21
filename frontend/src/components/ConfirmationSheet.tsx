import React, { useEffect, useRef } from 'react';
import './ConfirmationSheet.css';

type ConfirmationType = 'clear-chat' | 'block-contact' | 'delete-message' | 'leave-group';

interface ConfirmationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: ConfirmationType;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
}

const getIcon = (type: ConfirmationType) => {
  switch (type) {
    case 'clear-chat':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'block-contact':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      );
    case 'delete-message':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'leave-group':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
};

const getIconBgColor = (type: ConfirmationType) => {
  switch (type) {
    case 'clear-chat':
    case 'block-contact':
    case 'delete-message':
      return 'var(--color-error-soft, rgba(239, 68, 68, 0.15))';
    case 'leave-group':
      return 'var(--color-warning-soft, rgba(245, 158, 11, 0.15))';
    default:
      return 'var(--color-accent-soft, rgba(99, 102, 241, 0.15))';
  }
};

const getIconColor = (type: ConfirmationType) => {
  switch (type) {
    case 'clear-chat':
    case 'block-contact':
    case 'delete-message':
      return 'var(--color-error, #EF4444)';
    case 'leave-group':
      return 'var(--color-warning, #F59E0B)';
    default:
      return 'var(--color-accent, #6366F1)';
  }
};

const getConfirmButtonStyle = (type: ConfirmationType) => {
  switch (type) {
    case 'clear-chat':
    case 'block-contact':
    case 'delete-message':
      return { background: 'var(--color-error, #EF4444)', color: '#F1F5F9' };
    case 'leave-group':
      return { background: 'var(--color-warning, #F59E0B)', color: 'var(--color-bg)' };
    default:
      return { background: 'var(--color-accent, #6366F1)', color: '#F1F5F9' };
  }
};

export const ConfirmationSheet: React.FC<ConfirmationSheetProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    const touch = e.touches[0];
    startY.current = touch.clientY;
    const rect = sheetRef.current.getBoundingClientRect();
    if (touch.clientY - rect.top < 80) {
      isDragging.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const touch = e.touches[0];
    currentY.current = touch.clientY;
    const deltaY = currentY.current - startY.current;
    if (deltaY > 0) {
      sheetRef.current.style.transform = `translateY(${Math.min(deltaY, 200)}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current || !sheetRef.current) return;
    const deltaY = currentY.current - startY.current;
    if (deltaY > 100) {
      onClose();
    }
    sheetRef.current.style.transform = '';
    isDragging.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="confirmation-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
      />
      <div
        ref={sheetRef}
        className="confirmation-sheet"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="confirmation-handle" />
        <div className="confirmation-content">
          <div className="confirmation-header">
            <div
              className="confirmation-icon"
              style={{
                background: getIconBgColor(type),
                color: getIconColor(type),
              }}
            >
              {getIcon(type)}
            </div>
            <h2 id="confirmation-title" className="confirmation-title">
              {title}
            </h2>
          </div>
          <p className="confirmation-description">{description}</p>
          <div className="confirmation-actions">
            <button
              type="button"
              className="confirmation-btn confirmation-btn--cancel"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="confirmation-btn confirmation-btn--confirm"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              style={getConfirmButtonStyle(type)}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmationSheet;