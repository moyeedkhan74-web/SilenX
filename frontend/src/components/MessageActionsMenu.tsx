import React, { useEffect, useRef, useState } from 'react';
import { Copy, Reply, Star, Trash2, Forward, SmilePlus, Pin, Pencil, MoreHorizontal } from 'lucide-react';

interface MessageActionsMenuProps {
  open: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onStar: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReact: () => void;
  onPin: () => void;
  isOwn: boolean;
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  open,
  position,
  onClose,
  onReply,
  onCopy,
  onStar,
  onDelete,
  onForward,
  onReact,
  onPin,
  isOwn,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showOverflow, setShowOverflow] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowOverflow(false);
      return;
    }

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleAction = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Message actions"
      className="message-actions-pill"
      style={{ top: position.top, left: position.left }}
    >
      <button type="button" role="menuitem" onClick={() => handleAction(onReply)}><Reply size={14} /></button>
      <button type="button" role="menuitem" onClick={() => handleAction(onReact)}><SmilePlus size={14} /></button>
      <button type="button" role="menuitem" onClick={() => handleAction(onCopy)}><Copy size={14} /></button>
      <button type="button" role="menuitem" onClick={() => handleAction(onStar)}><Star size={14} /></button>
      <div className="message-actions-overflow">
        <button type="button" className="overflow-trigger" onClick={() => setShowOverflow((value) => !value)}><MoreHorizontal size={14} /></button>
        {showOverflow && (
          <div className="message-actions-overflow-menu">
            <button type="button" onClick={() => handleAction(onPin)}><Pin size={14} /> Pin</button>
            <button type="button" onClick={() => handleAction(onForward)}><Forward size={14} /> Forward</button>
            {isOwn && <button type="button" onClick={() => handleAction(onDelete)}><Trash2 size={14} /> Delete</button>}
            {isOwn && <button type="button" onClick={() => handleAction(onDelete)}><Pencil size={14} /> Edit</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageActionsMenu;
