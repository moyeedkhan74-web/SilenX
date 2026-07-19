import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth as any);

// GET /api/calls/history — Get call history
router.get('/history', (_req: AuthenticatedRequest, res: Response) => {
  res.status(501).json({ message: 'Not yet implemented' });
});

// POST /api/calls/:id/end — Record call end time
router.post('/:id/end', (_req: AuthenticatedRequest, res: Response) => {
  res.status(501).json({ message: 'Not yet implemented' });
});

export default router;
