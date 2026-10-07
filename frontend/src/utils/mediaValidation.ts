/**
 * Media validation utilities for SilenX
 * Validates file type, size, and extension
 */

import { MediaConfig, MediaType } from '../config/mediaConfig';

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Check if file extension is allowed for given media type
 */
export function isAllowedExtension(filename: string, type: MediaType): boolean {
  const ext = getFileExtension(filename);

  switch (type) {
    case 'image':
      return (MediaConfig.allowedImageExtensions as readonly string[]).includes(ext);
    case 'video':
      return ['mp4', 'mov', 'webm'].includes(ext);
    case 'document':
      return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'].includes(ext);
    default:
      return false;
  }
}

/**
 * Check if MIME type is allowed for given media type
 */
export function isAllowedMimeType(mimeType: string, type: MediaType): boolean {
  switch (type) {
    case 'image':
      return (MediaConfig.allowedImageMimes as readonly string[]).includes(mimeType.toLowerCase());
    case 'video':
      return ['video/mp4', 'video/quicktime', 'video/webm'].includes(mimeType.toLowerCase());
    case 'document':
      return [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/zip',
      ].includes(mimeType.toLowerCase());
    default:
      return false;
  }
}

/**
 * Get media type from MIME type
 */
export function getMediaType(mimeType: string): MediaType | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType.startsWith('application/') ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/zip'
  ) {
    return 'document';
  }
  return null;
}

/**
 * Validate file size against max allowed size
 */
export function isValidSize(sizeBytes: number, type: MediaType): boolean {
  let maxBytes: number;

  switch (type) {
    case 'image':
      maxBytes = MediaConfig.maxImageSizeMB * 1024 * 1024;
      break;
    case 'video':
      maxBytes = MediaConfig.maxVideoSizeMB * 1024 * 1024;
      break;
    case 'document':
      maxBytes = MediaConfig.maxDocSizeMB * 1024 * 1024;
      break;
    default:
      maxBytes = 0;
  }

  return sizeBytes <= maxBytes;
}

/**
 * Get human readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  mediaType?: MediaType;
}

/**
 * Comprehensive file validation
 * Checks extension, MIME type, and size
 */
export function validateFile(file: File): ValidationResult {
  const ext = getFileExtension(file.name);
  const mimeType = file.type || `image/${ext}`;

  // Determine media type
  const mediaType = getMediaType(mimeType);
  if (!mediaType) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType || ext}`,
    };
  }

  // Check extension
  if (!isAllowedExtension(file.name, mediaType)) {
    return {
      valid: false,
      error: `Invalid file extension: .${ext}. Allowed: ${MediaConfig.allowedImageExtensions.join(', ')}`,
    };
  }

  // Check MIME type
  if (!isAllowedMimeType(mimeType, mediaType)) {
    return {
      valid: false,
      error: `Invalid MIME type: ${mimeType}`,
    };
  }

  // Check size
  if (!isValidSize(file.size, mediaType)) {
    const maxSize =
      mediaType === 'image'
        ? MediaConfig.maxImageSizeMB
        : mediaType === 'video'
          ? MediaConfig.maxVideoSizeMB
          : MediaConfig.maxDocSizeMB;

    return {
      valid: false,
      error: `File too large. Max size: ${maxSize} MB`,
    };
  }

  return {
    valid: true,
    mediaType,
  };
}
