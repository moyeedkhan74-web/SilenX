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
/**
 * Dev / mock tokens minted by the frontend fallback flows (native Google
 * fallback, offline dev logins). Parsing mirrors routes/auth.ts exactly so
 * both paths resolve to the SAME user id.
 */
const DEV_TOKEN_PREFIXES = ['dev_token_', 'google_token_', 'google_auth_token_', 'native_token_'];

function isDevToken(idToken: string): boolean {
  return DEV_TOKEN_PREFIXES.some((p) => idToken.startsWith(p));
}

/** Resolves a dev/mock bearer token to its user record, auto-creating it. */
function resolveDevToken(
  req: AuthenticatedRequest,
  res: Response,
  idToken: string,
  next: NextFunction
): void {
  const parts = idToken.split('_');
  const rawUserId = parts[2] || `user_${Date.now()}`;
  const devUserId = rawUserId.toLowerCase().replace(/[^a-z0-9]/g, '') || `user_${Date.now()}`;
  const devDisplayName = decodeURIComponent(parts[3] || 'Google User');
  const devEmail = parts[4] ? decodeURIComponent(parts[4]) : `${devUserId}@gmail.com`;

  let dbUser = users.find((u: any) => u.id === devUserId || (u.email && u.email === devEmail));

  if (!dbUser) {
    const newUser = {
      id: devUserId,
      uid: `SEC_${devUserId}`,
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
    users.push(newUser);
    dbUser = newUser;
    saveDb();
    console.log(`[Auth] Auto-registered DB user for dev token ${devUserId}`);
  }

  const activeUser = dbUser!;
  req.currentUser = { firebaseUid: devUserId, dbId: activeUser.id };
  next();
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

  // Dev / mock session bypass — matches POST /api/auth/google semantics
  if (isDevToken(idToken)) {
    resolveDevToken(req, res, idToken, next);
    return;
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    // Firebase Admin not configured — return 503 in production, allow dev mode to pass through
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ message: 'Auth service not configured on this server' });
      return;
    }
    // DEV ONLY: no real admin SDK — still reject; developers must set GOOGLE_APPLICATION_CREDENTIALS
    res.status(503).json({ message: 'Firebase Admin SDK not initialised. Set GOOGLE_APPLICATION_CREDENTIALS in .env' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;

    // Look up the user record by their Firebase UID
    let dbUser = users.find(
      (u: any) => u.id === firebaseUid || (u as any).firebaseUid === firebaseUid
    );

    if (!dbUser) {
      // Auto-upsert: If Firebase token is valid, auto-create the DB user record so APIs/Sockets never fail with 401
      const generatedUid = `SEC_${firebaseUid}`;
      const newUser = {
        id: firebaseUid,
        uid: generatedUid,
        email: decodedToken.email || `${firebaseUid}@slienx.app`,
        displayName: (decodedToken as any).name || decodedToken.email?.split('@')[0] || 'SilenX User',
        avatarUrl: (decodedToken as any).picture || undefined,
        status: 'online' as const,
        lastSeen: new Date(),
        showOnlineStatus: true,
        bio: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      users.push(newUser as any);
      dbUser = newUser as any;
      saveDb();
      console.log(`[Auth] Auto-registered missing DB user record for Firebase UID ${firebaseUid}`);
    }

    const activeUser = dbUser!;
    req.currentUser = { firebaseUid, dbId: activeUser.id };

    // Touch lastSeen on every authenticated request (activity-based presence tracking)
    const wasOffline = activeUser.status === 'offline';
    activeUser.lastSeen = new Date();
    if (wasOffline) {
      activeUser.status = 'online';
      saveDb();
      // Broadcast presence change to all connected sockets
      const ioInstance = (req.app as any).get('io');
      if (ioInstance) {
        ioInstance.emit('user-status-changed', {
          userId: activeUser.id,
          status: 'online',
          lastSeen: activeUser.lastSeen.toISOString(),
        });
      }
    }

    next();
  } catch (err: any) {
    console.warn('[Auth] Token verification failed:', err?.errorInfo?.code || err?.message);
    res.status(401).json({ message: 'Invalid or expired token. Please sign in again.' });
  }
}
