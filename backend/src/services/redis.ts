import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = (redisUrl && redisToken)
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

/**
 * Set user online status with TTL (seconds)
 */
export async function setUserOnline(userId: string, ttlSeconds = 300) {
  if (!redis) return;
  try {
    await redis.set(`user:online:${userId}`, 'true', { ex: ttlSeconds });
  } catch (err) {
    console.warn('[Redis] Error setting online status:', err);
  }
}

/**
 * Check if user is online (< 2ms lookup)
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const status = await redis.get(`user:online:${userId}`);
    return status === 'true';
  } catch (err) {
    console.warn('[Redis] Error checking online status:', err);
    return false;
  }
}
