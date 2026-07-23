import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import type { Group } from '../types';
import { groups, groupMembers, groupInvites, messages, users, conversations, conversationMembers, saveDb } from '../store/db';

const router = Router();
router.use(requireAuth as any);

function mapPublicUser(user: typeof users[number]) {
  return {
    id: user.id,
    uid: user.uid,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    email: user.email,
    bio: user.bio,
  };
}

function getGroupMemberRole(groupId: string, userId: string) {
  const membership = groupMembers.find((m) => m.groupId === groupId && m.userId === userId);
  return membership?.role || null;
}

function ensureGroupConversation(group: typeof groups[number]) {
  let conversation = conversations.find((c) => c.groupId === group.id);
  if (!conversation) {
    const createdAt = new Date();
    conversation = {
      id: `conv_group_${group.id}`,
      type: 'group',
      name: group.name,
      avatarUrl: group.avatarUrl || null,
      createdBy: group.createdBy,
      createdAt,
      updatedAt: createdAt,
      groupId: group.id,
    };
    conversations.push(conversation);

    group.members.forEach((memberId, idx) => {
      conversationMembers.push({
        id: `m_${conversation!.id}_${memberId}_${idx}`,
        conversationId: conversation!.id,
        userId: memberId,
        joinedAt: createdAt,
        leftAt: null,
        muted: false,
      });
    });
    saveDb();
  }
  return conversation;
}

// GET /api/groups
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const userGroups = groups.filter((g) => g.members.includes(currentUserId));

  const payload = userGroups.map((group) => {
    const conversation = ensureGroupConversation(group);
    const groupMessages = messages
      .filter((m) => m.groupId === group.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const lastMessage = groupMessages[groupMessages.length - 1];

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      conversationId: conversation.id,
      createdBy: group.createdBy,
      members: group.members.length,
      admins: group.admins.length,
      lastMessage: lastMessage ? lastMessage.encryptedContent : 'Group ready',
      lastMessageTime: lastMessage ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      settings: group.settings,
    };
  });

  res.status(200).json(payload);
});

// POST /api/groups
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { name, description, avatarUrl, members = [] } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ message: 'Group name is required' });
    return;
  }

  const normalizedMembers = Array.from(new Set([currentUserId, ...members.filter((id: string) => id && id !== currentUserId)]));
  const groupId = `grp_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date();

  const group: Group = {
    id: groupId,
    name,
    description: description || '',
    avatarUrl: avatarUrl || null,
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    members: normalizedMembers,
    admins: [currentUserId],
    settings: {
      whoCanSendMessages: 'all',
      whoCanAddMembers: 'admins',
      muted: false,
    },
  };

  groups.push(group);
  normalizedMembers.forEach((memberId: string, idx: number) => {
    groupMembers.push({
      id: `gm_${groupId}_${memberId}`,
      groupId,
      userId: memberId,
      role: memberId === currentUserId ? 'owner' : 'member',
      joinedAt: now,
      mutedUntil: null,
      lastReadMessageId: null,
    });
    const existingConversationMember = conversationMembers.find((m) => m.conversationId === `conv_group_${groupId}` && m.userId === memberId);
    if (!existingConversationMember) {
      conversationMembers.push({
        id: `m_conv_group_${groupId}_${memberId}_${idx}`,
        conversationId: `conv_group_${groupId}`,
        userId: memberId,
        joinedAt: now,
        leftAt: null,
        muted: false,
      });
    }
  });

  if (!conversations.find((c) => c.groupId === groupId)) {
    conversations.push({
      id: `conv_group_${groupId}`,
      type: 'group',
      name,
      avatarUrl: avatarUrl || null,
      createdBy: currentUserId,
      createdAt: now,
      updatedAt: now,
      groupId,
    });
  }

  saveDb();
  res.status(201).json({
    ...group,
    conversationId: `conv_group_${groupId}`,
    membersList: normalizedMembers.map((memberId: string) => mapPublicUser(users.find((u) => u.id === memberId)!)).filter(Boolean),
  });
});

// GET /api/groups/:groupId
router.get('/:groupId', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const group = groups.find((g) => g.id === req.params.groupId);

  if (!group || !group.members.includes(currentUserId)) {
    res.status(404).json({ message: 'Group not found or access denied' });
    return;
  }

  const members = groupMembers
    .filter((m) => m.groupId === group.id)
    .map((m) => {
      const user = users.find((u) => u.id === m.userId);
      return {
        ...m,
        user: user ? mapPublicUser(user) : null,
      };
    });

  res.status(200).json({ group, members, conversationId: ensureGroupConversation(group).id });
});

// PUT /api/groups/:groupId
router.put('/:groupId', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { name, description, avatarUrl } = req.body;
  const group = groups.find((g) => g.id === req.params.groupId);

  if (!group) {
    res.status(404).json({ message: 'Group not found' });
    return;
  }

  // Check if current user is an admin, owner, or creator of the group
  const isCreatorOrAdmin = group.createdBy === currentUserId || group.admins.includes(currentUserId);
  if (!isCreatorOrAdmin) {
    res.status(403).json({ message: 'Only admins or the creator can update group details' });
    return;
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Group name must be a non-empty string' });
      return;
    }
    group.name = name.trim();
  }

  if (description !== undefined) {
    group.description = String(description || '').trim();
  }

  if (avatarUrl !== undefined) {
    group.avatarUrl = avatarUrl || null;
  }

  group.updatedAt = new Date();

  // Also update parent conversation's name and avatarUrl
  const conversation = conversations.find((c) => c.groupId === group.id);
  if (conversation) {
    if (name !== undefined) conversation.name = group.name;
    if (avatarUrl !== undefined) conversation.avatarUrl = group.avatarUrl;
    conversation.updatedAt = new Date();
  }

  saveDb();

  // Broadcast group update event to all connected sockets
  const ioInstance = (req.app as any).get('io');
  if (ioInstance) {
    ioInstance.emit('group-updated', {
      groupId: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
    });
  }

  res.status(200).json(group);
});

// POST /api/groups/:groupId/invite
router.post('/:groupId/invite', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const group = groups.find((g) => g.id === req.params.groupId);
  if (!group) {
    res.status(404).json({ message: 'Group not found' });
    return;
  }

  const role = getGroupMemberRole(group.id, currentUserId);
  if (role !== 'owner' && role !== 'admin') {
    res.status(403).json({ message: 'Only admins can create invite links' });
    return;
  }

  const code = randomUUID().slice(0, 12);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const invite = {
    id: `invite_${Date.now()}`,
    groupId: group.id,
    code,
    createdBy: currentUserId,
    createdAt: new Date(),
    expiresAt,
    joinApprovalRequired: !!req.body.joinApprovalRequired,
    active: true,
  };

  groupInvites.push(invite);
  saveDb();
  res.status(201).json({ inviteCode: code, expiresAt: invite.expiresAt.toISOString() });
});

// POST /api/groups/join
router.post('/join', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { inviteCode } = req.body;
  const invite = groupInvites.find((x) => x.code === inviteCode && x.active && new Date(x.expiresAt).getTime() > Date.now());

  if (!invite) {
    res.status(404).json({ message: 'Invite expired or invalid' });
    return;
  }

  const group = groups.find((g) => g.id === invite.groupId);
  if (!group) {
    res.status(404).json({ message: 'Group not found' });
    return;
  }

  if (group.members.includes(currentUserId)) {
    res.status(200).json({ message: 'Already a member', groupId: group.id });
    return;
  }

  group.members.push(currentUserId);
  groupMembers.push({
    id: `gm_${group.id}_${currentUserId}`,
    groupId: group.id,
    userId: currentUserId,
    role: 'member',
    joinedAt: new Date(),
    mutedUntil: null,
    lastReadMessageId: null,
  });

  const conversation = ensureGroupConversation(group);
  conversationMembers.push({
    id: `m_${conversation.id}_${currentUserId}_${Date.now()}`,
    conversationId: conversation.id,
    userId: currentUserId,
    joinedAt: new Date(),
    leftAt: null,
    muted: false,
  });
  saveDb();

  res.status(200).json({ message: 'Joined group', groupId: group.id });
});

export default router;
