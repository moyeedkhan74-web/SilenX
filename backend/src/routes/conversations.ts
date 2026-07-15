import { Router, Request, Response } from 'express';
import { users, conversations, conversationMembers, messages, saveDb } from '../store/db';

const router = Router();

const getCurrentUserId = (req: Request): string => {
  const fromHeader = req.header('x-user-id');
  if (!fromHeader) return 'self';

  const existingUser = users.find((u: any) => u.id === fromHeader || u.uid === fromHeader || u.email === fromHeader);
  return existingUser ? existingUser.id : 'self';
};

// GET /api/conversations — List conversations
router.get('/', (req: Request, res: Response) => {
  const currentUserId = getCurrentUserId(req);
  // Find conversations where user currentUserId is a member
  const userConvos = conversations.filter(c => 
    conversationMembers.some(m => m.conversationId === c.id && m.userId === currentUserId)
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

  const currentUserId = getCurrentUserId(req);

  // Check if conversation already exists (direct chat only)
  if (type === 'direct') {
    const existingMemberRel = conversationMembers.find(m => 
      m.userId === recipient.id && 
      conversationMembers.some(selfM => selfM.conversationId === m.conversationId && selfM.userId === currentUserId)
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
    createdBy: currentUserId,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  conversations.push(newConvo);

  // Link members
  const member1 = { id: `m_${newConvoId}_self`, conversationId: newConvoId, userId: currentUserId, joinedAt: new Date(), leftAt: null, muted: false };
  const member2 = { id: `m_${newConvoId}_recipient`, conversationId: newConvoId, userId: recipient.id, joinedAt: new Date(), leftAt: null, muted: false };
  conversationMembers.push(member1, member2);

  // Save changes
  saveDb();

  // Return new
  const selfUser = users.find(u => u.id === currentUserId) || { id: 'self', uid: 'SEC_8f7d6e5c4b3a', email: 'user@gmail.com', displayName: 'User', avatarUrl: null, status: 'online' as const, lastSeen: '', bio: "Hey there! I'm using SlienX." };
  const detailedMembers = [
    { id: selfUser.id, uid: selfUser.uid, email: selfUser.email, displayName: selfUser.displayName, avatarUrl: selfUser.avatarUrl, status: selfUser.status, lastSeen: '', bio: selfUser.bio },
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
  const currentUserId = getCurrentUserId(req);
  const formatted = convoMessages.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.encryptedContent,
    isSelf: m.senderId === currentUserId,
    time: m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isRead: m.senderId === currentUserId ? true : m.createdAt.getTime() < Date.now() - 1000,
    isEdited: !!m.editedAt,
    isDeleted: !!m.deletedAt,
    isSystem: m.contentType === 'system'
  }));

  res.status(200).json(formatted);
});

// DELETE /api/conversations/:id — Delete a conversation
router.delete('/:id', (req: Request, res: Response) => {
  const convoId = req.params.id;
  const currentUserId = getCurrentUserId(req);

  // Verify user is a member
  const isMember = conversationMembers.some(
    m => m.conversationId === convoId && m.userId === currentUserId
  );
  if (!isMember) {
    res.status(403).json({ message: 'Not a member of this conversation' });
    return;
  }

  // Remove conversation
  const convoIdx = conversations.findIndex(c => c.id === convoId);
  if (convoIdx !== -1) conversations.splice(convoIdx, 1);

  // Remove members
  for (let i = conversationMembers.length - 1; i >= 0; i--) {
    if (conversationMembers[i].conversationId === convoId) {
      conversationMembers.splice(i, 1);
    }
  }

  // Remove messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].conversationId === convoId) {
      messages.splice(i, 1);
    }
  }

  saveDb();
  res.status(200).json({ message: 'Conversation deleted' });
});

export default router;
