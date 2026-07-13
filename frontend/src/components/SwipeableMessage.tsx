import React, { useRef, useState } from 'react';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  onLongPress: () => void;
}

export const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ children, onSwipeReply, onLongPress }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const hasMoved = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    hasMoved.current = false;
    cancelLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (!hasMoved.current) {
        onLongPress();
      }
    }, 550);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    // If user has moved more than 8px, treat as swipe not long-press
    if (Math.abs(delta) > 8) {
      hasMoved.current = true;
      cancelLongPress();
    }
    const clamped = Math.max(-140, Math.min(0, delta));
    setOffset(clamped);
  };

  const handlePointerUp = () => {
    cancelLongPress();
    if (offset < -90) {
      onSwipeReply();
    }
    setOffset(0);
    startX.current = null;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y', transition: offset === 0 ? 'transform 180ms ease-out' : 'none' }}
    >
      {children}
    </div>
  );
};

export default SwipeableMessage;
