/**
 * redisAdapter.ts
 *
 * Creates a pub/sub Redis client pair for the Socket.IO Redis Adapter.
 * This allows multiple Render instances to share real-time socket events
 * (messages, calls, presence) through Upstash Redis.
 *
 * Uses ioredis (native TCP/TLS protocol) — separate from the REST-based
 * @upstash/redis client used for online-status TTLs.
 *
 * Required env var (Upstash console → your DB → "Connect" → "ioredis"):
 *   UPSTASH_REDIS_URL = rediss://:PASSWORD@hostname:port
 *
 * Degradation policy:
 *   - If UPSTASH_REDIS_URL is missing → single-instance mode (in-memory adapter).
 *   - If Redis is configured but unreachable → the adapter is still attached so
 *     ioredis keeps retrying with back-off; every socket event is additionally
 *     delivered locally by Socket.IO, so a single instance stays functional.
 *     Cross-instance delivery resumes automatically once Redis recovers.
 */

import Redis, { RedisOptions } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

/** True when the adapter is configured AND both clients have an open connection. */
let redisConnected = false;
/** True when UPSTASH_REDIS_URL is set (adapter configured, regardless of health). */
let redisConfigured = false;

/** Connection health of the Redis adapter, for /ready and /api/status reporting. */
export const getRedisAdapterStatus = (): { configured: boolean; connected: boolean } => ({
  configured: redisConfigured,
  connected: redisConnected,
});

function makeClient(url: string): Redis {
  const isTls = url.startsWith('rediss://');

  const options: RedisOptions = {
    // For TLS (rediss://), pass tls object; plain redis:// needs nothing
    ...(isTls ? { tls: {} } : {}),
    // Required by ioredis for pub/sub — disables the default command timeout
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 200, 4000); // 200 ms → 4 s back-off
      console.warn(`[RedisAdapter] Reconnect attempt ${times} in ${delay}ms…`);
      return delay;
    },
  };

  return new Redis(url, options);
}

/**
 * Build and return a Socket.IO adapter backed by Upstash Redis.
 * Returns null when UPSTASH_REDIS_URL is not set so the server
 * automatically falls back to the default in-memory adapter (single-instance mode).
 */
export function buildRedisAdapter() {
  const redisUrl = process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    redisConfigured = false;
    redisConnected = false;
    console.warn(
      '[RedisAdapter] UPSTASH_REDIS_URL not set — Socket.IO in single-instance mode. ' +
        'Add this env var on BOTH Render services to enable multi-server socket sync.'
    );
    return null;
  }

  redisConfigured = true;

  try {
    pubClient = makeClient(redisUrl);
    subClient = makeClient(redisUrl); // independent duplicate for subscribe

    pubClient.on('connect', () => console.log('[RedisAdapter] pub connected ✓'));
    pubClient.on('ready', () => {
      redisConnected = true;
      console.log('[RedisAdapter] pub ready ✓ — cross-instance sync active');
    });
    pubClient.on('end', () => {
      redisConnected = false;
      console.warn('[RedisAdapter] pub connection closed — cross-instance sync degraded');
    });
    pubClient.on('close', () => {
      redisConnected = false;
    });
    pubClient.on('error', (e) => {
      redisConnected = false;
      console.error('[RedisAdapter] pub error:', e.message);
    });

    subClient.on('connect', () => console.log('[RedisAdapter] sub connected ✓'));
    subClient.on('ready', () => console.log('[RedisAdapter] sub ready ✓'));
    subClient.on('error', (e) => {
      console.error('[RedisAdapter] sub error:', e.message);
    });

    // Both clients must be healthy for cross-instance sync to be considered live
    const markDisconnected = () => {
      redisConnected = false;
    };
    pubClient.on('close', markDisconnected);
    subClient.on('close', markDisconnected);

    return createAdapter(pubClient, subClient);
  } catch (err) {
    console.error('[RedisAdapter] Failed to build adapter:', err);
    redisConfigured = false;
    redisConnected = false;
    return null;
  }
}

/** Gracefully close both Redis connections (called on SIGTERM/SIGINT) */
export async function closeRedisAdapter(): Promise<void> {
  try {
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
    redisConnected = false;
    console.log('[RedisAdapter] Connections closed.');
  } catch (err) {
    console.warn('[RedisAdapter] Error closing connections:', err);
  } finally {
    pubClient = null;
    subClient = null;
  }
}
