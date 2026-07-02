import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { users, saveDb } from '../store/db';

const router = Router();

const getCurrentUserId = (req: Request): string => {
  const fromHeader = req.header('x-user-id');
  if (fromHeader) return fromHeader;
  return 'self';
};

// GET /api/users/debug — List all users in memory (temporary debug)
router.get('/debug', (_req: Request, res: Response) => {
  res.status(200).json(users.map(u => ({ id: u.id, uid: u.uid, email: u.email, displayName: u.displayName })));
});

// GET /api/users/me — Get current user profile
router.get('/me', (req: Request, res: Response) => {
  const currentUserId = getCurrentUserId(req);
  const selfUser = users.find(u => u.id === currentUserId);
  if (selfUser) {
    res.status(200).json(selfUser);
  } else {
    res.status(404).json({ message: 'User profile not found' });
  }
});

// PUT /api/users/me — Update profile
router.put('/me', (req: Request, res: Response) => {
  const currentUserId = getCurrentUserId(req);
  const selfUser = users.find(u => u.id === currentUserId);
  if (selfUser) {
        const { displayName, bio, status, avatarUrl, phone, email } = req.body;
        if (displayName) selfUser.displayName = displayName;
        if (bio) selfUser.bio = bio;
        if (status) selfUser.status = status;
        if (typeof avatarUrl === 'string') selfUser.avatarUrl = avatarUrl;
        if (typeof phone === 'string') (selfUser as any).phone = phone;
        if (typeof email === 'string') selfUser.email = email;
    selfUser.updatedAt = new Date();
    saveDb();
    res.status(200).json(selfUser);
  } else {
    res.status(404).json({ message: 'User profile not found' });
  }
});

// GET /api/users/me/uid — Get current user's UID
router.get('/me/uid', (req: Request, res: Response) => {
  const currentUserId = getCurrentUserId(req);
  const selfUser = users.find(u => u.id === currentUserId);
  if (selfUser) {
    res.status(200).json({ uid: selfUser.uid });
  } else {
    res.status(404).json({ message: 'UID not found' });
  }
});

// GET /api/users/me/qr — Get current user's QR code as PNG image
router.get('/me/qr', async (req: Request, res: Response) => {
  const currentUserId = getCurrentUserId(req);
  const selfUser = users.find(u => u.id === currentUserId);
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

// GET /api/users/by-uid/:uid — Get user by UID
router.get('/by-uid/:uid', (req: Request, res: Response) => {
  const targetUid = req.params.uid;
  const found = users.find(u => u.uid.toLowerCase() === targetUid.toLowerCase());
  if (found) {
    res.status(200).json(found);
  } else {
    res.status(404).json({ message: `User with Secure ID "${targetUid}" not found` });
  }
});

// GET /api/users/search?uid=uid_xxx — Search user by UID (query param)
router.get('/search', (req: Request, res: Response) => {
  const uid = String(req.query.uid || '').trim();
  if (!uid) {
    res.status(400).json({ message: 'uid query parameter required' });
    return;
  }

  const normalizedInput = uid.toLowerCase().trim();
  const withPrefix = normalizedInput.startsWith('sec_') ? normalizedInput : `sec_${normalizedInput}`;
  const withoutPrefix = normalizedInput.replace(/^sec_/, '');

  const found = users.find((u: any) => {
    const candidates = [u.uid, u.id, u.googleId, u.email]
      .filter(Boolean)
      .map((value: string) => String(value).toLowerCase().trim());

    return candidates.some((value: string) => {
      const normalizedValue = value.toLowerCase().trim();
      return normalizedValue === normalizedInput
        || normalizedValue === withPrefix
        || normalizedValue === withoutPrefix
        || normalizedValue.replace(/^sec_/, '') === withoutPrefix;
    });
  });

  if (found) {
    res.status(200).json({ id: found.id, displayName: found.displayName, avatar: found.avatarUrl, uid: found.uid, bio: found.bio, status: found.status });
  } else {
    res.status(404).json({ message: `No account found for this Secure ID. Please check the ID and try again.` });
  }
});

// GET /api/users/:id/public-key — Get user's public encryption key
router.get('/:id/public-key', (req: Request, res: Response) => {
  // Return dummy public key
  res.status(200).json({
    userId: req.params.id,
    publicKey: 'pk_x25519_mock_key_bytes_xyz_789'
  });
});

export default router;
