import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useChatStore } from '../store/chatStore';

export const BackButtonHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  // Keep refs for callbacks so event listeners never get stale or need re-attaching
  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);
  const activeConversationIdRef = useRef(activeConversationId);
  const setActiveConversationRef = useRef(setActiveConversation);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    setActiveConversationRef.current = setActiveConversation;
  }, [setActiveConversation]);

  // Central back-press processing logic
  const processBackAction = (): boolean => {
    // 1. Priority 1: Check if any open modal/dialog exists in DOM
    const openModal = document.querySelector(
      '.modal-overlay, .modal-backdrop, [role="dialog"], .media-lightbox-backdrop, .file-preview-overlay, .cropper-modal-overlay, .confirm-dialog-backdrop, .active-call-screen, .incoming-call-screen'
    );
    if (openModal) {
      // Find close button or cancel button inside the modal
      const closeBtn = openModal.querySelector<HTMLElement>(
        '.modal-close, button[aria-label="Close"], button[aria-label="Close modal"], .btn-close, .lightbox-close, .icon-btn-back, .btn-cancel'
      );
      if (closeBtn) {
        closeBtn.click();
        return true;
      }
      // Fallback: trigger Escape key
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
      document.dispatchEvent(escEvent);
      return true;
    }

    // 2. Priority 2: Clear active conversation if in mobile chat view
    if (activeConversationIdRef.current) {
      setActiveConversationRef.current(null);
      return true;
    }

    // 3. Priority 3: Navigate back to `/chats` if on sub-pages (/profile, /contacts, /settings, /calls)
    if (locationRef.current.pathname !== '/chats' && locationRef.current.pathname !== '/') {
      navigateRef.current('/chats');
      return true;
    }

    // 4. Priority 4: At root home screen with no active chat / modal -> return false (trigger minimize app)
    return false;
  };

  // Setup Capacitor Android Native Back Button (registered ONCE on mount)
  useEffect(() => {
    let listenerPromise: Promise<any> | null = null;

    try {
      listenerPromise = CapacitorApp.addListener('backButton', () => {
        const handled = processBackAction();
        if (!handled) {
          CapacitorApp.minimizeApp();
        }
      });
    } catch {
      // Not running in Capacitor native webview
    }

    return () => {
      if (listenerPromise) {
        listenerPromise
          .then((handle) => {
            if (handle && typeof handle.remove === 'function') {
              handle.remove();
            }
          })
          .catch(() => {});
      }
    };
  }, []);

  // Handle Mobile Web / PWA Browser Popstate Back Button
  useEffect(() => {
    const handlePopState = () => {
      processBackAction();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Trap mobile browser back navigation when active chat is opened
  useEffect(() => {
    if (activeConversationId) {
      window.history.pushState({ silenxChat: activeConversationId }, '');
    }
  }, [activeConversationId]);

  return null;
};

export default BackButtonHandler;

