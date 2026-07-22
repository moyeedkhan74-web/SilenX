import React, { useEffect, useRef, useState } from 'react';
import { Copy, Reply, Star, Trash2, Forward, SmilePlus, Pin, Pencil, MoreHorizontal, Download } from 'lucide-react';

interface MessageActionsMenuProps {
  open: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onStar: () => void;
  onDelete: () => void;
  onForward: () => void;
  onDownload?: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onEdit: () => void;
  isOwn: boolean;
  isStarred: boolean;
  isPinned: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const ALL_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏',
  '🔥', '🎉', '👏', '✨', '💖', '👀',
  '💯', '🤔', '🥺', '😭', '💀', '🤡',
  '💩', '😡', '🥳', '😎', '💡', '✅'
];

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  open,
  position,
  onClose,
  onReply,
  onCopy,
  onStar,
  onDelete,
  onForward,
  onDownload,
  onReact,
  onPin,
  onEdit,
  isOwn,
  isStarred,
  isPinned,
  onMouseEnter,
  onMouseLeave,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showEmojiRow, setShowEmojiRow] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowOverflow(false);
      setShowEmojiRow(false);
      setShowAllGrid(false);
      return;
    }

    const onOutsideDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onOutsideDown);
    document.addEventListener('touchstart', onOutsideDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onOutsideDown);
      document.removeEventListener('touchstart', onOutsideDown);
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {showAllGrid ? (
        <div className="emoji-grid-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px' }}>
          <div className="emoji-full-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
            {ALL_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-quick-btn"
                onClick={() => handleAction(() => onReact(emoji))}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => setShowAllGrid(false)}
            title="Back"
            style={{ fontSize: 11, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
          >
            ✕
          </button>
        </div>
      ) : showEmojiRow ? (
        <>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className="emoji-quick-btn"
              onClick={() => handleAction(() => onReact(emoji))}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            key="plus-btn"
            type="button"
            role="menuitem"
            className="emoji-quick-btn plus-btn"
            onClick={() => setShowAllGrid(true)}
            title="More emojis"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}
          >
            ➕
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setShowEmojiRow(false)}
            title="Back"
            style={{ fontSize: 11, marginLeft: 4 }}
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <button type="button" role="menuitem" onClick={() => handleAction(onReply)} title="Reply">
            <Reply size={14} />
          </button>
          {onDownload && (
            <button type="button" role="menuitem" onClick={() => handleAction(onDownload)} title="Download">
              <Download size={14} />
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => setShowEmojiRow(true)}
            title="React"
          >
            <SmilePlus size={14} />
          </button>
          <button type="button" role="menuitem" onClick={() => handleAction(onCopy)} title="Copy">
            <Copy size={14} />
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(onStar)}
            title={isStarred ? "Unstar" : "Star"}
            className={isStarred ? "starred-active" : ""}
          >
            <Star
              size={14}
              fill={isStarred ? "var(--color-warning, #eab308)" : "none"}
              color={isStarred ? "var(--color-warning, #eab308)" : "currentColor"}
            />
          </button>
          <div className="message-actions-overflow">
            <button
              type="button"
              className="overflow-trigger"
              onClick={() => setShowOverflow((v) => !v)}
              title="More options"
            >
              <MoreHorizontal size={14} />
            </button>
            {showOverflow && (
              <div className="message-actions-overflow-menu">
                <button type="button" onClick={() => handleAction(onPin)}>
                  <Pin size={14} fill={isPinned ? "currentColor" : "none"} /> {isPinned ? "Unpin" : "Pin"}
                </button>
                <button type="button" onClick={() => handleAction(onForward)}>
                  <Forward size={14} /> Forward
                </button>
                {isOwn && (
                  <button type="button" className="danger" onClick={() => handleAction(onDelete)}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                {isOwn && (
                  <button type="button" onClick={() => handleAction(onEdit)}>
                    <Pencil size={14} /> Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MessageActionsMenu;
