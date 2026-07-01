import { Router, Request, Response } from 'express';
import { users, saveDb } from '../store/db';

const router = Router();

// POST /api/auth/google — Login with Google profile payload
// For production, verify the token with Google. Here we accept a profile payload from frontend.
router.post('/google', (req: Request, res: Response) => {
  const { googleId, email, displayName, avatar, firebaseUid } = req.body as any;
  if (!googleId || !email) {
    res.status(400).json({ message: 'googleId and email required' });
    return;
  }

  const authUserId = firebaseUid || googleId;
  let user = users.find((u: any) => u.googleId === googleId || u.email === email || u.id === authUserId || u.uid === authUserId);
  let changed = false;
  if (!user) {
    const id = authUserId || `u_${Date.now()}`;
    const uid = `SEC_${id}`;
    user = {
      id,
      uid,
      email,
      phone: undefined,
      googleId,
      displayName: displayName || 'New User',
      avatarUrl: avatar || null,
      status: 'online',
      lastSeen: new Date(),
      bio: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as any;
    users.push(user as any);
    changed = true;
  } else {
    // Sync displayName / avatar if they changed
    if (displayName && user.displayName !== displayName) {
      user.displayName = displayName;
      changed = true;
    }
    if (avatar && user.avatarUrl !== avatar) {
      user.avatarUrl = avatar;
      changed = true;
    }
  }

  if (changed) {
    saveDb();
  }

  // Return mock token and user
  res.status(200).json({ user, token: 'mock-jwt-token' });
});

// POST /api/auth/refresh — Refresh access token
router.post('/refresh', (_req: Request, res: Response) => {
  res.status(200).json({
    token: 'mock-jwt-token-fresh-abc'
  });
});

// POST /api/auth/logout — Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
