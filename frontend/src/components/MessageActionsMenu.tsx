import React, { useEffect, useRef } from 'react';
import { Copy, Reply, Star, Trash2, Forward, SmilePlus, Pin, Pencil } from 'lucide-react';

interface MessageActionsMenuProps {
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onStar: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReact: () => void;
  isOwn: boolean;
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  open,
  onClose,
  onReply,
  onCopy,
  onStar,
  onDelete,
  onForward,
  onReact,
  isOwn,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

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

  return (
    <div ref={menuRef} role="menu" aria-label="Message actions" className="message-actions-menu">
      <button type="button" role="menuitem" onClick={onReply}><Reply size={14} /> Reply</button>
      <button type="button" role="menuitem" onClick={onCopy}><Copy size={14} /> Copy</button>
      <button type="button" role="menuitem" onClick={onStar}><Star size={14} /> Star</button>
      <button type="button" role="menuitem" onClick={onReact}><SmilePlus size={14} /> React</button>
      <button type="button" role="menuitem" onClick={onForward}><Forward size={14} /> Forward</button>
      {isOwn && (
        <button type="button" role="menuitem" onClick={onDelete}><Trash2 size={14} /> Delete</button>
      )}
      {isOwn && (
        <button type="button" role="menuitem" onClick={onDelete}><Pencil size={14} /> Edit</button>
      )}
      <button type="button" role="menuitem" onClick={onDelete}><Pin size={14} /> Pin</button>
    </div>
  );
};

export default MessageActionsMenu;
