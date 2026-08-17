import { app } from '../config/firebase';
import { getMessaging, getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../config/webrtc-config';

let messaging: Messaging | null = null;
let isInitialized = false;
let currentToken: string | null = null;

/**
 * Initialize Firebase Messaging
 */
export function initializePushMessaging(): Messaging | null {
  if (isInitialized && messaging) {
    return messaging;
  }

  if (!app) {
    console.warn('[PushNotification] Firebase app not initialized');
    return null;
  }

  try {
    messaging = getMessaging(app);
    isInitialized = true;
    console.log('[PushNotification] Firebase Messaging initialized');
    return messaging;
  } catch (error) {
    console.error('[PushNotification] Failed to initialize messaging:', error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 */
export async function requestPermissionAndGetToken(): Promise<string | null> {
  const messagingInstance = initializePushMessaging();
  if (!messagingInstance) {
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[PushNotification] Notification permission not granted');
      return null;
    }

    // Get FCM token
    const token = await getToken(messagingInstance, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined,
    });

    if (token) {
      currentToken = token;
      console.log('[PushNotification] FCM token retrieved:', token);
      
      // Sync token to backend
      await syncTokenToBackend(token);
      
      return token;
    } else {
      console.warn('[PushNotification] No registration token available');
      return null;
    }
  } catch (error) {
    console.error('[PushNotification] Error getting FCM token:', error);
    return null;
  }
}

/**
 * Sync FCM token to backend
 */
async function syncTokenToBackend(token: string): Promise<boolean> {
  try {
    const authState = useAuthStore.getState();
    const idToken = authState.token;
    
    if (!idToken) {
      console.warn('[PushNotification] No auth token available, skipping backend sync');
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
      console.log('[PushNotification] Token synced to backend successfully');
      return true;
    } else {
      const error = await response.json();
      console.warn('[PushNotification] Failed to sync token to backend:', error);
      return false;
    }
  } catch (error) {
    console.error('[PushNotification] Error syncing token to backend:', error);
    return false;
  }
}

/**
 * Remove FCM token from backend (on logout)
 */
export async function removeTokenFromBackend(token: string): Promise<boolean> {
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
    console.error('[PushNotification] Error removing token from backend:', error);
    return false;
  }
}

/**
 * Handle foreground messages
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): (() => void) | null {
  const messagingInstance = initializePushMessaging();
  if (!messagingInstance) {
    return null;
  }

  try {
    const unsubscribe = onMessage(messagingInstance, (payload) => {
      console.log('[PushNotification] Foreground message received:', payload);
      callback(payload);
    });
    return unsubscribe;
  } catch (error) {
    console.error('[PushNotification] Error setting up foreground message handler:', error);
    return null;
  }
}

/**
 * Get current FCM token
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Check if notifications are supported
 */
export function isPushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Register service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PushNotification] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('[PushNotification] Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[PushNotification] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Initialize push notifications (call on app startup)
 */
export async function initializePushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('[PushNotification] Push notifications not supported in this browser');
    return false;
  }

  // Register service worker
  await registerServiceWorker();

  // Initialize messaging
  const messagingInstance = initializePushMessaging();
  if (!messagingInstance) {
    return false;
  }

  // Request permission and get token
  const token = await requestPermissionAndGetToken();
  
  return !!token;
}

/**
 * Handle token refresh (called when token is updated)
 */
export function onTokenRefresh(callback: (token: string) => void): (() => void) | null {
  const messagingInstance = initializePushMessaging();
  if (!messagingInstance) {
    return null;
  }

  try {
    const unsubscribe = messagingInstance.onTokenRefresh(async (newToken) => {
      console.log('[PushNotification] Token refreshed:', newToken);
      currentToken = newToken;
      await syncTokenToBackend(newToken);
      callback(newToken);
    });
    return unsubscribe;
  } catch (error) {
    console.error('[PushNotification] Error setting up token refresh handler:', error);
    return null;
  }
}

/**
 * Cleanup - remove token on logout
 */
export async function cleanupPushNotifications(): Promise<void> {
  if (currentToken) {
    await removeTokenFromBackend(currentToken);
    currentToken = null;
  }
}