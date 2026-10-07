import { ImageExtension, VideoExtension, DocExtension } from '../config/mediaConfig';

export type MediaKind = 'image' | 'video' | 'document';
export type MediaStatus = 'queued' | 'uploading' | 'paused' | 'done' | 'failed';

export interface MediaItem {
  id: string;
  ownerId: string;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  size: number; // in bytes
  storagePath: string; // e.g., uploads/{userId}/{year}/{uuid}.{ext}
  downloadUrl: string; // from Firebase Storage
  thumbnailUrl?: string; // for images and videos
  width?: number; // for images and videos
  height?: number; // for images and videos
  duration?: number; // for videos in seconds
  createdAt: number; // timestamp
  status: MediaStatus;
}

// Helper type for allowed file extensions
export type AllowedExtension =
  | ImageExtension
  | VideoExtension
  | DocExtension;