import React from 'react';

interface ReactionPickerProps {
  open: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const reactions = ['👍', '❤️', '😂', '🎉', '🔥'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ open, onSelect, onClose }) => {
  if (!open) return null;

  return (
    <div className="reaction-picker" role="dialog" aria-label="Reaction picker">
      {reactions.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-pill"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;
