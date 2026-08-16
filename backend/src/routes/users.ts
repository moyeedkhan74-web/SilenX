import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { users, conversations, conversationMembers, messages, saveDb } from '../store/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All routes require a verified Firebase ID token
router.use(requireAuth as any);

// GET /api/users/debug — disabled in production; returns minimal safe info in dev
router.get('/debug', (req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ message: 'Debug endpoint disabled in production' });
    return;
  }
  // Only returns non-sensitive fields; never exposes tokens, passwords, or raw IDs
  res.status(200).json(
    users.map(u => ({ id: u.id, uid: u.uid, displayName: u.displayName }))
  );
});

// GET /api/users/me — Get current user profile
router.get('/me', (req: AuthenticatedRequest, res: Response) => {
  const selfUser = users.find(u => u.id === req.currentUser!.dbId);
  if (selfUser) {
    res.status(200).json(selfUser);
  } else {
    res.status(404).json({ message: 'User profile not found' });
  }
});

// PUT /api/users/me — Update profile
router.put('/me', (req: AuthenticatedRequest, res: Response) => {
  const selfUser = users.find(u => u.id === req.currentUser!.dbId);
  if (!selfUser) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  const { displayName, bio, status, avatarUrl, phone, showOnlineStatus } = req.body;
  // Note: email changes are intentionally ignored; email comes from the verified token.
  if (displayName) selfUser.displayName = displayName;
  if (bio !== undefined) selfUser.bio = bio;
  if (status) selfUser.status = status;
  if (typeof avatarUrl === 'string') selfUser.avatarUrl = avatarUrl;
  if (typeof phone === 'string') (selfUser as any).phone = phone;

  const prevShowOnlineStatus = (selfUser as any).showOnlineStatus;
  if (typeof showOnlineStatus === 'boolean') {
    (selfUser as any).showOnlineStatus = showOnlineStatus;
  }

  selfUser.updatedAt = new Date();
  saveDb();

  // If showOnlineStatus changed, broadcast presence update so others see the correct status
  if (typeof showOnlineStatus === 'boolean' && showOnlineStatus !== prevShowOnlineStatus) {
    const ioInstance = (req.app as any).get('io');
    if (ioInstance) {
      // If disabling, broadcast offline to hide presence. If enabling, re-broadcast real status.
      ioInstance.emit('user-status-changed', {
        userId: selfUser.id,
        status: showOnlineStatus ? selfUser.status : 'offline',
        lastSeen: showOnlineStatus ? selfUser.lastSeen.toISOString() : null,
      });
    }
  }

  res.status(200).json(selfUser);
});

// DELETE /api/users/me — Delete current user's account
router.delete('/me', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const userIndex = users.findIndex((u: any) => u.id === currentUserId);

  if (userIndex === -1) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  for (let i = conversationMembers.length - 1; i >= 0; i--) {
    if (conversationMembers[i].userId === currentUserId) {
      conversationMembers.splice(i, 1);
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderId === currentUserId) {
      messages.splice(i, 1);
    }
  }

  const remainingConversationIds = new Set(conversationMembers.map((member) => member.conversationId));
  for (let i = conversations.length - 1; i >= 0; i--) {
    if (!remainingConversationIds.has(conversations[i].id)) {
      conversations.splice(i, 1);
    }
  }

  users.splice(userIndex, 1);
  saveDb();
  res.status(200).json({ message: 'Account deleted' });
});

// GET /api/users/me/uid — Get current user's Secure UID
router.get('/me/uid', (req: AuthenticatedRequest, res: Response) => {
  const selfUser = users.find(u => u.id === req.currentUser!.dbId);
  if (selfUser) {
    res.status(200).json({ uid: selfUser.uid });
  } else {
    res.status(404).json({ message: 'UID not found' });
  }
});

// GET /api/users/me/qr — Get current user's QR code
router.get('/me/qr', async (req: AuthenticatedRequest, res: Response) => {
  const selfUser = users.find(u => u.id === req.currentUser!.dbId);
  if (!selfUser) {
    res.status(404).json({ message: 'QR not found' });
    return;
  }

  try {
    const deepLink = `slienx://uid/${selfUser.uid}`;
    const qrBuffer = await QRCode.toBuffer(deepLink, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#212121', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${selfUser.uid}_qr.png"`);
    res.send(qrBuffer);
  } catch (err) {
    console.error('QR generation failed:', err);
    res.status(500).json({ message: 'Failed to generate QR code' });
  }
});

// GET /api/users/by-uid/:uid — Lookup user's public profile by Secure UID
router.get('/by-uid/:uid', (req: AuthenticatedRequest, res: Response) => {
  const targetUid = req.params.uid;
  const found = users.find(u => u.uid.toLowerCase() === targetUid.toLowerCase());
  if (found) {
    // Only return public fields
    res.status(200).json({
      id: found.id,
      uid: found.uid,
      displayName: found.displayName,
      avatarUrl: found.avatarUrl,
      status: found.status,
      bio: found.bio,
    });
  } else {
    res.status(404).json({ message: `User with Secure ID "${targetUid}" not found` });
  }
});

// GET /api/users/search?uid=xxx — Search user by Secure UID
router.get('/search', (req: AuthenticatedRequest, res: Response) => {
  const uid = String(req.query.uid || '').trim();
  if (!uid) {
    res.status(400).json({ message: 'uid query parameter required' });
    return;
  }

  const normalizedInput = uid.toLowerCase().trim();
  const withPrefix = normalizedInput.startsWith('sec_') ? normalizedInput : `sec_${normalizedInput}`;
  const withoutPrefix = normalizedInput.replace(/^sec_/, '');

  const found = users.find((u: any) => {
    const candidates = [u.uid, u.id]
      .filter(Boolean)
      .map((value: string) => String(value).toLowerCase().trim());

    return candidates.some((value: string) => {
      const normalizedValue = value.toLowerCase().trim();
      return (
        normalizedValue === normalizedInput ||
        normalizedValue === withPrefix ||
        normalizedValue === withoutPrefix ||
        normalizedValue.replace(/^sec_/, '') === withoutPrefix
      );
    });
  });

  if (found) {
    res.status(200).json({
      id: found.id,
      displayName: found.displayName,
      avatar: found.avatarUrl,
      uid: found.uid,
      bio: found.bio,
      status: found.status,
    });
  } else {
    res.status(404).json({ message: 'No account found for this Secure ID. Please check the ID and try again.' });
  }
});

// GET /api/users/:id/public-key — Get user's public encryption key
router.get('/:id/public-key', (req: AuthenticatedRequest, res: Response) => {
  const targetUser = users.find(u => u.id === req.params.id);
  if (!targetUser) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.status(200).json({
    userId: req.params.id,
    publicKey: targetUser.publicKey || null,
  });
});

// PUT /api/users/public-key — Upload current user's public encryption key
router.put('/public-key', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { publicKey } = req.body;

  if (!publicKey || typeof publicKey !== 'string') {
    res.status(400).json({ message: 'publicKey is required and must be a string' });
    return;
  }

  const selfUser = users.find(u => u.id === currentUserId);
  if (!selfUser) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  selfUser.publicKey = publicKey;
  selfUser.updatedAt = new Date();
  saveDb();

  res.status(200).json({ message: 'Public key updated successfully', publicKey });
});

// POST /api/users/fcm-token — Register FCM device token for authenticated user
router.post('/fcm-token', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'FCM token is required and must be a string' });
    return;
  }

  const selfUser = users.find(u => u.id === currentUserId);
  if (!selfUser) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  // Avoid duplicates
  if (!selfUser.fcmTokens) {
    selfUser.fcmTokens = [];
  }

  if (!selfUser.fcmTokens.includes(token)) {
    selfUser.fcmTokens.push(token);
    selfUser.updatedAt = new Date();
    saveDb();
  }

  res.status(200).json({ message: 'FCM token registered successfully', tokens: selfUser.fcmTokens });
});

// DELETE /api/users/fcm-token — Remove FCM token on user logout
router.delete('/fcm-token', (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.currentUser!.dbId;
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'FCM token is required and must be a string' });
    return;
  }

  const selfUser = users.find(u => u.id === currentUserId);
  if (!selfUser) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  if (selfUser.fcmTokens) {
    selfUser.fcmTokens = selfUser.fcmTokens.filter(t => t !== token);
    selfUser.updatedAt = new Date();
    saveDb();
  }

  res.status(200).json({ message: 'FCM token removed successfully', tokens: selfUser.fcmTokens });
});

export default router;
