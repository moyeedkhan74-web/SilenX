import { Router, Request, Response } from 'express';
import { users, conversations, conversationMembers, contactRequests } from '../store/db';

const router = Router();

// POST /api/requests — create a contact request (outgoing)
router.post('/', (req: Request, res: Response) => {
  const { recipientUid } = req.body;
  if (!recipientUid) {
    res.status(400).json({ message: 'recipientUid is required' });
    return;
  }

  const recipient = users.find(u => u.uid.toLowerCase() === recipientUid.toLowerCase());
  if (!recipient) {
    res.status(404).json({ message: `User with Secure ID "${recipientUid}" not found` });
    return;
  }

  const newReq = {
    id: `req_${Date.now()}`,
    fromUserId: 'self',
    toUserId: recipient.id,
    fromUid: users.find(u => u.id === 'self')?.uid || 'SEC_UNKNOWN',
    fromDisplayName: users.find(u => u.id === 'self')?.displayName || 'User',
    toUid: recipient.uid,
    toDisplayName: recipient.displayName,
    status: 'pending' as const,
    createdAt: new Date(),
  };

  contactRequests.push(newReq);

  res.status(201).json(newReq);
});

// GET /api/requests — list incoming requests for 'self'
router.get('/', (_req: Request, res: Response) => {
  const incoming = contactRequests.filter(r => r.toUserId === 'self');
  res.status(200).json(incoming);
});

// POST /api/requests/:id/accept — accept incoming request and create conversation
router.post('/:id/accept', (req: Request, res: Response) => {
  const id = req.params.id;
  const reqObj = contactRequests.find(r => r.id === id);
  if (!reqObj) {
    res.status(404).json({ message: 'Request not found' });
    return;
  }
  if (reqObj.toUserId !== 'self') {
    res.status(403).json({ message: 'Cannot accept requests not addressed to you' });
    return;
  }

  reqObj.status = 'accepted';

  // Create conversation (direct)
  const recipient = users.find(u => u.id === reqObj.fromUserId);
  if (!recipient) {
    res.status(500).json({ message: 'Request source user not found' });
    return;
  }

  const newConvoId = `conv_${Date.now()}`;
  const newConvo = {
    id: newConvoId,
    type: 'direct' as const,
    name: null,
    avatarUrl: null,
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  conversations.push(newConvo);

  const member1 = { id: `m_${newConvoId}_self`, conversationId: newConvoId, userId: 'self', joinedAt: new Date(), leftAt: null, muted: false };
  const member2 = { id: `m_${newConvoId}_other`, conversationId: newConvoId, userId: recipient.id, joinedAt: new Date(), leftAt: null, muted: false };
  conversationMembers.push(member1, member2);

  res.status(200).json({ status: 'accepted', conversation: newConvo });
});

// POST /api/requests/:id/decline — decline incoming request
router.post('/:id/decline', (req: Request, res: Response) => {
  const id = req.params.id;
  const reqObj = contactRequests.find(r => r.id === id);
  if (!reqObj) {
    res.status(404).json({ message: 'Request not found' });
    return;
  }
  if (reqObj.toUserId !== 'self') {
    res.status(403).json({ message: 'Cannot decline requests not addressed to you' });
    return;
  }

  reqObj.status = 'rejected';

  res.status(200).json({ status: 'rejected' });
});

export default router;
