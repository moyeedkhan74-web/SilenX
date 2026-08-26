import mongoose from 'mongoose';
import { MessageModel } from '../store/models';
import { messages, saveDb } from '../store/db';

/**
 * Zero-bandwidth database pruning engine.
 *
 * Runs entirely inside server memory + MongoDB Atlas — no client traffic, no
 * REST calls, 0 KB of internet bandwidth. Keeps cloud storage bounded:
 *   - Heavy media payloads (voice notes / images / video / files) older than
 *     7 days have their Base64 content replaced by a placeholder.
 *   - Messages older than 30 days are scheduled for native MongoDB TTL
 *     deletion via the `expireAt` index and removed from the in-memory store.
 *
 * The in-memory mirror is critical: `syncCollection()` upserts every in-memory
 * message back into Mongo on every saveDb(), so documents that Mongo's TTL
 * monitor deletes MUST also leave the memory array or they would resurrect.
 */

const RETENTION_DAYS_MEDIA = 7;
const RETENTION_DAYS_MESSAGES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const MEDIA_CONTENT_TYPES = ['voice-note', 'image', 'video', 'file'];
export const PRUNED_MEDIA_PLACEHOLDER = '[Media expired from cloud — preserved in device storage]';

async function runCleanup(): Promise<void> {
  try {
    // Skip entirely when MongoDB is not connected (offline dev / cold start).
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const now = new Date();
    const mediaCutoff = new Date(now.getTime() - RETENTION_DAYS_MEDIA * DAY_MS);
    const messageCutoff = new Date(now.getTime() - RETENTION_DAYS_MESSAGES * DAY_MS);

    // 1. Prune heavy voice/media payloads older than 7 days in MongoDB.
    const mediaResult = await MessageModel.updateMany(
      {
        createdAt: { $lt: mediaCutoff },
        contentType: { $in: MEDIA_CONTENT_TYPES },
        prunedAt: null,
      },
      {
        $set: {
          encryptedContent: PRUNED_MEDIA_PLACEHOLDER,
          prunedAt: now,
        },
      }
    );

    // 2. Mark old messages (30+ days) for native MongoDB TTL deletion.
    const ttlResult = await MessageModel.updateMany(
      {
        createdAt: { $lt: messageCutoff },
        expireAt: null,
      },
      {
        $set: {
          expireAt: new Date(now.getTime() + 60 * 1000), // TTL sweep within ~60s
        },
      }
    );

    // 3. Mirror both operations into the in-memory store so the periodic
    // Mongo sync never resurrects expired documents.
    let memoryMediaPruned = 0;
    let memoryExpiredRemoved = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const createdAt = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);

      if (createdAt < messageCutoff) {
        messages.splice(i, 1);
        memoryExpiredRemoved += 1;
        continue;
      }

      if (
        createdAt < mediaCutoff &&
        MEDIA_CONTENT_TYPES.includes(m.contentType) &&
        !(m as any).prunedAt
      ) {
        m.encryptedContent = PRUNED_MEDIA_PLACEHOLDER;
        (m as any).prunedAt = now;
        memoryMediaPruned += 1;
      }
    }

    if (memoryMediaPruned > 0 || memoryExpiredRemoved > 0) {
      saveDb();
    }

    if (mediaResult.modifiedCount > 0 || ttlResult.modifiedCount > 0 || memoryExpiredRemoved > 0) {
      console.log(
        `[PruneService] Background cleanup complete: ` +
          `${mediaResult.modifiedCount} media payloads pruned (${memoryMediaPruned} in-memory), ` +
          `${ttlResult.modifiedCount} old messages scheduled for TTL deletion (${memoryExpiredRemoved} removed from memory) ` +
          `— 0 KB network overhead`
      );
    }
  } catch (error) {
    console.warn('[PruneService] Background cleanup error:', error);
  }
}

/**
 * Initialize the background pruner: first pass ~30s after boot (lets MongoDB
 * connect settle), then once every 24 hours. Uses only internal DB operations.
 */
export function initializePruner(): void {
  setTimeout(() => {
    void runCleanup();
  }, 30_000);
  setInterval(() => {
    void runCleanup();
  }, 24 * 60 * 60 * 1000);
  console.log('[PruneService] Zero-bandwidth pruner scheduled (media 7d / messages 30d)');
}
