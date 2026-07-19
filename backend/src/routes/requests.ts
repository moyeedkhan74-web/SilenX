import { Router, Response } from 'express';
import {
  users,
  conversations,
  conversationMembers,
  messages,
  friendRequests,
  friends,
  saveDb,
} from '../store/db';
import { io } from '../server';
import { getSocketIdForUser } from '../websocket/socketStore';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All request routes require authentication
router.use(requireAuth as any);

// POST /api/requests — create a contact request (outgoing)
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
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

  if (recipient.id === currentUserId) {
    res.status(400).json({ message: 'Cannot send a request to yourself' });
    return;
  }

  const sender = users.find(u => u.id === currentUserId);

  const newReq = {
    id: `req_${Date.now()}`,
    fromUserId: currentUserId,
    toUserId: recipient.id,
    fromUid: sender?.uid || 'SEC_UNKNOWN',
    fromDisplayName: sender?.displayName || 'User',
    toUid: recipient.uid,
    toDisplayName: recipient.displayName,
    status: 'pending' as const,
    createdAt: new Date(),
  };

  friendRequests.push(newReq as any);
  saveDb();

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

// GET /api/requests — list incoming requests for the authenticated user
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const incoming = friendRequests.filter(
    (r: any) => r.toUserId === currentUserId || r.receiverId === currentUserId
  );

  const enriched = incoming.map((r: any) => {
    const senderId = r.senderId || r.fromUserId;
    const sender = users.find(u => u.id === senderId);
    return {
      ...r,
      fromDisplayName: sender?.displayName || r.fromDisplayName || 'Unknown User',
      fromUid: sender?.uid || r.fromUid || 'SEC_UNKNOWN',
      fromAvatarUrl: sender?.avatarUrl || r.fromAvatarUrl || null,
    };
  });

  res.status(200).json(enriched);
});

// POST /api/requests/send — send by receiverId (alternative endpoint)
router.post('/send', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
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

  if (receiver.id === currentUserId) {
    res.status(400).json({ message: 'Cannot send a request to yourself' });
    return;
  }

  const sender = users.find(u => u.id === currentUserId);

  const newReq = {
    id: `fr_${Date.now()}`,
    senderId: currentUserId,
    receiverId: receiver.id,
    fromUserId: currentUserId,
    toUserId: receiver.id,
    fromDisplayName: sender?.displayName || 'Unknown User',
    fromUid: sender?.uid || `SEC_${currentUserId}`,
    fromAvatarUrl: sender?.avatarUrl || null,
    toDisplayName: receiver.displayName,
    toUid: receiver.uid,
    status: 'pending' as const,
    createdAt: new Date(),
    updatedAt: null,
  };

  friendRequests.push(newReq as any);
  saveDb();

  const recipientSocketId = getSocketIdForUser(receiver.id);
  if (recipientSocketId && io) {
    io.to(recipientSocketId).emit('request:new', {
      id: newReq.id,
      senderId: newReq.senderId,
      senderName: newReq.fromDisplayName,
      senderUid: newReq.fromUid,
      senderAvatar: newReq.fromAvatarUrl,
      createdAt: newReq.createdAt,
    });
  }

  res.status(201).json({ requestId: newReq.id, status: 'pending' });
});

// POST /api/requests/:id/accept — accept incoming request
router.post('/:id/accept', (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const currentUserId = req.currentUser!.dbId;

  const reqObj = friendRequests.find((r: any) => r.id === id);
  if (!reqObj) {
    res.status(404).json({ message: 'Request not found' });
    return;
  }

  const senderId = (reqObj as any).senderId || (reqObj as any).fromUserId;
  const receiverId = (reqObj as any).receiverId || (reqObj as any).toUserId;

  // Only the intended recipient may accept
  if (receiverId !== currentUserId) {
    res.status(403).json({ message: 'Cannot accept requests not addressed to you' });
    return;
  }

  reqObj.status = 'accepted';
  (reqObj as any).updatedAt = new Date();

  const sender = users.find(u => u.id === (reqObj as any).senderId);
  const receiver = users.find(u => u.id === (reqObj as any).receiverId);
  if (sender && receiver) {
    const friendEntry = {
      id: `f_${Date.now()}`,
      userId1: sender.id,
      userId2: receiver.id,
      createdAt: new Date(),
    };
    friends.push(friendEntry);
  }

  const senderSocketId = getSocketIdForUser(senderId);
  if (senderSocketId && io) {
    io.to(senderSocketId).emit('request:accepted', { id: reqObj.id, by: receiverId });
  }

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
    createdBy: currentUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  conversations.push(newConvo);

  const member1 = {
    id: `m_${newConvoId}_self`,
    conversationId: newConvoId,
    userId: currentUserId,
    joinedAt: new Date(),
    leftAt: null,
    muted: false,
  };
  const member2 = {
    id: `m_${newConvoId}_other`,
    conversationId: newConvoId,
    userId: recipient.id,
    joinedAt: new Date(),
    leftAt: null,
    muted: false,
  };
  conversationMembers.push(member1, member2);

  const systemMsg = {
    id: `msg_sys_${Date.now()}`,
    conversationId: newConvoId,
    senderId: 'system',
    encryptedContent: `Secure chat with ${recipient.displayName} (${recipient.uid}) established.`,
    contentType: 'system' as const,
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
  };
  messages.push(systemMsg);
  saveDb();

  res.status(200).json({ status: 'accepted', conversation: newConvo });
});

// POST /api/requests/:id/decline — decline incoming request
router.post('/:id/decline', (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const currentUserId = req.currentUser!.dbId;

  const reqObj = friendRequests.find((r: any) => r.id === id);
  if (!reqObj) {
    res.status(404).json({ message: 'Request not found' });
    return;
  }

  const senderId = (reqObj as any).senderId || (reqObj as any).fromUserId;
  const receiverId = (reqObj as any).receiverId || (reqObj as any).toUserId;

  if (receiverId !== currentUserId) {
    res.status(403).json({ message: 'Cannot decline requests not addressed to you' });
    return;
  }

  reqObj.status = 'declined';
  (reqObj as any).updatedAt = new Date();
  saveDb();

  const senderSocketId = getSocketIdForUser(senderId);
  if (senderSocketId && io) {
    io.to(senderSocketId).emit('request:declined', { id: reqObj.id });
  }

  res.status(200).json({ status: 'declined' });
});

export default router;
