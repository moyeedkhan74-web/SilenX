/**
 * Thumbnail generation utilities using browser Canvas API
 * No Node-only libraries - works in Capacitor WebView
 */

import { MediaConfig } from '../config/mediaConfig';

export interface ThumbnailResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Generate a thumbnail from an image file
 * Returns a base64 data URL
 */
export async function generateImageThumbnail(file: File): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Calculate thumbnail dimensions maintaining aspect ratio
        let { width, height } = img;

        if (width > height) {
          if (width > MediaConfig.thumbnail.maxWidthOrHeight) {
            height = Math.round(
              (height * MediaConfig.thumbnail.maxWidthOrHeight) / width
            );
            width = MediaConfig.thumbnail.maxWidthOrHeight;
          }
        } else {
          if (height > MediaConfig.thumbnail.maxWidthOrHeight) {
            width = Math.round(
              (width * MediaConfig.thumbnail.maxWidthOrHeight) / height
            );
            height = MediaConfig.thumbnail.maxWidthOrHeight;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with specified quality
        const dataUrl = canvas.toDataURL('image/jpeg', MediaConfig.thumbnail.initialQuality);

        // Clean up
        URL.revokeObjectURL(objectUrl);
        img.remove();

        resolve({
          dataUrl,
          width,
          height,
        });
      } catch (err) {
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
 * Generate a thumbnail from an image URL (for downloaded images)
 */
export async function generateThumbnailFromUrl(imageUrl: string): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let { width, height } = img;

        if (width > height) {
          if (width > MediaConfig.thumbnail.maxWidthOrHeight) {
            height = Math.round(
              (height * MediaConfig.thumbnail.maxWidthOrHeight) / width
            );
            width = MediaConfig.thumbnail.maxWidthOrHeight;
          }
        } else {
          if (height > MediaConfig.thumbnail.maxWidthOrHeight) {
            width = Math.round(
              (width * MediaConfig.thumbnail.maxWidthOrHeight) / height
            );
            height = MediaConfig.thumbnail.maxWidthOrHeight;
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

        const dataUrl = canvas.toDataURL('image/jpeg', MediaConfig.thumbnail.initialQuality);

        img.remove();

        resolve({
          dataUrl,
          width,
          height,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image from URL'));
    };

    img.src = imageUrl;
  });
}

/**
 * Get image dimensions from a File
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(objectUrl);
      img.remove();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Get video duration and dimensions from a File
 */
export async function getVideoMetadata(
  file: File
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video'));
    };

    video.src = objectUrl;
  });
}
