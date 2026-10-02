/**
 * SilenX Web Push Service Worker
 *
 * Receives standards-based (VAPID) push messages and renders OS-level
 * notifications while the app tab is backgrounded or fully closed.
 *
 * Payload shape produced by backend/src/services/webPushService.ts:
 *   {
 *     "type": "message" | "call",
 *     "title": "Ada Lovelace",              // sender name
 *     "body": "Meet me at 8?",               // preview snippet, never ciphertext
 *     "icon": "https://.../avatar.png",      // sender avatar
 *     "conversationId": "...",               // groups/replaces per thread
 *     "notification": { "title", "body", "icon" },   // FCM-compatible mirror
 *     "data": { "conversationId", "senderId", "messageId", "senderDisplayName",
 *               "senderAvatarUrl", "body", "callType", "type" }
 *   }
 *
 * Both shapes are emitted because a browser can be controlled by THIS worker
 * or by firebase-messaging-sw.js — whichever claimed scope '/' first. Reading
 * both here (and there) keeps the sender name, preview and chat deep link
 * identical regardless of which worker is active.
 */

const DEFAULT_ICON = '/silenX-logo.png';
const DEFAULT_BADGE = '/silenX-logo.png';
const DEFAULT_TITLE = 'SilenX';
const DEFAULT_BODY = '🔒 Encrypted message';

/** VAPID applicationServerKey is only needed to *subscribe*, never to receive. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Normalises both payload shapes into one notification descriptor.
 * @param {object} payload
 */
function normalizePayload(payload) {
  const raw = payload || {};
  const data = raw.data || {};
  const notification = raw.notification || {};
  const isCall = raw.type === 'call' || data.type === 'call';

  return {
    type: isCall ? 'call' : 'message',
    title: raw.title || notification.title || data.senderDisplayName || DEFAULT_TITLE,
    body: raw.body || notification.body || data.body || DEFAULT_BODY,
    icon: raw.icon || data.senderAvatarUrl || DEFAULT_ICON,
    conversationId: raw.conversationId || data.conversationId || null,
    senderId: raw.senderId || data.senderId || null,
    messageId: raw.messageId || data.messageId || null,
    callType: raw.callType || data.callType || null,
    url: raw.url || null,
  };
}

/**
 * Renders the OS notification. Conversations group under their own tag so a
 * busy thread replaces its previous notification instead of stacking.
 * @param {object} normalized
 */
async function showNotification(normalized) {
  const tag = normalized.conversationId || 'silenx-message';
  const options = {
    body: normalized.body,
    icon: normalized.icon || DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag,
    renotify: true,
    vibrate: normalized.type === 'call' ? [400, 200, 400, 200, 400] : [200, 100, 200],
    requireInteraction: normalized.type === 'call',
    timestamp: Date.now(),
    data: {
      type: 'open-conversation',
      conversationId: normalized.conversationId,
      senderId: normalized.senderId,
      messageId: normalized.messageId,
      callType: normalized.callType,
      notificationKind: normalized.type,
      url: normalized.url,
    },
    actions: [
      { action: 'open', title: 'Open chat' },
      { action: 'mark-read', title: 'Mark as read' },
    ],
  };

  return self.registration.showNotification(normalized.title, options);
}

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (parseError) {
      payload = { body: event.data.text() };
    }
  }

  const normalized = normalizePayload(payload);
  event.waitUntil(showNotification(normalized));
});

/** Builds the deep link used when no window is currently open. */
function buildTargetUrl(conversationId) {
  if (!conversationId) return '/';
  return `/?chat=${encodeURIComponent(conversationId)}`;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId || null;

  // 'Mark as read' never navigates — it only clears the unread badge.
  if (event.action === 'mark-read') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({ type: 'mark-read', conversationId });
          });
        })
    );
    return;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Prefer a visible window, otherwise fall back to any open tab.
        const candidates = clientList.filter((client) => 'focus' in client);
        const target =
          candidates.find((client) => client.visibilityState === 'visible') || candidates[0];

        if (target) {
          target.focus();
          // DeepLinkHandler picks this up and opens the conversation.
          target.postMessage({ type: 'open-conversation', conversationId });
          return undefined;
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(buildTargetUrl(conversationId));
        }
        return undefined;
      })
      .catch(() => self.clients.openWindow(buildTargetUrl(conversationId)))
  );
});

/** Lets the page ask the worker to surface an already-received notification. */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'skip-waiting') {
    self.skipWaiting();
  }
});
