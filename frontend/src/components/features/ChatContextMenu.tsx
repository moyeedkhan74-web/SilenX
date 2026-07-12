import React, { useEffect, useRef } from 'react';
import { Pin, PinOff, Volume2, VolumeX, CheckSquare, Trash2, ShieldAlert } from 'lucide-react';
import './ChatContextMenu.css';

interface ChatContextMenuProps {
  x: number;
  y: number;
  isPinned: boolean;
  isMuted: boolean;
  onClose: () => void;
  onPin: () => void;
  onMute: () => void;
  onMarkRead: () => void;
  onClear: () => void;
  onDelete: () => void;
}

export const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
  x,
  y,
  isPinned,
  isMuted,
  onClose,
  onPin,
  onMute,
  onMarkRead,
  onClear,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust menu position if it goes off screen
  const menuWidth = 180;
  const menuHeight = 220;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  let finalX = x;
  let finalY = y;

  if (x + menuWidth > screenWidth) {
    finalX = screenWidth - menuWidth - 10;
  }
  if (y + menuHeight > screenHeight) {
    finalY = screenHeight - menuHeight - 10;
  }

  return (
    <div
      ref={menuRef}
      className="chat-context-menu"
      style={{ top: finalY, left: finalX }}
    >
      <button className="menu-item" onClick={() => { onPin(); onClose(); }}>
        {isPinned ? (
          <>
            <PinOff size={16} />
            <span>Unpin chat</span>
          </>
        ) : (
          <>
            <Pin size={16} />
            <span>Pin chat</span>
          </>
        )}
      </button>

      <button className="menu-item" onClick={() => { onMute(); onClose(); }}>
        {isMuted ? (
          <>
            <Volume2 size={16} />
            <span>Unmute</span>
          </>
        ) : (
          <>
            <VolumeX size={16} />
            <span>Mute notifications</span>
          </>
        )}
      </button>

      <button className="menu-item" onClick={() => { onMarkRead(); onClose(); }}>
        <CheckSquare size={16} />
        <span>Mark as read</span>
      </button>

      <div className="menu-divider" />

      <button className="menu-item text-warning" onClick={() => { onClear(); onClose(); }}>
        <ShieldAlert size={16} />
        <span>Clear chat</span>
      </button>

      <button className="menu-item text-danger" onClick={() => { onDelete(); onClose(); }}>
        <Trash2 size={16} />
        <span>Delete chat</span>
      </button>
    </div>
  );
};

export default ChatContextMenu;
