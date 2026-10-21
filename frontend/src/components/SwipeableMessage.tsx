import React, { useRef, useState } from 'react';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  onLongPress: () => void;
  onClick?: () => void;
}

export const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ children, onSwipeReply, onLongPress, onClick }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isSwipingHorizontally = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const hasMoved = useRef(false);
  const didLongPress = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    hasMoved.current = false;
    isSwipingHorizontally.current = false;
    didLongPress.current = false;
    cancelLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (!hasMoved.current) {
        didLongPress.current = true;
        onLongPress();
      }
    }, 550);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null || startY.current === null) return;
    const deltaX = event.clientX - startX.current;
    const deltaY = event.clientY - startY.current;

    // If movement has started, check intention
    if (!isSwipingHorizontally.current) {
      // If predominantly vertical scroll, ignore completely!
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) >= Math.abs(deltaX)) {
        hasMoved.current = true;
        cancelLongPress();
        return;
      }
      // Only lock in horizontal swipe if horizontal movement is dominant
      if (Math.abs(deltaX) > 14 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        isSwipingHorizontally.current = true;
        hasMoved.current = true;
        cancelLongPress();
      } else {
        return;
      }
    }

    // WhatsApp-style swipe to reply: only allow rightward swipe up to +60px
    if (isSwipingHorizontally.current && deltaX > 0) {
      const clamped = Math.min(60, deltaX);
      setOffset(clamped);
    } else {
      setOffset(0);
    }
  };

  const handlePointerUp = () => {
    cancelLongPress();
    if (startX.current === null) return;
    const wasSwiped = offset > 40;
    const shouldClick = !didLongPress.current && !hasMoved.current && offset === 0;
    startX.current = null;
    startY.current = null;
    isSwipingHorizontally.current = false;
    setOffset(0);
    if (wasSwiped) {
      onSwipeReply();
      return;
    }
    if (shouldClick && onClick) {
      onClick();
    }
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
