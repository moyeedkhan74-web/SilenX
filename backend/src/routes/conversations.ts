import { Router, Response } from 'express';
import {
  users,
  conversations,
  conversationMembers,
  messages,
  saveDb,
} from '../store/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All conversation routes are authenticated
router.use(requireAuth as any);

/**
 * Map a user object to a safe public payload, respecting their showOnlineStatus privacy setting.
 * If showOnlineStatus is false, other users see them as offline with no lastSeen.
 */
function mapMemberPublic(u: typeof users[0]) {
  const showOnline = (u as any).showOnlineStatus !== false;
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    status: showOnline ? u.status : 'offline',
    lastSeen: showOnline ? (u.lastSeen ? u.lastSeen.toISOString() : '') : '',
    bio: u.bio,
  };
}

// GET /api/conversations — List the authenticated user's conversations
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;

  const userConvos = conversations.filter(c =>
    conversationMembers.some(m => m.conversationId === c.id && m.userId === currentUserId)
  );

  const formatted = userConvos.map(c => {
    const memberRels = conversationMembers.filter(m => m.conversationId === c.id);
    const detailedMembers = memberRels
      .map(mr => users.find(u => u.id === mr.userId))
      .filter((u): u is typeof users[0] => !!u)
      .map(mapMemberPublic);

    const convoMessages = messages
      .filter(m => m.conversationId === c.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const lastMessage = convoMessages[convoMessages.length - 1];

    return {
      id: c.id,
      type: c.type,
      name: c.name,
      avatarUrl: c.avatarUrl,
      lastMessage: lastMessage
        ? lastMessage.encryptedContent
        : 'Say hi! 🔗 Secure connection established.',
      lastMessageTime: lastMessage
        ? lastMessage.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      unreadCount: 0,
      members: detailedMembers,
    };
  });

  res.status(200).json(formatted);
});

// POST /api/conversations — Create new conversation (or return existing one)
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { type, recipientUid } = req.body;
  const currentUserId = req.currentUser!.dbId;

  if (!recipientUid) {
    res.status(400).json({ message: 'recipientUid is required' });
    return;
  }

  const recipient = users.find(u => u.uid.toLowerCase() === recipientUid.toLowerCase());
  if (!recipient) {
    res.status(404).json({ message: `User with Secure ID "${recipientUid}" not found` });
    return;
  }

  // Prevent creating a conversation with yourself
  if (recipient.id === currentUserId) {
    res.status(400).json({ message: 'Cannot create a conversation with yourself' });
    return;
  }

  // Return existing direct conversation if it exists
  if (type === 'direct') {
    const existingMemberRel = conversationMembers.find(
      m =>
        m.userId === recipient.id &&
        conversationMembers.some(
          selfM => selfM.conversationId === m.conversationId && selfM.userId === currentUserId
        )
    );

    if (existingMemberRel) {
      const existingConvo = conversations.find(c => c.id === existingMemberRel.conversationId);
      if (existingConvo) {
        const memberRels = conversationMembers.filter(m => m.conversationId === existingConvo.id);
        const detailedMembers = memberRels
          .map(mr => users.find(u => u.id === mr.userId))
          .filter((u): u is typeof users[0] => !!u)
          .map(mapMemberPublic);

        const convoMessages = messages.filter(m => m.conversationId === existingConvo.id);
        const lastMessage = convoMessages[convoMessages.length - 1];

        res.status(200).json({
          id: existingConvo.id,
          type: existingConvo.type,
          name: existingConvo.name,
          avatarUrl: existingConvo.avatarUrl,
          lastMessage: lastMessage ? lastMessage.encryptedContent : 'Connection established',
          lastMessageTime: lastMessage
            ? lastMessage.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          unreadCount: 0,
          members: detailedMembers,
        });
        return;
      }
    }
  }

  // Create new conversation
  const newConvoId = `conv_${Date.now()}`;
  const newConvo = {
    id: newConvoId,
    type: (type || 'direct') as 'direct' | 'group',
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
    id: `m_${newConvoId}_recipient`,
    conversationId: newConvoId,
    userId: recipient.id,
    joinedAt: new Date(),
    leftAt: null,
    muted: false,
  };
  conversationMembers.push(member1, member2);
  saveDb();

  const selfUser = users.find(u => u.id === currentUserId)!;
  const detailedMembers = [mapMemberPublic(selfUser), mapMemberPublic(recipient)];

  res.status(201).json({
    id: newConvo.id,
    type: newConvo.type,
    name: newConvo.name,
    avatarUrl: newConvo.avatarUrl,
    lastMessage: 'Say hi! 🔗 Secure connection established.',
    lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unreadCount: 0,
    members: detailedMembers,
  });
});

// GET /api/conversations/:id/messages — Get messages for a conversation
// Only allowed if the authenticated user is a member
router.get('/:id/messages', (req: AuthenticatedRequest, res: Response) => {
  const convoId = req.params.id;
  const currentUserId = req.currentUser!.dbId;

  const isMember = conversationMembers.some(
    m => m.conversationId === convoId && m.userId === currentUserId
  );
  if (!isMember) {
    res.status(403).json({ message: 'You are not a member of this conversation' });
    return;
  }

  const convoMessages = messages
    .filter(m => m.conversationId === convoId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const formatted = convoMessages.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.encryptedContent,
    isSelf: m.senderId === currentUserId,
    time: m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: m.createdAt.toISOString(),
    isRead: m.senderId === currentUserId ? true : m.createdAt.getTime() < Date.now() - 1000,
    isEdited: !!m.editedAt,
    isDeleted: !!m.deletedAt,
    isSystem: m.contentType === 'system',
    replyTo: m.replyTo,
    reactions: m.reactions || [],
    contentType: m.contentType || 'text',
    mediaUrl: m.mediaUrl,
    fileName: m.fileName,
    fileSize: m.fileSize,
    fileType: m.fileType,
    duration: m.duration,
    locationData: m.locationData,
    contactData: m.contactData,
    pollData: m.pollData,
    eventData: m.eventData,
  }));

  res.status(200).json(formatted);
});

// DELETE /api/conversations/:id — Delete a conversation (only if member)
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const convoId = req.params.id;
  const currentUserId = req.currentUser!.dbId;

  const isMember = conversationMembers.some(
    m => m.conversationId === convoId && m.userId === currentUserId
  );
  if (!isMember) {
    res.status(403).json({ message: 'Not a member of this conversation' });
    return;
  }

  const convoIdx = conversations.findIndex(c => c.id === convoId);
  if (convoIdx !== -1) conversations.splice(convoIdx, 1);

  for (let i = conversationMembers.length - 1; i >= 0; i--) {
    if (conversationMembers[i].conversationId === convoId) {
      conversationMembers.splice(i, 1);
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].conversationId === convoId) {
      messages.splice(i, 1);
    }
  }

  saveDb();
  res.status(200).json({ message: 'Conversation deleted' });
});

export default router;
