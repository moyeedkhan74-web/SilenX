import webpush from 'web-push';
import { users, saveDb } from '../store/db';
import { WebPushSubscriptionRecord } from '../types';

let configured = false;

/**
 * Configures the VAPID key pair used to sign every outgoing push request.
 * Keys are generated once with `npx web-push generate-vapid-keys`.
 */
export function configureWebPush(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@slienx.app';

  if (!publicKey || !privateKey) {
    console.warn('[WebPush] VAPID keys not configured - web push notifications disabled.');
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    console.log('[WebPush] VAPID configured');
    return true;
  } catch (error) {
    console.error('[WebPush] Failed to configure VAPID:', error);
    return false;
  }
}

export function isWebPushConfigured(): boolean {
  return configured;
}

/** Status codes that mean the subscription is permanently gone. */
function isGoneStatus(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}

export interface WebPushMessagePayload {
  /** 'message' renders the chat preview; 'call' renders a ringing alert. */
  type?: 'message' | 'call';
  title: string;
  body: string;
  icon?: string;
  conversationId?: string;
  senderId?: string;
  messageId?: string;
  callType?: string;
}

function normalizeSubscription(subscription: WebPushSubscriptionRecord) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
    },
  };
}

/**
 * True when the user has at least one browser Web Push subscription, i.e. Web
 * Push already covers them and the Firebase path must be skipped to avoid
 * delivering the same alert twice.
 */
export function hasWebPushSubscriptions(userId: string): boolean {
  const targetUser = users.find((u) => u.id === userId);
  return (targetUser?.webPushSubscriptions?.length || 0) > 0;
}

/**
 * Delivers a Web Push message to every browser subscription a user owns.
 * Dead endpoints (404/410) are pruned so the record does not grow forever.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushMessagePayload
): Promise<boolean> {
  if (!configured && !configureWebPush()) return false;

  const targetUser = users.find((u) => u.id === userId);
  const subscriptions = targetUser?.webPushSubscriptions || [];

  if (subscriptions.length === 0) return false;

  // The payload is emitted in BOTH shapes on purpose. A browser can be
  // controlled by either worker at scope '/':
  //   - public/sw.js reads the top-level title/body/conversationId
  //   - public/firebase-messaging-sw.js reads only notification.* and data.*
  // Emitting both keeps sender name, preview and chat deep links correct
  // regardless of which worker ends up owning the push subscription.
  const body = JSON.stringify({
    type: payload.type || 'message',
    title: payload.title,
    body: payload.body,
    icon: payload.icon,
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    messageId: payload.messageId,
    callType: payload.callType,
    notification: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
    },
    data: {
      type: payload.type || 'message',
      senderDisplayName: payload.title,
      body: payload.body,
      senderAvatarUrl: payload.icon,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      messageId: payload.messageId,
      callType: payload.callType,
    },
  });

  let delivered = 0;
  const expiredEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(normalizeSubscription(subscription), body, {
          TTL: 60 * 60,
          urgency: payload.type === 'call' ? 'high' : 'normal',
        });
        delivered += 1;
      } catch (error: any) {
        const statusCode = error?.statusCode;
        if (isGoneStatus(statusCode)) {
          expiredEndpoints.push(subscription.endpoint);
        } else if (statusCode !== 429) {
          console.warn('[WebPush] Send failed:', statusCode || error?.message);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0 && targetUser) {
    targetUser.webPushSubscriptions = (targetUser.webPushSubscriptions || []).filter(
      (sub) => !expiredEndpoints.includes(sub.endpoint)
    );
    targetUser.updatedAt = new Date();
    saveDb();
    console.log(`[WebPush] Pruned ${expiredEndpoints.length} expired subscription(s) for ${userId}`);
  }

  return delivered > 0;
}

/** Sends the same payload to many users (used by group conversation fan-out). */
export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushMessagePayload
): Promise<number> {
  const results = await Promise.all(
    userIds.map((userId) => sendWebPushToUser(userId, payload).catch(() => false))
  );
  return results.filter(Boolean).length;
}
