// src/utils/validateFile.ts
import { MediaConfig } from '../config/mediaConfig';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Sanitize a file name: remove path separators, limit length, and ensure it's not empty.
 */
export function sanitizeFileName(name: string): string {
  // Remove any path separators
  const sanitized = name.replace(/[\\\/]/g, '');
  // Limit length to 255 bytes (common filesystem limit)
  const truncated = sanitized.slice(0, 255);
  // Ensure it's not empty and has an extension
  return truncated || 'unnamed';
}

/**
 * Get file extension from file name (lowercase, without dot).
 */
export function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Validate a File object.
 * Checks extension, MIME type, and size.
 * Also sanitizes the file name (though the File object's name is read-only, we return a suggestion).
 */
export function validateFile(file: File): ValidationResult {
  const ext = getFileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  // Determine kind based on extension and MIME
  let kind: 'image' | 'video' | 'document' | undefined;
  if (MediaConfig.allowedImageExtensions.includes(ext as any) && MediaConfig.allowedImageMimes.includes(mimeType as any)) {
    kind = 'image';
  } else if (MediaConfig.allowedVideoExtensions.includes(ext as any) && MediaConfig.allowedVideoMimes.includes(mimeType as any)) {
    kind = 'video';
  } else if (MediaConfig.allowedDocExtensions.includes(ext as any) && MediaConfig.allowedDocMimes.includes(mimeType as any)) {
    kind = 'document';
  }

  if (!kind) {
    return {
      ok: false,
      reason: `Unsupported file type: ${ext || mimeType}. Allowed: images (${MediaConfig.allowedImageExtensions.join(', ')}), videos (${MediaConfig.allowedVideoExtensions.join(', ')}), documents (${MediaConfig.allowedDocExtensions.join(', ')})`,
    };
  }

  // Check size
  let maxSizeBytes: number;
  switch (kind) {
    case 'image':
      maxSizeBytes = MediaConfig.maxImageSizeMB * 1024 * 1024;
      break;
    case 'video':
      maxSizeBytes = MediaConfig.maxVideoSizeMB * 1024 * 1024;
      break;
    case 'document':
      maxSizeBytes = MediaConfig.maxDocSizeMB * 1024 * 1024;
      break;
  }

  if (file.size > maxSizeBytes) {
    return {
      ok: false,
      reason: `File too large. Maximum size for ${kind}s is ${maxSizeBytes / (1024 * 1024)} MB`,
    };
  }

  // Additional MIME type validation (already done above by checking allowed arrays, but double-check)
  // We already checked that the extension and MIME are in the allowed lists for the kind.

  // Sanitize file name (just for reference; the File object's name cannot be changed)
  const sanitizedName = sanitizeFileName(file.name);

  return {
    ok: true,
    reason: undefined, // optional
    // We could return the sanitized name, but the interface doesn't have a field for it.
    // The caller can use sanitizeFileName(file.name) if needed.
  };
}

/**
 * Validate a file by its name and size (for checking before picking).
 * Useful for pre-validation.
 */
export function validateFileByNameAndSize(
  fileName: string,
  sizeBytes: number
): ValidationResult {
  const ext = getFileExtension(fileName);
  // We don't have MIME type here, so we rely on extension only.
  // This is less accurate but useful for UI pre-checks.
  let kind: 'image' | 'video' | 'document' | undefined;
  if (MediaConfig.allowedImageExtensions.includes(ext as any)) {
    kind = 'image';
  } else if (MediaConfig.allowedVideoExtensions.includes(ext as any)) {
    kind = 'video';
  } else if (MediaConfig.allowedDocExtensions.includes(ext as any)) {
    kind = 'document';
  }

  if (!kind) {
    return {
      ok: false,
      reason: `Unsupported file extension: ${ext}. Allowed: images (${MediaConfig.allowedImageExtensions.join(', ')}), videos (${MediaConfig.allowedVideoExtensions.join(', ')}), documents (${MediaConfig.allowedDocExtensions.join(', ')})`,
    };
  }

  let maxSizeBytes: number;
  switch (kind) {
    case 'image':
      maxSizeBytes = MediaConfig.maxImageSizeMB * 1024 * 1024;
      break;
    case 'video':
      maxSizeBytes = MediaConfig.maxVideoSizeMB * 1024 * 1024;
      break;
    case 'document':
      maxSizeBytes = MediaConfig.maxDocSizeMB * 1024 * 1024;
      break;
  }

  if (sizeBytes > maxSizeBytes) {
    return {
      ok: false,
      reason: `File too large. Maximum size for ${kind}s is ${maxSizeBytes / (1024 * 1024)} MB`,
    };
  }

  return { ok: true };
}