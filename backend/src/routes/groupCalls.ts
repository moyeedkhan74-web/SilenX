import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import type { CallLog } from '../types';
import { callLogs, groups, groupMembers, users, saveDb } from '../store/db';

const router = Router();
router.use(requireAuth as any);

router.get('/history', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const history = callLogs
    .filter((call) => call.initiatorId === currentUserId || call.participants.includes(currentUserId))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((call) => ({
      id: call.id,
      conversationId: call.conversationId,
      groupId: call.groupId,
      initiatorId: call.initiatorId,
      participants: call.participants,
      callType: call.callType,
      status: call.status,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() || null,
      durationSeconds: call.durationSeconds,
    }));

  res.status(200).json(history);
});

router.post('/group/:groupId/start', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const group = groups.find((g) => g.id === req.params.groupId);
  if (!group) {
    res.status(404).json({ message: 'Group not found' });
    return;
  }

  const isMember = group.members.includes(currentUserId);
  if (!isMember) {
    res.status(403).json({ message: 'Not allowed to start a group call' });
    return;
  }

  const callId = `call_${randomUUID()}`;
  const call: CallLog = {
    id: callId,
    conversationId: `conv_group_${group.id}`,
    groupId: group.id,
    initiatorId: currentUserId,
    receiverId: undefined,
    participants: group.members,
    callType: req.body.callType || 'video',
    status: 'pending',
    startedAt: new Date(),
    endedAt: null,
    durationSeconds: null,
  };

  callLogs.push(call);
  saveDb();

  res.status(201).json({
    id: call.id,
    groupId: group.id,
    status: call.status,
    participants: call.participants,
    callType: call.callType,
    startedAt: call.startedAt.toISOString(),
  });
});

router.post('/group/:groupId/end', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const call = callLogs.find((entry) => entry.groupId === req.params.groupId && entry.initiatorId === currentUserId);
  if (!call) {
    res.status(404).json({ message: 'Group call not found' });
    return;
  }

  call.status = 'ended';
  call.endedAt = new Date();
  call.durationSeconds = req.body.durationSeconds ?? 0;
  saveDb();
  res.status(200).json({ message: 'Group call ended', id: call.id });
});

export default router;
