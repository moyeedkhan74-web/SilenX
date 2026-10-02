import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { users, saveDb } from '../store/db';
import { isWebPushConfigured } from '../services/webPushService';

const router = Router();

interface PushSubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
}

interface ValidPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function isValidSubscription(
  subscription: PushSubscriptionBody | undefined
): subscription is ValidPushSubscription {
  return Boolean(
    subscription &&
    typeof subscription.endpoint === 'string' &&
    subscription.endpoint.startsWith('https://') &&
    typeof subscription.keys?.p256dh === 'string' &&
    typeof subscription.keys?.auth === 'string'
  );
}

/**
 * GET /api/notifications/vapid-public-key
 * Lets the client fetch the VAPID key instead of hardcoding it in the bundle.
 */
router.get('/vapid-public-key', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  if (!isWebPushConfigured()) {
    res.status(503).json({ message: 'Web Push is not configured on this server' });
    return;
  }
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

/**
 * POST /api/notifications/subscribe
 * Stores (or refreshes) a browser PushSubscription for the authenticated user.
 * Re-subscribing the same endpoint only updates its metadata, so repeat calls
 * from the hook stay idempotent.
 */
router.post('/subscribe', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { subscription, userAgent, platform } = req.body || {};

  if (!isValidSubscription(subscription)) {
    res.status(400).json({ message: 'A valid push subscription with endpoint and keys is required' });
    return;
  }

  const selfUser = users.find((u) => u.id === currentUserId);
  if (!selfUser) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  if (!selfUser.webPushSubscriptions) {
    selfUser.webPushSubscriptions = [];
  }

  const existing = selfUser.webPushSubscriptions.find((sub) => sub.endpoint === subscription.endpoint);
  if (existing) {
    existing.keys = {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    };
    existing.userAgent = typeof userAgent === 'string' ? userAgent : existing.userAgent;
    existing.platform = typeof platform === 'string' ? platform : existing.platform;
  } else {
    selfUser.webPushSubscriptions.push({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      platform: typeof platform === 'string' ? platform : undefined,
      createdAt: new Date(),
    });
  }

  selfUser.updatedAt = new Date();
  saveDb();

  console.log(`[Notifications] Web Push subscription registered for ${currentUserId}`);
  res.status(200).json({
    message: 'Web Push subscription registered',
    endpoints: selfUser.webPushSubscriptions.length,
  });
});

/**
 * DELETE /api/notifications/subscribe
 * Removes one endpoint, or every endpoint when no endpoint is supplied.
 */
router.delete('/subscribe', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { endpoint } = req.body || {};

  const selfUser = users.find((u) => u.id === currentUserId);
  if (!selfUser || !selfUser.webPushSubscriptions) {
    res.status(200).json({ message: 'No Web Push subscriptions to remove', endpoints: 0 });
    return;
  }

  if (typeof endpoint === 'string' && endpoint) {
    selfUser.webPushSubscriptions = selfUser.webPushSubscriptions.filter(
      (sub) => sub.endpoint !== endpoint
    );
  } else {
    selfUser.webPushSubscriptions = [];
  }

  selfUser.updatedAt = new Date();
  saveDb();

  res.status(200).json({
    message: 'Web Push subscription removed',
    endpoints: selfUser.webPushSubscriptions.length,
  });
});

export default router;
