import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { callLogs, users } from '../store/db';

const router = Router();
router.use(requireAuth as any);

// GET /api/calls/history — Get call history for the current user
router.get('/history', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.currentUser!.dbId;

  const myLogs = callLogs
    .filter((log) => log.initiatorId === userId || log.receiverId === userId || log.participants.includes(userId))
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

export default router;
