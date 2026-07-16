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
 * Click to pin/unpin message
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
      isPinned ? await onUnpin(messageId) : await onPin(messageId);
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
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        {isPinned ? (
          <path d="M16 9V5l-3 3-4-4-1.414 1.414L7.586 9H4v2h7v7l3-3 4 4 1.414-1.414L16.414 15V9h7V9h-7z" />
        ) : (
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
        )}
      </svg>
    </button>
  );
};

export default PinButton;
