import React, { useState } from 'react';
import './PinButton.css';

interface PinButtonProps {
  messageId: string;
  isPinned: boolean;
  onPin: (messageId: string) => Promise<void>;
  onUnpin: (messageId: string) => Promise<void>;
  loading?: boolean;
}

/**
 * PIN BUTTON - Like WhatsApp & Telegram
 */
export const PinButton: React.FC<PinButtonProps> = ({
  messageId,
  isPinned,
  onPin,
  onUnpin,
  loading = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading || loading) return;
    setIsLoading(true);
    try {
      if (isPinned) {
        await onUnpin(messageId);
      } else {
        await onPin(messageId);
      }
    } catch (error) {
      console.error('Pin error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`pin-btn ${isPinned ? 'pinned' : ''}`}
      onClick={handleClick}
      disabled={isLoading || loading}
      title={isPinned ? 'Unpin message' : 'Pin message'}
      aria-label={isPinned ? 'Unpin message' : 'Pin message'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {isPinned ? (
          <path d="M14.7 3.3c-.4-.4-1-.4-1.4 0L8.5 8H5a1 1 0 000 2h2.6l-3 3a1 1 0 000 1.4l3.6 3.6a1 1 0 001.4 0l3-3V21a1 1 0 002 0v-5.9l3 3a1 1 0 001.4 0l3.6-3.6a1 1 0 000-1.4l-3-3H19a1 1 0 000-2h-3.5l4.8-4.8c.4-.4.4-1 0-1.4l-2.2-2.2z" />
        ) : (
          <path d="M12 2c-.6 0-1 .4-1 1v6.6l-4.4 4.4c-.4.4-.4 1 0 1.4l2.2 2.2c.4.4 1 .4 1.4 0L12 14.4l4.8 4.8c.4.4 1 .4 1.4 0l2.2-2.2c.4-.4.4-1 0-1.4L13 9.6V3c0-.6-.4-1-1-1zM8 9.6l4-4V4h.1v1.6l4 4L13 9.6 8 9.6z" />
        )}
      </svg>
      {(isLoading || loading) && <span className="pin-spinner" />}
    </button>
  );
};

export default PinButton;
