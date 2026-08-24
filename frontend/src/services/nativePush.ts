import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { API_URL } from '../config/webrtc-config';

let isNativePushInitialized = false;

/** Android notification channel id — must match the backend FCM payload. */
export const MESSAGE_CHANNEL_ID = 'silenx_messages_channel';

/**
 * Create the high-importance Android notification channel BEFORE registering.
 * Importance 4 (High) triggers native heads-up banners over other apps;
 * Visibility 1 (Public) shows content on the lock screen.
 */
async function ensureNotificationChannel(): Promise<void> {
  try {
    await PushNotifications.createChannel({
      id: MESSAGE_CHANNEL_ID,
      name: 'Messages',
      description: 'New message notifications for SilenX chats',
      importance: 4, // Importance.HIGH
      visibility: 1, // Visibility.PUBLIC
      sound: 'default',
    });
    console.log('[NativePush] Notification channel created:', MESSAGE_CHANNEL_ID);
  } catch (error) {
    console.warn('[NativePush] Could not create notification channel:', error);
  }
}

/**
 * Initialize native Capacitor push notifications for Android/iOS
 */
export async function initializeNativePush(): Promise<boolean> {
  if (isNativePushInitialized) {
    return true;
  }

  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[NativePush] Not on native platform, skipping native push initialization');
    return false;
  }

  try {
    // Android: channel must exist before notifications are posted to it.
    await ensureNotificationChannel();

    // OS system banners + sounds in ALL app states. API added in newer
    // Capacitor push plugin majors — feature-detect so v5 builds still work.
    const pushAny = PushNotifications as unknown as {
      setPresentationOptions?: (opts: { badge: boolean; sound: boolean; alert: boolean }) => Promise<void>;
      registerActionTypes?: (opts: {
        types: Array<{
          id: string;
          actions: Array<{
            id: string;
            title: string;
            input?: boolean;
            inputButtonTitle?: string;
            placeholder?: string;
          }>;
        }>;
      }) => Promise<void>;
    };

    if (typeof pushAny.setPresentationOptions === 'function') {
      await pushAny.setPresentationOptions({ badge: true, sound: true, alert: true });
      console.log('[NativePush] Presentation options enabled (badge/sound/alert)');
    }

    if (typeof pushAny.registerActionTypes === 'function') {
      await pushAny.registerActionTypes({
        types: [
          {
            id: 'CHAT_MESSAGE',
            actions: [
              {
                id: 'reply',
                title: 'Reply',
                input: true,
                inputButtonTitle: 'Send',
                placeholder: 'Type a reply...',
              },
              { id: 'mark_read', title: 'Mark as Read' },
            ],
          },
        ],
      });
      console.log('[NativePush] CHAT_MESSAGE action category registered');
    }

    // Request permissions
    const permResult = await PushNotifications.requestPermissions();
    console.log('[NativePush] Permission result:', permResult);

    if (permResult.receive === 'granted') {
      // Register with Apple/Google push notification service
      await PushNotifications.register();
      console.log('[NativePush] Registered for push notifications');
    } else {
      console.warn('[NativePush] Push notification permission not granted');
      return false;
    }

    // Add listeners
    addPushListeners();
    isNativePushInitialized = true;
    return true;
  } catch (error) {
    console.error('[NativePush] Initialization failed:', error);
    return false;
  }
}

/**
 * Add push notification event listeners
 */
function addPushListeners(): void {
  // On registration, send token to backend
  PushNotifications.addListener('registration', async (token) => {
    console.log('[NativePush] Registration token:', token.value);
    await syncNativeTokenToBackend(token.value);
  });

  // On registration error
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[NativePush] Registration error:', error.error);
  });

  // On push notification received (foreground/background)
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[NativePush] Push notification received:', notification);
    handlePushNotification(notification);
  });

  // On push notification action performed (user tapped notification)
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[NativePush] Push notification action performed:', action);
    handleNotificationAction(action);
  });
}

/**
 * Sync native FCM token to backend
 */
async function syncNativeTokenToBackend(token: string): Promise<boolean> {
  try {
    const authState = useAuthStore.getState();
    const idToken = authState.token;
    
    if (!idToken) {
      console.warn('[NativePush] No auth token available, skipping backend sync');
      return false;
    }

    const response = await fetch(`${API_URL}/api/users/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    });

    if (response.ok) {
      console.log('[NativePush] Native token synced to backend successfully');
      return true;
    } else {
      const error = await response.json();
      console.warn('[NativePush] Failed to sync native token:', error);
      return false;
    }
  } catch (error) {
    console.error('[NativePush] Error syncing native token:', error);
    return false;
  }
}

/**
 * Handle incoming push notification (foreground)
 */
function handlePushNotification(notification: PushNotificationSchema): void {
  const data = notification.data || {};
  const conversationId = data.conversationId;

  if (!conversationId) return;

  // Foreground: surface a WhatsApp-style in-app banner + chime. The OS-level
  // heads-up notification is suppressed by Android when the app is focused.
  const senderName = data.senderDisplayName || 'New message';
  const preview = typeof data.body === 'string' && data.body ? data.body : '🔒 Encrypted message';

  window.dispatchEvent(
    new CustomEvent('silenx:inapp-notification', {
      detail: {
        conversationId,
        senderName,
        senderAvatarUrl: null,
        preview,
        timestamp: new Date().toISOString(),
      },
    })
  );
}

/**
 * Handle notification tap/action:
 *  - `reply` (inline, from the Android shade): send the typed reply via the
 *    REST API without opening the app.
 *  - `mark_read`: mark the conversation read in the background.
 *  - default tap: deep-link into the conversation.
 */
function handleNotificationAction(action: ActionPerformed): void {
  const notification = action.notification;
  const data = notification.data || {};
  const conversationId = data.conversationId;

  // Inline reply from the notification shade (input actions deliver
  // `inputValue` on plugins that support it).
  if (action.actionId === 'reply' && action.inputValue && conversationId) {
    void sendInlineReply(conversationId, action.inputValue);
    return;
  }

  // Mark as Read directly from the shade — no app launch.
  if (action.actionId === 'mark_read' && conversationId) {
    void markConversationReadRemotely(conversationId);
    // Also clear any locally cached unread state for instant UI consistency.
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));
    return;
  }

  switch (action.actionId) {
    case 'open':
    case '':
    case undefined:
      // Default action - open conversation
      if (conversationId) {
        navigateToConversation(conversationId);
      } else {
        navigateToChatList();
      }
      break;

    case 'dismiss':
      // User dismissed - do nothing
      break;

    default:
      // Custom actions if any
      if (conversationId) {
        navigateToConversation(conversationId);
      }
      break;
  }
}

/** Fire-and-forget REST reply sent from the notification shade. */
async function sendInlineReply(conversationId: string, text: string): Promise<void> {
  const idToken = useAuthStore.getState().token;
  if (!idToken) {
    console.warn('[NativePush] Inline reply skipped — not signed in');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[NativePush] Inline reply failed — HTTP ${res.status}: ${detail}`);
    } else {
      console.log('[NativePush] Inline reply delivered');
    }
  } catch (err) {
    console.error('[NativePush] Inline reply error:', err);
  }
}

/** Background read receipt straight from the notification shade. */
async function markConversationReadRemotely(conversationId: string): Promise<void> {
  const idToken = useAuthStore.getState().token;
  if (!idToken) return;
  try {
    const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      console.error(`[NativePush] Mark-as-read failed — HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('[NativePush] Mark read error:', err);
  }
}

/**
 * Navigate to specific conversation.
 * Sets the active chat and signals the SPA router through DeepLinkHandler —
 * never a full page reload (there is no /chat/:id route; a reload would land
 * on a 404).
 */
function navigateToConversation(conversationId: string): void {
  useChatStore.getState().setActiveConversation(conversationId);
  window.dispatchEvent(
    new CustomEvent('silenx:open-conversation', { detail: { conversationId } })
  );
}

/**
 * Navigate to chat list
 */
function navigateToChatList(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/chats';
  }
}

/**
 * Remove native FCM token from backend (on logout)
 */
export async function removeNativeTokenFromBackend(token: string): Promise<boolean> {
  try {
    const authState = useAuthStore.getState();
    const idToken = authState.token;
    
    if (!idToken) {
      return false;
    }

    const response = await fetch(`${API_URL}/api/users/fcm-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    });

    return response.ok;
  } catch (error) {
    console.error('[NativePush] Error removing native token:', error);
    return false;
  }
}

/**
 * Get FCM token from native platform
 */
export async function getNativeFCMToken(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // The token is typically received via the 'registration' listener
    // This is a placeholder for manual token retrieval if needed
    return null;
  } catch (error) {
    console.error('[NativePush] Error getting native token:', error);
    return null;
  }
}

/**
 * Check if native push is supported
 */
export function isNativePushSupported(): boolean {
  return Capacitor.isNativePlatform() && !!Capacitor.getPlatform();
}

/**
 * Cleanup native push listeners (call on logout)
 */
export function cleanupNativePush(): void {
  PushNotifications.removeAllListeners();
  isNativePushInitialized = false;
}

/**
 * Get all pending notifications (for badge count)
 */
export async function getPendingNotifications(): Promise<PushNotificationSchema[]> {
  return [];
}

export async function removePendingNotification(_id: string): Promise<void> {
  return;
}

export async function removeAllPendingNotifications(): Promise<void> {
  return;
}