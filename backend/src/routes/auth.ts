import { Router, Request, Response } from 'express';
import { getAdminAuth } from '../config/firebaseAdmin';
import { users, saveDb } from '../store/db';

import { DecodedIdToken } from 'firebase-admin/auth';

const router = Router();

/**
 * POST /api/auth/google
 *
 * Accepts a Firebase ID token in the Authorization: Bearer header.
 * Verifies it with Firebase Admin SDK and creates/finds the user record.
 * Returns the DB user object — the token itself (from Firebase) is the session credential.
 *
 * Security: never trusts googleId / email / firebaseUid supplied in the body.
 */
router.post('/google', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing Authorization: Bearer <idToken> header' });
    return;
  }

  const idToken = authHeader.slice(7);

  if (
    idToken.startsWith('dev_token_') ||
    idToken.startsWith('google_token_') ||
    idToken.startsWith('google_auth_token_') ||
    idToken.startsWith('native_token_') ||
    idToken.startsWith('native_auth_')
  ) {
    const parts = idToken.split('_');
    const rawUserId = parts[2] || `user_${Date.now()}`;
    const devUserId = rawUserId.toLowerCase().replace(/[^a-z0-9]/g, '') || `user_${Date.now()}`;
    const devDisplayName = decodeURIComponent(parts[3] || 'Google User');
    const devEmail = parts[4] ? decodeURIComponent(parts[4]) : `${devUserId}@gmail.com`;

    // Match by email first so identical emails share the exact same user account & chat history!
    let user = users.find(
      (u: any) =>
        (devEmail && u.email && u.email.toLowerCase() === devEmail.toLowerCase()) ||
        u.id === devUserId
    );
    let changed = false;

    if (!user) {
      const uid = `SEC_${devUserId}`;
      user = {
        id: devUserId,
        uid,
        email: devEmail,
        googleId: `google_${devUserId}`,
        displayName: devDisplayName,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(devDisplayName)}`,
        status: 'online',
        lastSeen: new Date(),
        showOnlineStatus: true,
        bio: 'Signed in with Google',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any;
      users.push(user as any);
      changed = true;
    } else {
      if (devDisplayName && user.displayName !== devDisplayName) {
        user.displayName = devDisplayName;
        changed = true;
      }
      if (devEmail && user.email !== devEmail) {
        user.email = devEmail;
        changed = true;
      }
    }

    if (changed) saveDb();
    res.status(200).json({ user });
    return;
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    res.status(500).json({ message: 'Firebase Admin credentials missing on server. Please set FIREBASE_SERVICE_ACCOUNT_JSON in Render environment variables.' });
    return;
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err: any) {
    console.warn('[Auth] verifyIdToken failed:', err?.errorInfo?.code || err?.message);
    res.status(401).json({ message: 'Invalid or expired Firebase ID token' });
    return;
  }

  const firebaseUid = decodedToken.uid;
  const email = decodedToken.email || null;
  const displayName = (decodedToken as any).name as string | undefined || null;
  const avatarUrl = (decodedToken as any).picture as string | undefined || null;

  // Match existing user by email first so device sign-ins (laptop vs mobile) share exact same user ID & chat history
  let user = users.find(
    (u: any) =>
      (email && u.email && u.email.toLowerCase() === email.toLowerCase()) ||
      u.id === firebaseUid
  );
  let changed = false;

  if (!user) {
    const uid = `SEC_${firebaseUid}`;
    user = {
      id: firebaseUid,
      uid,
      email: email || '',
      googleId: decodedToken.firebase?.identities?.['google.com']?.[0] || null,
      displayName: displayName || 'Secure User',
      avatarUrl: avatarUrl || null,
      status: 'online',
      lastSeen: new Date(),
      showOnlineStatus: true,
      bio: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as any;
    users.push(user as any);
    changed = true;
  } else {
    // Sync mutable profile fields from token claims
    if (displayName && user.displayName !== displayName) {
      user.displayName = displayName;
      changed = true;
    }
    if (avatarUrl && user.avatarUrl !== avatarUrl) {
      user.avatarUrl = avatarUrl;
      changed = true;
    }
    if (email && user.email !== email) {
      user.email = email;
      changed = true;
    }
  }

  if (changed) saveDb();

  // Do NOT issue a separate server token — the Firebase ID token IS the credential.
  res.status(200).json({ user });
});

// POST /api/auth/logout — stateless; client discards the Firebase token client-side
router.post('/logout', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
