import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Environment variables for Cloud Storage (Backblaze B2 / AWS S3)
const S3_ENDPOINT = process.env.B2_ENDPOINT || process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.B2_REGION || process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.B2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'silenx-media-uploads';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;

  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    console.warn('[StorageService] B2/S3 credentials not configured. Falling back to local disk storage.');
    return null;
  }

  try {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT ? S3_ENDPOINT : undefined,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Necessary for Backblaze B2 compatibility
    });
    console.log('[StorageService] Cloud Storage (S3/B2) initialized successfully');
    return s3Client;
  } catch (error) {
    console.error('[StorageService] Failed to initialize S3 client:', error);
    return null;
  }
}

export interface UploadResult {
  url: string;
  key: string;
  isCloud: boolean;
}

const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY || 'public_IujRu9A06L5SrEXi0OvOaaozWuQ=';
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY || 'private_3WVFgKPJXY8uLyJmNN8rezJoYx8=';
const IMAGEKIT_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/silenx';

/**
 * Generate temporary ImageKit auth parameters for direct client uploads
 */
export function getImageKitAuthParameters() {
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 1800; // valid for 30 minutes
  const signature = crypto
    .createHmac('sha1', IMAGEKIT_PRIVATE_KEY)
    .update(token + expire)
    .digest('hex');

  return {
    token,
    expire,
    signature,
    publicKey: IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  };
}

/**
 * Upload file buffer directly to ImageKit CDN via REST API
 */
export async function uploadToImageKit(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType?: string
): Promise<{ url: string; key: string } | null> {
  if (!IMAGEKIT_PRIVATE_KEY) return null;

  try {
    const ext = path.extname(originalFilename) || '.bin';
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}${ext}`;
    const base64File = mimeType
      ? `data:${mimeType};base64,${fileBuffer.toString('base64')}`
      : fileBuffer.toString('base64');

    const authHeader = 'Basic ' + Buffer.from(`${IMAGEKIT_PRIVATE_KEY}:`).toString('base64');

    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        file: base64File,
        fileName,
        folder: '/silenx/media',
        useUniqueFileName: true,
      }),
    });

    if (response.ok) {
      const data: any = await response.json();
      console.log('[ImageKit] Media uploaded successfully to global CDN:', data.url);
      return {
        url: data.url,
        key: data.filePath || data.name || fileName,
      };
    } else {
      const errText = await response.text();
      console.error('[ImageKit] API upload failed:', response.status, errText);
    }
  } catch (err) {
    console.error('[ImageKit] Upload exception:', err);
  }
  return null;
}

/**
 * Upload file buffer to ImageKit CDN (primary), S3/B2 (secondary), or local disk (fallback)
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<UploadResult> {
  const ext = path.extname(originalFilename) || '.bin';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const key = `media/${year}/${month}/${uuid}${ext}`;

  // Strategy 1: Try ImageKit CDN Upload (Primary - 20GB free, auto WebP compression)
  try {
    const ikResult = await uploadToImageKit(fileBuffer, originalFilename, mimeType);
    if (ikResult) {
      return {
        url: ikResult.url,
        key: ikResult.key,
        isCloud: true,
      };
    }
  } catch (ikErr) {
    console.warn('[StorageService] ImageKit upload attempt failed, falling back to S3/B2:', ikErr);
  }

  // Strategy 2: Try Cloud Storage (S3/Backblaze B2)
  const client = getS3Client();
  if (client) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await client.send(command);

      const publicUrl = S3_ENDPOINT
        ? `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`
        : `https://${BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${key}`;

      return {
        url: publicUrl,
        key,
        isCloud: true,
      };
    } catch (error) {
      console.error('[StorageService] Cloud upload failed, using local disk fallback:', error);
    }
  }

  // Local fallback storage
  let uploadsDir = path.join(process.cwd(), 'uploads', 'media', `${year}`, `${month}`);
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch {
    uploadsDir = path.join(os.tmpdir(), 'silenx-uploads', 'media', `${year}`, `${month}`);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  const localFilePath = path.join(uploadsDir, `${uuid}${ext}`);
  fs.writeFileSync(localFilePath, fileBuffer);

  const localUrl = `/uploads/media/${year}/${month}/${uuid}${ext}`;
  return {
    url: localUrl,
    key,
    isCloud: false,
  };
}

/**
 * Generate temporary presigned download URL for sensitive media attachments
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error('[StorageService] Error generating presigned URL:', error);
    return null;
  }
}
