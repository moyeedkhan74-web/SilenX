import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadFile, getPresignedDownloadUrl } from '../services/storageService';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  },
});

/**
 * POST /api/media/upload
 * Handles media uploads for attachments, avatars, and voice notes.
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const result = await uploadFile(buffer, originalname, mimetype);

    return res.status(200).json({
      success: true,
      url: result.url,
      key: result.key,
      isCloud: result.isCloud,
      fileName: originalname,
      fileSize: req.file.size,
      mimeType: mimetype,
    });
  } catch (error: any) {
    console.error('[MediaRoute] Error uploading media file:', error);
    return res.status(500).json({ error: 'Failed to upload media file' });
  }
});

/**
 * GET /api/media/presigned-url?key=...
 * Generates a presigned URL for secure download.
 */
router.get('/presigned-url', async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    const presignedUrl = await getPresignedDownloadUrl(key);
    if (!presignedUrl) {
      return res.status(404).json({ error: 'Presigned URL not available' });
    }

    return res.status(200).json({ url: presignedUrl });
  } catch (error: any) {
    console.error('[MediaRoute] Error generating presigned URL:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
