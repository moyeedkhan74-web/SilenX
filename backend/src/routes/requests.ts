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

  if (areFriends(currentUserId, recipient.id)) {
    res.status(400).json({ message: 'This user is already your friend.' });
    return;
  }

  if (existingFriendRequest(currentUserId, recipient.id)) {
    res.status(409).json({ message: 'A request is already pending between you and this user.' });
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

// GET /api/requests — list requests for the authenticated user (incoming pending and all mutual accepted)
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const list = friendRequests.filter((r: any) => {
    const isReceiver = r.toUserId === currentUserId || r.receiverId === currentUserId;
    const isSender = r.fromUserId === currentUserId || r.senderId === currentUserId;
    if (r.status === 'accepted') {
      return isReceiver || isSender;
    }
    return isReceiver; // only show incoming pending requests
  });

  const enriched = list.map((r: any) => {
    const senderId = r.senderId || r.fromUserId;
    const receiverId = r.receiverId || r.toUserId;
    const sender = users.find(u => u.id === senderId);
    const receiver = users.find(u => u.id === receiverId);

    // Respect showOnlineStatus privacy for each party
    const senderShowsStatus = (sender as any)?.showOnlineStatus !== false;
    const receiverShowsStatus = (receiver as any)?.showOnlineStatus !== false;

    return {
      ...r,
      fromDisplayName: sender?.displayName || r.fromDisplayName || 'Unknown User',
      fromUid: sender?.uid || r.fromUid || 'SEC_UNKNOWN',
      fromAvatarUrl: sender?.avatarUrl || r.fromAvatarUrl || null,
      fromStatus: senderShowsStatus ? (sender?.status || 'offline') : 'offline',
      fromLastSeen: senderShowsStatus ? (sender?.lastSeen ? sender.lastSeen.toISOString() : null) : null,
      toDisplayName: receiver?.displayName || r.toDisplayName || 'Unknown User',
      toUid: receiver?.uid || r.toUid || 'SEC_UNKNOWN',
      toAvatarUrl: receiver?.avatarUrl || r.toAvatarUrl || null,
      toStatus: receiverShowsStatus ? (receiver?.status || 'offline') : 'offline',
      toLastSeen: receiverShowsStatus ? (receiver?.lastSeen ? receiver.lastSeen.toISOString() : null) : null,
    };
  });

  res.status(200).json(enriched);
});

function areFriends(userA: string, userB: string) {
  return friends.some((friend) =>
    (friend.userId1 === userA && friend.userId2 === userB) ||
    (friend.userId1 === userB && friend.userId2 === userA)
  );
}

function findDirectConversationBetween(userA: string, userB: string) {
  return conversations.find((conversation) => {
    if (conversation.type !== 'direct') return false;
    const memberIds = conversationMembers
      .filter((member) => member.conversationId === conversation.id)
      .map((member) => member.userId);
    return memberIds.includes(userA) && memberIds.includes(userB);
  });
}

function existingFriendRequest(userA: string, userB: string) {
  return friendRequests.some((request) => {
    const senderId = (request as any).senderId || (request as any).fromUserId;
    const receiverId = (request as any).receiverId || (request as any).toUserId;
    return (
      request.status === 'pending' &&
      ((senderId === userA && receiverId === userB) || (senderId === userB && receiverId === userA))
    );
  });
}

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

  if (areFriends(currentUserId, receiver.id)) {
    res.status(400).json({ message: 'This user is already your friend.' });
    return;
  }

  if (existingFriendRequest(currentUserId, receiver.id)) {
    res.status(409).json({ message: 'A request is already pending between you and this user.' });
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
  if (!sender || !receiver) {
    res.status(500).json({ message: 'Request participant(s) not found' });
    return;
  }

  const senderSocketId = getSocketIdForUser(senderId);
  if (senderSocketId && io) {
    io.to(senderSocketId).emit('request:accepted', { id: reqObj.id, by: receiverId });
  }

  let existingConversation = findDirectConversationBetween(senderId, receiverId);
  const alreadyFriends = areFriends(senderId, receiverId);

  if (!alreadyFriends) {
    const friendEntry = {
      id: `f_${Date.now()}`,
      userId1: sender.id,
      userId2: receiver.id,
      createdAt: new Date(),
    };
    friends.push(friendEntry);
  }

  if (!existingConversation) {
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
      userId: receiverId,
      joinedAt: new Date(),
      leftAt: null,
      muted: false,
    };
    conversationMembers.push(member1, member2);

    const systemMsg = {
      id: `msg_sys_${Date.now()}`,
      conversationId: newConvoId,
      senderId: 'system',
      encryptedContent: `Secure chat with ${receiver.displayName} (${receiver.uid}) established.`,
      contentType: 'system' as const,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    };
    messages.push(systemMsg);

    saveDb();
    existingConversation = newConvo;
  } else {
    saveDb();
  }

  res.status(200).json({ status: 'accepted', conversation: existingConversation });
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

// DELETE /api/requests/friends/:targetUserId — Unfriend a contact
router.delete('/friends/:targetUserId', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const targetUserId = req.params.targetUserId;

  if (!targetUserId) {
    res.status(400).json({ message: 'targetUserId is required' });
    return;
  }

  // Remove from friends array
  const friendIndex = friends.findIndex(
    (f) =>
      (f.userId1 === currentUserId && f.userId2 === targetUserId) ||
      (f.userId1 === targetUserId && f.userId2 === currentUserId)
  );

  if (friendIndex !== -1) {
    friends.splice(friendIndex, 1);
  }

  // Remove or update associated friend requests
  const requestIndex = friendRequests.findIndex(
    (r: any) =>
      ((r.senderId === currentUserId || r.fromUserId === currentUserId) &&
        (r.receiverId === targetUserId || r.toUserId === targetUserId)) ||
      ((r.senderId === targetUserId || r.fromUserId === targetUserId) &&
        (r.receiverId === currentUserId || r.toUserId === currentUserId))
  );

  if (requestIndex !== -1) {
    friendRequests.splice(requestIndex, 1);
  }

  saveDb();

  // Notify target user if online
  const targetSocketId = getSocketIdForUser(targetUserId);
  if (targetSocketId && io) {
    io.to(targetSocketId).emit('request:declined', { id: `unfriend_${currentUserId}` });
  }

  res.status(200).json({ status: 'unfriended', targetUserId });
});

export default router;
