import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/calls/history — Get call history
router.get('/history', (_req: Request, res: Response) => {
  res.status(501).json({ message: 'Not yet implemented' });
});

// POST /api/calls/:id/end — Record call end time
router.post('/:id/end', (_req: Request, res: Response) => {
  res.status(501).json({ message: 'Not yet implemented' });
});

export default router;
