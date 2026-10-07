// src/config/mediaConfig.ts
export const MediaConfig = {
  // Max file sizes in MB
  maxImageSizeMB: 10,
  maxVideoSizeMB: 100,
  maxDocSizeMB: 50,

  // Allowed file extensions
  allowedImageExtensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'] as const,
  allowedVideoExtensions: ['mp4', 'mov', 'webm'] as const,
  allowedDocExtensions: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'zip',
  ] as const,

  // Allowed MIME types (must match extensions)
  allowedImageMimes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ] as const,
  allowedVideoMimes: [
    'video/mp4',
    'video/quicktime', // for .mov
    'video/webm',
  ] as const,
  allowedDocMimes: [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'text/plain', // .txt
    'application/zip', // .zip
  ] as const,

  // Image constraints
  imageMaxDimension: 1600,
  imageQuality: 0.75,
  thumbnailMaxDimension: 300,

  // Upload constraints
  maxParallelUploads: 3,
  maxFilesPerPick: 10,
  maxRetryAttempts: 3,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 10000,

  // Storage paths
  storage: {
    basePath: 'silenx_media',
    thumbnailsFolder: 'silenx_media/thumbnails',
  },

  // Image compression defaults
  imageCompression: {
    maxWidthOrHeight: 1600,
    initialQuality: 0.75,
    useWebWorker: true,
  },

  // Thumbnail defaults
  thumbnail: {
    maxWidth: 300,
    maxHeight: 300,
    maxWidthOrHeight: 300,
    quality: 0.7,
    initialQuality: 0.7,
    mimeType: 'image/jpeg',
  },
} as const;

export type ImageExtension = typeof MediaConfig.allowedImageExtensions[number];
export type VideoExtension = typeof MediaConfig.allowedVideoExtensions[number];
export type DocExtension = typeof MediaConfig.allowedDocExtensions[number];
export type ImageMime = typeof MediaConfig.allowedImageMimes[number];
export type VideoMime = typeof MediaConfig.allowedVideoMimes[number];
export type DocMime = typeof MediaConfig.allowedDocMimes[number];

export type MediaType = 'image' | 'video' | 'document';

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  status: 'pending' | 'uploading' | 'done' | 'failed' | 'cancelled';
  progress: number;
}

export interface UploadResult {
  id: string;
  storagePath: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
}