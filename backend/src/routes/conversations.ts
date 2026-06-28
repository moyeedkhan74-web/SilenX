import { Router, Request, Response } from 'express';
import { users, conversations, conversationMembers, messages } from '../store/db';

const router = Router();

// GET /api/conversations — List conversations
router.get('/', (_req: Request, res: Response) => {
  // Find conversations where user 'self' is a member
  const userConvos = conversations.filter(c => 
    conversationMembers.some(m => m.conversationId === c.id && m.userId === 'self')
  );

  const formatted = userConvos.map(c => {
    const memberRels = conversationMembers.filter(m => m.conversationId === c.id);
    const detailedMembers = memberRels
      .map(mr => users.find(u => u.id === mr.userId))
      .filter((u): u is typeof users[0] => !!u)
      .map(u => ({
        id: u.id,
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        lastSeen: u.status === 'offline' ? 'Recently' : '',
        bio: u.bio
      }));

    const convoMessages = messages
      .filter(m => m.conversationId === c.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const lastMessage = convoMessages[convoMessages.length - 1];

    return {
      id: c.id,
      type: c.type,
      name: c.name,
      avatarUrl: c.avatarUrl,
      lastMessage: lastMessage ? lastMessage.encryptedContent : 'Say hi! 🔗 Secure connection established.',
      lastMessageTime: lastMessage ? lastMessage.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount: 0,
      members: detailedMembers
    };
  });

  res.status(200).json(formatted);
});

// POST /api/conversations — Create new conversation (or return existing one)
router.post('/', (req: Request, res: Response) => {
  const { type, recipientUid } = req.body;

  if (!recipientUid) {
    res.status(400).json({ message: 'recipientUid is required' });
    return;
  }

  const recipient = users.find(u => u.uid.toLowerCase() === recipientUid.toLowerCase());
  if (!recipient) {
    res.status(404).json({ message: `User with Secure ID "${recipientUid}" not found` });
    return;
  }

  // Check if conversation already exists (direct chat only)
  if (type === 'direct') {
    const existingMemberRel = conversationMembers.find(m => 
      m.userId === recipient.id && 
      conversationMembers.some(selfM => selfM.conversationId === m.conversationId && selfM.userId === 'self')
    );

    if (existingMemberRel) {
      const existingConvo = conversations.find(c => c.id === existingMemberRel.conversationId);
      if (existingConvo) {
        // Return existing conversation logic
        const memberRels = conversationMembers.filter(m => m.conversationId === existingConvo.id);
        const detailedMembers = memberRels
          .map(mr => users.find(u => u.id === mr.userId))
          .filter((u): u is typeof users[0] => !!u)
          .map(u => ({
            id: u.id,
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            status: u.status,
            lastSeen: u.status === 'offline' ? 'Recently' : '',
            bio: u.bio
          }));

        const convoMessages = messages.filter(m => m.conversationId === existingConvo.id);
        const lastMessage = convoMessages[convoMessages.length - 1];

        res.status(200).json({
          id: existingConvo.id,
          type: existingConvo.type,
          name: existingConvo.name,
          avatarUrl: existingConvo.avatarUrl,
          lastMessage: lastMessage ? lastMessage.encryptedContent : 'Connection established',
          lastMessageTime: lastMessage ? lastMessage.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unreadCount: 0,
          members: detailedMembers
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
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  conversations.push(newConvo);

  // Link members
  const member1 = { id: `m_${newConvoId}_self`, conversationId: newConvoId, userId: 'self', joinedAt: new Date(), leftAt: null, muted: false };
  const member2 = { id: `m_${newConvoId}_recipient`, conversationId: newConvoId, userId: recipient.id, joinedAt: new Date(), leftAt: null, muted: false };
  conversationMembers.push(member1, member2);

  // Return new
  const detailedMembers = [
    { id: 'self', uid: 'SEC_8f7d6e5c4b3a', email: 'user@gmail.com', displayName: 'User', avatarUrl: null, status: 'online' as const, lastSeen: '', bio: "Hey there! I'm using SlienX." },
    { id: recipient.id, uid: recipient.uid, email: recipient.email, displayName: recipient.displayName, avatarUrl: recipient.avatarUrl, status: recipient.status, lastSeen: recipient.status === 'offline' ? 'Recently' : '', bio: recipient.bio }
  ];

  res.status(201).json({
    id: newConvo.id,
    type: newConvo.type,
    name: newConvo.name,
    avatarUrl: newConvo.avatarUrl,
    lastMessage: 'Say hi! 🔗 Secure connection established.',
    lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unreadCount: 0,
    members: detailedMembers
  });
});

// GET /api/conversations/:id/messages — Get messages for conversation
router.get('/:id/messages', (req: Request, res: Response) => {
  const convoId = req.params.id;
  const convoMessages = messages.filter(m => m.conversationId === convoId);

  // Format to match frontend Message shape
  const formatted = convoMessages.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.encryptedContent,
    isSelf: m.senderId === 'self',
    time: m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isRead: m.senderId === 'self' ? true : m.createdAt.getTime() < Date.now() - 1000,
    isEdited: !!m.editedAt,
    isDeleted: !!m.deletedAt
  }));

  res.status(200).json(formatted);
});

export default router;
