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
 * Handle notification tap/action - navigate to conversation
 */
function handleNotificationAction(action: ActionPerformed): void {
  const notification = action.notification;
  const data = notification.data || {};
  const conversationId = data.conversationId;
  const actionId = action.actionId;

  // Handle different actions
  switch (actionId) {
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