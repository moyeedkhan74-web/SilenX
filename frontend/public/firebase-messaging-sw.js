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
    
    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationBody = payload.notification?.body || '🔒 Encrypted Message';
    const notificationIcon = '/icon-192.png';
    const notificationBadge = '/icon-192.png';
    
    const notificationOptions = {
      body: notificationBody,
      icon: notificationIcon,
      badge: notificationBadge,
      vibrate: [200, 100, 200],
      data: payload.data || {},
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      requireInteraction: true,
      tag: payload.data?.conversationId || 'silenx-message',
      renotify: true,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const data = event.notification.data;
  const conversationId = data?.conversationId;
  
  let targetUrl = '/';
  if (conversationId) {
    targetUrl = `/chat/${conversationId}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window, open a new one
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
    
    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationBody = payload.notification?.body || '🔒 Encrypted Message';
    
    const notificationOptions = {
      body: notificationBody,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: payload.data || {},
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      requireInteraction: true,
      tag: payload.data?.conversationId || 'silenx-message',
      renotify: true,
    };
    
    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
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