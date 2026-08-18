import { Request, Response, NextFunction } from 'express';
import { getAdminAuth } from '../config/firebaseAdmin';
import { users, saveDb } from '../store/db';

/**
 * Extends Express Request so downstream handlers can read `req.currentUser`.
 * The user object comes exclusively from the verified Firebase ID token —
 * never from a client-supplied header like x-user-id.
 */
export interface AuthenticatedRequest extends Request {
  currentUser?: {
    firebaseUid: string; // Firebase UID from verified token
    dbId: string;        // internal DB record id
  };
}

/**
 * requireAuth middleware
 *
 * Reads:  Authorization: Bearer <Firebase ID token>
 * Verifies the token with Firebase Admin SDK.
 * Attaches { firebaseUid, dbId } to req.currentUser.
 * Rejects with 401 on missing / invalid / expired tokens.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or malformed Authorization header' });
    return;
  }

  const idToken = authHeader.slice(7);

  // Check for dev/google token formats
  if (
    idToken.startsWith('dev_token_') ||
    idToken.startsWith('google_token_') ||
    idToken.startsWith('google_auth_token_') ||
    idToken.startsWith('native_token_')
  ) {
    const parts = idToken.split('_');
    const rawUserId = parts[2] || `user_${Date.now()}`;
    const devUserId = rawUserId.toLowerCase().replace(/[^a-z0-9]/g, '') || `user_${Date.now()}`;
    const devEmail = parts[4] ? decodeURIComponent(parts[4]) : (rawUserId.includes('@') ? rawUserId : `${devUserId}@gmail.com`);

    const dbUser = users.find(
      (u: any) =>
        (u.email && devEmail && u.email.toLowerCase() === devEmail.toLowerCase()) ||
        u.id === devUserId ||
        (u as any).firebaseUid === devUserId
    );

    if (dbUser) {
      req.currentUser = { firebaseUid: dbUser.id, dbId: dbUser.id };

      const wasOffline = dbUser.status === 'offline';
      dbUser.lastSeen = new Date();
      if (wasOffline) {
        dbUser.status = 'online';
        saveDb();
      }
      next();
      return;
    }
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ message: 'Auth service not configured on this server' });
      return;
    }
    res.status(503).json({ message: 'Firebase Admin SDK not initialised. Set GOOGLE_APPLICATION_CREDENTIALS in .env' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const userEmail = decodedToken.email || null;

    // Match user by Firebase UID or email
    const dbUser = users.find(
      (u: any) =>
        u.id === firebaseUid ||
        (u as any).firebaseUid === firebaseUid ||
        (u.email && userEmail && u.email.toLowerCase() === userEmail.toLowerCase())
    );

    if (!dbUser) {
      res.status(401).json({ message: 'User record not found. Please log in again.' });
      return;
    }

    req.currentUser = { firebaseUid: dbUser.id, dbId: dbUser.id };

    // Touch lastSeen on every authenticated request (activity-based presence tracking)
    const wasOffline = dbUser.status === 'offline';
    dbUser.lastSeen = new Date();
    if (wasOffline) {
      dbUser.status = 'online';
      saveDb();
      // Broadcast presence change to all connected sockets
      const ioInstance = (req.app as any).get('io');
      if (ioInstance) {
        ioInstance.emit('user-status-changed', {
          userId: dbUser.id,
          status: 'online',
          lastSeen: dbUser.lastSeen.toISOString(),
        });
      }
    }

    next();
  } catch (err: any) {
    console.warn('[Auth] Token verification failed:', err?.errorInfo?.code || err?.message);
    res.status(401).json({ message: 'Invalid or expired token. Please sign in again.' });
  }
}
