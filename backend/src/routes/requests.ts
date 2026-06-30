import { Router, Request, Response } from 'express';
import { users, conversations, conversationMembers, contactRequests, friendRequests, friends } from '../store/db';
import { io } from '../server';
import { getSocketIdForUser } from '../websocket/socketStore';

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

  friendRequests.push(newReq as any);
  // Emit real-time event to recipient if connected
  const recipientSocketId = getSocketIdForUser(recipient.id);
  if (recipientSocketId && io) {
    io.to(recipientSocketId).emit('request:new', {
      id: newReq.id,
      fromUserId: newReq.fromUserId,
      fromDisplayName: newReq.fromDisplayName,
      fromUid: newReq.fromUid,
      createdAt: newReq.createdAt,
    });
  }

  res.status(201).json(newReq);
});

// GET /api/requests — list incoming requests for 'self'
router.get('/', (_req: Request, res: Response) => {
  const incoming = friendRequests.filter((r: any) => (r.toUserId === 'self' || r.receiverId === 'self'));
  res.status(200).json(incoming);
});

// POST /api/requests/send — send by receiverId
router.post('/send', (req: Request, res: Response) => {
  const { receiverId } = req.body;
  if (!receiverId) {
    res.status(400).json({ message: 'receiverId is required' });
    return;
  }
  const receiver = users.find(u => u.id === receiverId);
  if (!receiver) {
    res.status(404).json({ message: 'Receiver not found' });
    return;
  }

  const newReq = {
    id: `fr_${Date.now()}`,
    senderId: 'self',
    receiverId: receiver.id,
    status: 'pending' as const,
    createdAt: new Date(),
    updatedAt: null,
  };

  friendRequests.push(newReq as any);

  // Emit to receiver
  const recipientSocketId = getSocketIdForUser(receiver.id);
  if (recipientSocketId && io) {
    io.to(recipientSocketId).emit('request:new', {
      id: newReq.id,
      senderId: newReq.senderId,
      senderName: users.find(u => u.id === newReq.senderId)?.displayName,
      senderUid: users.find(u => u.id === newReq.senderId)?.uid,
      senderAvatar: users.find(u => u.id === newReq.senderId)?.avatarUrl,
      createdAt: newReq.createdAt,
    });
  }

  res.status(201).json({ requestId: newReq.id, status: 'pending' });
});

// POST /api/requests/:id/accept — accept incoming request and create conversation
router.post('/:id/accept', (req: Request, res: Response) => {
  const id = req.params.id;
  const reqObj = friendRequests.find((r: any) => r.id === id);
  if (!reqObj) {
    res.status(404).json({ message: 'Request not found' });
    return;
  }
  const senderId = (reqObj as any).senderId || (reqObj as any).fromUserId;
  const receiverId = (reqObj as any).receiverId || (reqObj as any).toUserId;

  if (receiverId !== 'self') {
    res.status(403).json({ message: 'Cannot accept requests not addressed to you' });
    return;
  }

  reqObj.status = 'accepted';
  reqObj.updatedAt = new Date();

  // Create friend relationship
  const sender = users.find(u => u.id === reqObj.senderId);
  const receiver = users.find(u => u.id === reqObj.receiverId);
  if (sender && receiver) {
    const friendEntry = { id: `f_${Date.now()}`, userId1: sender.id, userId2: receiver.id, createdAt: new Date() };
    friends.push(friendEntry);
  }

  // Notify sender
  const senderSocketId = getSocketIdForUser(senderId);
  if (senderSocketId && io) {
    io.to(senderSocketId).emit('request:accepted', { id: reqObj.id, by: receiverId });
  }

  // Create conversation (direct) for chat UI
  const recipient = users.find(u => u.id === senderId);
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
  const reqObj = friendRequests.find((r: any) => r.id === id);
  if (!reqObj) {
    res.status(404).json({ message: 'Request not found' });
    return;
  }
  const senderId = (reqObj as any).senderId || (reqObj as any).fromUserId;
  const receiverId = (reqObj as any).receiverId || (reqObj as any).toUserId;

  if (receiverId !== 'self') {
    res.status(403).json({ message: 'Cannot decline requests not addressed to you' });
    return;
  }

  reqObj.status = 'declined';
  reqObj.updatedAt = new Date();

  // Notify sender
  const senderSocketId = getSocketIdForUser(senderId);
  if (senderSocketId && io) {
    io.to(senderSocketId).emit('request:declined', { id: reqObj.id });
  }

  res.status(200).json({ status: 'declined' });
});

export default router;
