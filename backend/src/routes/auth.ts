import { Router, Request, Response } from 'express';
import { users } from '../store/db';

const router = Router();

// POST /api/auth/google — Login with Google token
router.post('/google', (_req: Request, res: Response) => {
  const selfUser = users.find(u => u.id === 'self');
  res.status(200).json({
    message: 'Authenticated successfully',
    token: 'mock-jwt-token-xyz',
    user: selfUser
  });
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
