import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import AvatarDisplay from './shared/AvatarDisplay';
import { useChatStore } from '../store/chatStore';
import './InAppNotificationBanner.css';

export interface InAppNotification {
  conversationId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  preview: string;
  timestamp: string;
}

export const INAPP_NOTIFICATION_EVENT = 'silenx:inapp-notification';

const AUTO_DISMISS_MS = 4_500;
const SWIPE_DISMISS_PX = 64;

/**
 * WhatsApp/Instagram-style glassmorphism notification banner.
 * Listens globally for `silenx:inapp-notification` events dispatched by the
 * socket layer whenever a message lands outside the active conversation.
 */
export const InAppNotificationBanner: React.FC = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState<InAppNotification | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setDragOffset(0);
    // Wait for the slide-up transition before unmounting content.
    setTimeout(() => {
      setNotification(null);
      setLeaving(false);
    }, 280);
  }, []);

  const show = useCallback(
    (next: InAppNotification) => {
      clearHideTimer();
      setLeaving(false);
      setDragOffset(0);
      setNotification(next);
      hideTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [clearHideTimer, dismiss]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<InAppNotification>).detail;
      if (detail?.conversationId) {
        show(detail);
      }
    };
    window.addEventListener(INAPP_NOTIFICATION_EVENT, handler);
    return () => {
      window.removeEventListener(INAPP_NOTIFICATION_EVENT, handler);
      clearHideTimer();
    };
  }, [show, clearHideTimer]);

  const openConversation = useCallback(() => {
    if (!notification) return;
    useChatStore.getState().setActiveConversation(notification.conversationId);
    navigate('/chats');
    dismiss();
  }, [notification, navigate, dismiss]);

  // ─── Swipe-up to dismiss ───
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    clearHideTimer();
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = Math.min(0, e.touches[0].clientY - touchStartY.current);
    setDragOffset(delta);
  };

  const onTouchEnd = () => {
    touchStartY.current = null;
    if (dragOffset < -SWIPE_DISMISS_PX) {
      dismiss();
    } else {
      setDragOffset(0);
      hideTimer.current = setTimeout(dismiss, Math.max(1200, AUTO_DISMISS_MS / 2));
    }
  };

  if (!notification) return null;

  const timeLabel = new Date(notification.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`inapp-banner ${leaving ? 'inapp-banner--leave' : ''}`}
      role="alert"
      style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
      onClick={openConversation}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="inapp-banner__content">
        <AvatarDisplay
          name={notification.senderName}
          avatarUrl={notification.senderAvatarUrl || undefined}
          size={42}
        />
        <div className="inapp-banner__text">
          <div className="inapp-banner__top">
            <span className="inapp-banner__name">{notification.senderName}</span>
            <span className="inapp-banner__time">{timeLabel}</span>
          </div>
          <p className="inapp-banner__preview">{notification.preview}</p>
        </div>
        <button
          type="button"
          className="inapp-banner__close"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
        >
          <X size={16} />
        </button>
      </div>
      <span className={`inapp-banner__progress ${leaving ? 'inapp-banner__progress--paused' : ''}`} />
    </div>
  );
};

export default InAppNotificationBanner;
