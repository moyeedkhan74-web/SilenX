import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../utils/apiFetch';
import { getActiveBackendUrl, isCapacitorNative } from '../config/webrtc-config';

const SERVICE_WORKER_PATH = '/sw.js';
const SUBSCRIBE_ENDPOINT = '/api/notifications/subscribe';

/** VAPID public key, generated once with `npx web-push generate-vapid-keys`. */
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as string | undefined)?.trim() || '';

export type PushPermissionState = NotificationPermission | 'unsupported';

export interface UsePushNotificationsResult {
  /** Browser exposes Notification + ServiceWorker + PushManager over HTTPS. */
  supported: boolean;
  /** Current browser permission state. */
  permission: PushPermissionState;
  /** A push subscription exists and is registered with the backend. */
  subscribed: boolean;
  /** True while enable()/disable() is in flight. */
  busy: boolean;
  /** Last failure message, if any. */
  error: string | null;
  /** Requests permission (if needed), subscribes, and registers with backend. */
  enable: () => Promise<boolean>;
  /** Unsubscribes and removes the registration from the backend. */
  disable: () => Promise<boolean>;
}

export function isWebPushSupported(): boolean {
  if (isCapacitorNative) return false;
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  // PushManager requires a secure context (https, or localhost).
  return window.isSecureContext;
}

/** VAPID keys are base64url — convert to the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Resolves the service worker that owns the push subscription.
 *
 * Firebase registers `/firebase-messaging-sw.js` at scope `/`; a second worker
 * cannot claim the same scope, so an existing registration is always reused.
 * That worker already implements `push` + `notificationclick`, so VAPID pushes
 * are rendered either way.
 */
async function getPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.warn('[Push] Service worker registration failed:', error);
    return null;
  }
}

/** POST/DELETE the PushSubscription with the express backend. */
async function syncSubscriptionWithBackend(
  method: 'POST' | 'DELETE',
  subscription: PushSubscription | null
): Promise<boolean> {
  try {
    const url = `${getActiveBackendUrl()}${SUBSCRIBE_ENDPOINT}`;
    const body = subscription
      ? JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        })
      : JSON.stringify({});

    const response = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      console.warn('[Push] Backend subscription sync failed:', response.status, detail);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[Push] Error syncing subscription with backend:', error);
    return false;
  }
}

async function readExistingSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Enables standards-based Web Push (VAPID) so messages and calls alert the user
 * while the tab is hidden or the app is closed.
 *
 * Native builds keep using Firebase/nativePush, and permission is only
 * requested from an explicit user action (or automatically when already granted).
 */
export function usePushNotifications(options: { autoEnable?: boolean } = {}): UsePushNotificationsResult {
  const { autoEnable = true } = options;
  const supported = isWebPushSupported();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [permission, setPermission] = useState<PushPermissionState>(
    supported && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const subscriptionRef = useRef<PushSubscription | null>(null);
  const subscribingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistState = useCallback(() => {
    if (!mountedRef.current) return;
    setPermission(supported && 'Notification' in window ? Notification.permission : 'unsupported');
    setSubscribed(subscriptionRef.current !== null);
  }, [supported]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setError('Web Push is not supported in this browser.');
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('VITE_WEB_PUSH_VAPID_PUBLIC_KEY is not configured.');
      return false;
    }
    if (!useAuthStore.getState().token) {
      setError('Sign in before enabling notifications.');
      return false;
    }
    if (subscribingRef.current) return subscriptionRef.current !== null;

    subscribingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        setError('Notification permission was not granted.');
        persistState();
        return false;
      }

      const registration = await getPushServiceWorker();
      if (!registration) {
        setError('Service worker unavailable.');
        return false;
      }

      let subscription = await readExistingSubscription(registration);
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
      }

      subscriptionRef.current = subscription;
      await syncSubscriptionWithBackend('POST', subscription);
      persistState();
      return true;
    } catch (err) {
      console.warn('[Push] Enable failed:', err);
      setError(err instanceof Error ? err.message : 'Could not enable notifications.');
      return false;
    } finally {
      subscribingRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [persistState, supported]);

  const disable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);

    try {
      const subscription = subscriptionRef.current;
      if (subscription) {
        await syncSubscriptionWithBackend('DELETE', subscription);
        await subscription.unsubscribe().catch(() => undefined);
      }
      subscriptionRef.current = null;
      persistState();
      return true;
    } catch (err) {
      console.warn('[Push] Disable failed:', err);
      setError(err instanceof Error ? err.message : 'Could not disable notifications.');
      return false;
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [persistState]);

  // Adopt an existing subscription on mount and re-register after the browser
  // rotates it (pushsubscriptionchange).
  useEffect(() => {
    if (!supported || !isAuthenticated) return;
    let cancelled = false;

    const adoptExistingSubscription = async () => {
      const registration = await getPushServiceWorker();
      if (cancelled || !registration) return;

      const existing = await readExistingSubscription(registration);
      if (!existing) return;

      subscriptionRef.current = existing;
      persistState();

      // Keep the backend record fresh (user may have rotated keys meanwhile).
      if (existing.options?.applicationServerKey) {
        await syncSubscriptionWithBackend('POST', existing);
      }
    };

    adoptExistingSubscription().catch(() => undefined);

    const handleSubscriptionChange = () => {
      getPushServiceWorker()
        .then((registration) => (registration ? readExistingSubscription(registration) : null))
        .then((subscription) => {
          if (!subscription) return;
          subscriptionRef.current = subscription;
          syncSubscriptionWithBackend('POST', subscription).finally(persistState);
        })
        .catch(() => undefined);
    };

    navigator.serviceWorker.addEventListener('pushsubscriptionchange', handleSubscriptionChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('pushsubscriptionchange', handleSubscriptionChange);
    };
  }, [isAuthenticated, persistState, supported, userId]);

  // Silent auto-enable: only when permission was already granted, so the hook
  // never shows a prompt without user intent.
  useEffect(() => {
    if (!autoEnable || !supported || !isAuthenticated) return;
    if (permission !== 'granted') return;
    if (subscriptionRef.current) return;
    enable().catch(() => undefined);
  }, [autoEnable, enable, isAuthenticated, permission, supported]);

  return { supported, permission, subscribed, busy, error, enable, disable };
}

export default usePushNotifications;
