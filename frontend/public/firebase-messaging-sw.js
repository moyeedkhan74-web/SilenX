// Firebase Messaging Service Worker
// This file must be placed in the public folder and served at /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: self.origin.includes('localhost') ? 'YOUR_API_KEY' : '',
  authDomain: self.origin.includes('localhost') ? 'YOUR_AUTH_DOMAIN' : '',
  projectId: self.origin.includes('localhost') ? 'YOUR_PROJECT_ID' : '',
  storageBucket: self.origin.includes('localhost') ? 'YOUR_STORAGE_BUCKET' : '',
  messagingSenderId: self.origin.includes('localhost') ? 'YOUR_MESSAGING_SENDER_ID' : '',
  appId: self.origin.includes('localhost') ? 'YOUR_APP_ID' : '',
  measurementId: self.origin.includes('localhost') ? 'YOUR_MEASUREMENT_ID' : '',
};

let app = null;
let messaging = null;

try {
  app = firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging(app);
} catch (error) {
  console.error('[ServiceWorker] Firebase initialization failed:', error);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[ServiceWorker] Received background message:', payload);

    const data = payload.data || {};
    const senderName = payload.notification?.title || data.senderDisplayName || 'SilenX';
    const notificationBody = payload.notification?.body || '🔒 Encrypted Message';

    showChatNotification(senderName, notificationBody, data);
  });
}

/**
 * Shared notification builder — badge icon + Reply / Mark as Read actions.
 * Clicking the body or 'Reply' focuses/opens the conversation; 'Mark as Read'
 * posts a message to the app so it can zero the unread badge.
 */
function showChatNotification(title, body, data) {
  const notificationOptions = {
    body,
    icon: '/silenX-logo.png',
    badge: '/silenX-logo.png',
    vibrate: [200, 100, 200],
    data: data || {},
    actions: [
      { action: 'reply', title: 'Reply' },
      { action: 'mark-read', title: 'Mark as Read' },
    ],
    requireInteraction: false,
    tag: (data && data.conversationId) || 'silenx-message',
    renotify: true,
  };

  return self.registration.showNotification(title, notificationOptions);
}

self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click received:', event);

  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId;

  // 'Mark as Read': tell any open client to clear the unread state.
  if (event.action === 'mark-read') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'mark-read', conversationId });
        });
      })
    );
    return;
  }

  // Default tap and 'Reply' both focus/open the conversation. The app opens
  // the chat thread and focuses the input for replies.

  let targetUrl = '/';
  if (conversationId) {
    targetUrl = `/?chat=${encodeURIComponent(conversationId)}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window and hand it the deep link directly.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: event.action === 'reply' ? 'open-conversation' : 'open-conversation',
            conversationId,
          });
          return;
        }
      }

      // No open window: launch a new one at the deep link.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed:', event);
});

self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push event received:', event);

  if (event.data) {
    const payload = event.data.json();
    console.log('[ServiceWorker] Push payload:', payload);

    const data = payload.data || {};
    const senderName = payload.notification?.title || data.senderDisplayName || 'SilenX';
    const notificationBody = payload.notification?.body || '🔒 Encrypted Message';

    event.waitUntil(showChatNotification(senderName, notificationBody, data));
  }
});

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated');
  event.waitUntil(self.clients.claim());
});