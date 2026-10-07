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
} as const;

export type ImageExtension = typeof MediaConfig.allowedImageExtensions[number];
export type VideoExtension = typeof MediaConfig.allowedVideoExtensions[number];
export type DocExtension = typeof MediaConfig.allowedDocExtensions[number];
export type ImageMime = typeof MediaConfig.allowedImageMimes[number];
export type VideoMime = typeof MediaConfig.allowedVideoMimes[number];
export type DocMime = typeof MediaConfig.allowedDocMimes[number];