import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { callLogs, users, saveDb } from '../store/db';

const router = Router();
router.use(requireAuth as any);

// GET /api/calls/history — Get call history for the current user
router.get('/history', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.currentUser!.dbId;

  const myLogs = callLogs
    .filter((log) => {
      const isParticipant = log.initiatorId === userId || log.receiverId === userId || log.participants.includes(userId);
      const isNotDeleted = !log.deletedFor?.includes(userId);
      return isParticipant && isNotDeleted;
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 100);

  const enriched = myLogs.map((log) => {
    const otherId = log.initiatorId === userId ? log.receiverId : log.initiatorId;
    const otherUser = users.find((u) => u.id === otherId);
    return {
      id: log.id,
      callType: log.callType,
      status: log.status,
      direction: log.initiatorId === userId ? 'outgoing' : 'incoming',
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      durationSeconds: log.durationSeconds,
      otherUser: otherUser
        ? { id: otherUser.id, displayName: otherUser.displayName, avatarUrl: otherUser.avatarUrl }
        : { id: otherId, displayName: 'Unknown', avatarUrl: null },
    };
  });

  res.json(enriched);
});

// DELETE /api/calls/history — Clear all call history for the current user
router.delete('/history', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.currentUser!.dbId;

  callLogs.forEach((log) => {
    if (log.initiatorId === userId || log.receiverId === userId || log.participants.includes(userId)) {
      if (!log.deletedFor) {
        log.deletedFor = [];
      }
      if (!log.deletedFor.includes(userId)) {
        log.deletedFor.push(userId);
      }
    }
  });

  saveDb();
  res.json({ success: true, message: 'Call history cleared' });
});

// DELETE /api/calls/history/:id — Clear a specific call log entry for the current user
router.delete('/history/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.currentUser!.dbId;
  const { id } = req.params;

  const log = callLogs.find((l) => l.id === id);
  if (!log) {
    return res.status(404).json({ error: 'Call log not found' });
  }

  // Verify user is a participant
  const isParticipant = log.initiatorId === userId || log.receiverId === userId || log.participants.includes(userId);
  if (!isParticipant) {
    return res.status(403).json({ error: 'Unauthorized to delete this call log' });
  }

  if (!log.deletedFor) {
    log.deletedFor = [];
  }
  if (!log.deletedFor.includes(userId)) {
    log.deletedFor.push(userId);
  }

  saveDb();
  res.json({ success: true, message: 'Call log entry deleted' });
});

export default router;
