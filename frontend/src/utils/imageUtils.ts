// src/utils/imageUtils.ts
// Browser canvas-based image utilities for compression and thumbnails
// No native dependencies - works in Capacitor WebView

import { MediaConfig } from '../config/mediaConfig';

/**
 * Get image dimensions from a Blob.
 * Returns { width, height }.
 */
export async function getImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(objectUrl);
      img.remove();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for dimension check'));
    };

    img.src = objectUrl;
  });
}

/**
 * Fix EXIF rotation and compress an image.
 * Resizes so the longest side is <= 1600px, JPEG quality 0.75.
 * If sendOriginal is true, skips compression and returns the original blob.
 */
export async function compressImage(
  blob: Blob,
  sendOriginal: boolean = false
): Promise<{ blob: Blob; width: number; height: number }> {
  // If sendOriginal, return the blob as-is
  if (sendOriginal) {
    const dims = await getImageSize(blob);
    return { blob, width: dims.width, height: dims.height };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        const maxDim = MediaConfig.imageMaxDimension;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Enable image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the image (browser handles EXIF rotation automatically in most cases)
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (compressedBlob) => {
            if (!compressedBlob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            URL.revokeObjectURL(objectUrl);
            img.remove();
            canvas.remove();

            resolve({ blob: compressedBlob, width, height });
          },
          'image/jpeg',
          MediaConfig.imageQuality
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}

/**
 * Make a thumbnail from an image blob.
 * Longest side <= 300px, JPEG quality ~0.6.
 */
export async function makeThumbnail(blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      try {
        let { width, height } = img;
        const maxDim = MediaConfig.thumbnailMaxDimension;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (thumbBlob) => {
            if (!thumbBlob) {
              reject(new Error('Failed to create thumbnail'));
              return;
            }

            URL.revokeObjectURL(objectUrl);
            img.remove();
            canvas.remove();

            resolve({ blob: thumbBlob, width, height });
          },
          'image/jpeg',
          0.6
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for thumbnail'));
    };

    img.src = objectUrl;
  });
}

/**
 * Convert a Blob to base64 data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a Blob to ArrayBuffer.
 */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
      } else {
        reject(new Error('Failed to convert blob to ArrayBuffer'));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
