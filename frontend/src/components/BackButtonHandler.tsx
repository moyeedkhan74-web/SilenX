import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useChatStore } from '../store/chatStore';

export const BackButtonHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  useEffect(() => {
    // 1. Handle Capacitor Android Native Back Button
    let listenerHandle: any = null;

    const setupCapacitorBackButton = async () => {
      try {
        listenerHandle = await CapacitorApp.addListener('backButton', () => {
          // Check if any open modal exists in DOM
          const openModal = document.querySelector('.modal-overlay, .modal-backdrop, [role="dialog"]');
          if (openModal) {
            // Close active modal by triggering escape key or click
            const closeBtn = openModal.querySelector<HTMLElement>('.modal-close, button[aria-label="Close"], .btn-close');
            if (closeBtn) {
              closeBtn.click();
              return;
            }
          }

          // If active chat is open in mobile view -> go back to chat list
          if (activeConversationId) {
            setActiveConversation(null);
            return;
          }

          // If on a sub-page (/profile, /contacts, /settings, /calls) -> go to /chats
          if (location.pathname !== '/chats' && location.pathname !== '/') {
            navigate('/chats');
            return;
          }

          // At root home screen with no active chat -> minimize app on Android
          CapacitorApp.minimizeApp();
        });
      } catch (err) {
        // Not running in Capacitor native webview
      }
    };

    setupCapacitorBackButton();

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
    };
  }, [location.pathname, activeConversationId, navigate, setActiveConversation]);

   useEffect(() => {
     // 2. Handle Mobile Web / PWA Browser Popstate Back Button
     const handlePopState = (e: PopStateEvent) => {
       // Priority 1: Close active modal if open
       const openModal = document.querySelector('.modal-overlay, .modal-backdrop, [role="dialog"]');
       if (openModal) {
         // Close active modal by triggering escape key or click
         const closeBtn = openModal.querySelector<HTMLElement>('.modal-close, button[aria-label="Close"], .btn-close');
         if (closeBtn) {
           closeBtn.click();
           e.preventDefault();
           return;
         }
       }

       // Priority 2: Clear active conversation if in chat view
       if (activeConversationId) {
         e.preventDefault();
         setActiveConversation(null);
         return;
       }

       // Priority 3: Navigate back to `/chats` if on sub-pages
       if (location.pathname !== '/chats' && location.pathname !== '/') {
         e.preventDefault();
         navigate('/chats');
         return;
       }

       // Priority 4: Minimize app ONLY if on `/chats` root with no open chat/modal
       // Note: This is for native Capacitor apps only. In web/PWA, we let the browser handle it.
       // For completeness, we could call window.minimize() but it's not reliably supported.
       // So we do nothing here - let the browser's natural back behavior occur.
     };

     window.addEventListener('popstate', handlePopState);
     return () => {
       window.removeEventListener('popstate', handlePopState);
     };
   }, [location.pathname, activeConversationId, navigate, setActiveConversation]);

  return null;
};

export default BackButtonHandler;
