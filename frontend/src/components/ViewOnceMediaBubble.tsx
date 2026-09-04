import React, { useEffect, useRef, useState } from 'react';
import { Lock, Clock } from 'lucide-react';
import type { ChatMessage } from '../types';

const VIEW_ONCE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours default TTL

interface ViewOnceMediaBubbleProps {
  message: ChatMessage;
  onViewOnceOpened?: () => void;
}

const ViewOnceMediaBubble: React.FC<ViewOnceMediaBubbleProps> = ({
  message,
  onViewOnceOpened,
}) => {
  const [state, setState] = useState<'locked' | 'loading' | 'viewing' | 'opened'>('locked');
  const [timeLeft, setTimeLeft] = useState(0);
  const messageRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);

  // Calculate time left based on TTL
  useEffect(() => {
    const openedAt = message.viewOnceOpenedAt != null ? new Date(message.viewOnceOpenedAt) : null;
    const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();

    if (state === 'opened') {
      setTimeLeft(0);
      return;
    }

    // If never viewed, show remaining time from creation
    if (!openedAt) {
      const totalDuration = VIEW_ONCE_TTL_MS;
      const elapsed = Date.now() - createdAt.getTime();
      const remaining = Math.max(0, totalDuration - elapsed);
      setTimeLeft(remaining);
      // Start interval to count down
      if (remaining > 0) {
        intervalRef.current = window.setInterval(() => {
          setTimeLeft((prev) => Math.max(0, prev - 1000));
        }, 1000);
      }
      return;
    }

    // If already viewed, show time since opened
    const elapsedSinceOpened = Date.now() - openedAt.getTime();
    setTimeLeft(elapsedSinceOpened);
  }, [state, message.viewOnceOpenedAt, message.createdAt]);

  // Handle view once open
  const handleOpen = () => {
    if (state !== 'locked') return;

    setState('loading');
    // Simulate loading, then move to viewing
    const loadingTimeout = setTimeout(() => {
      setState('viewing');
      // Start countdown from 24 hours
      setTimeLeft(VIEW_ONCE_TTL_MS);
      if (onViewOnceOpened) {
        onViewOnceOpened();
      }
    }, 800);
    return () => clearTimeout(loadingTimeout);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const renderLocked = () => {
    const remaining = timeLeft > 0 ? Math.ceil(timeLeft / 1000) : 'expired';
    return (
      <div
        ref={messageRef}
        className="rich-view-once-bubble"
        onClick={handleOpen}
        title={`View once media - Tap to open (expires in ${remaining}s)`}
      >
        <span
          className="view-once-locked-icon"
          style={{ fontSize: 24, color: '#ef4444' }}
        >
          <Lock size={24} />
        </span>
        {timeLeft > 0 && (
          <span className="view-once-timer">{remaining}s</span>
        )}
      </div>
    );
  };

  const renderLoading = () => {
    return (
      <div className="rich-view-once-bubble">
        <span className="view-once-loading-icon">
          <Clock size={24} />
        </span>
        <span className="view-once-text">Opening…</span>
      </div>
    );
  };

  const renderViewing = () => {
    const seconds = Math.ceil(timeLeft / 1000);
    return (
      <div className="rich-view-once-bubble">
        <span className="view-once-viewing-icon">
          <Clock size={24} />
        </span>
        <span className="view-once-countdown">{seconds}s</span>
      </div>
    );
  };

  const renderOpened = () => {
    return (
      <div className="rich-view-once-bubble">
        <span className="view-once-opened-icon">
          <Lock size={24} style={{ color: '#10b981' }} />
        </span>
        <span className="view-once-text">Opened</span>
      </div>
    );
  };

  // Render based on state
  switch (state) {
    case 'locked':
      return renderLocked();
    case 'loading':
      return renderLoading();
    case 'viewing':
      return renderViewing();
    case 'opened':
      return renderOpened();
    default:
      return renderLocked();
  }
};

export { ViewOnceMediaBubble };