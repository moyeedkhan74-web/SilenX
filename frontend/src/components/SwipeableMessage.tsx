import React, { useRef, useState } from 'react';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  onLongPress: () => void;
}

export const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ children, onSwipeReply, onLongPress }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    window.setTimeout(() => {
      onLongPress();
    }, 220);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    const clamped = Math.max(-140, Math.min(0, delta));
    setOffset(clamped);
  };

  const handlePointerUp = () => {
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
