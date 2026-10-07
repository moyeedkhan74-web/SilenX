/**
 * Image compression utilities using browser-image-compression
 * Works in Capacitor WebView - no native dependencies
 */

import imageCompression from 'browser-image-compression';
import { MediaConfig } from '../config/mediaConfig';

export interface CompressionOptions {
  maxWidthOrHeight?: number;
  initialQuality?: number;
  useWebWorker?: boolean;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress an image file
 * Returns the compressed file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;

  const compressionOptions: Parameters<typeof imageCompression>[1] = {
    maxWidthOrHeight:
      options.maxWidthOrHeight || MediaConfig.imageCompression.maxWidthOrHeight,
    initialQuality:
      options.initialQuality || MediaConfig.imageCompression.initialQuality,
    useWebWorker: options.useWebWorker ?? MediaConfig.imageCompression.useWebWorker,
    fileType: file.type || 'image/jpeg',
    preserveExif: false,
  };

  try {
    const compressedFile = await imageCompression(file, compressionOptions);

    const compressedSize = compressedFile.size;
    const compressionRatio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error(`Failed to compress image: ${(error as Error).message}`);
  }
}

/**
 * Compress image with progress callback
 */
export async function compressImageWithProgress(
  file: File,
  onProgress?: (progress: number) => void,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = file.size;

  const compressionOptions: Parameters<typeof imageCompression>[1] = {
    maxWidthOrHeight:
      options.maxWidthOrHeight || MediaConfig.imageCompression.maxWidthOrHeight,
    initialQuality:
      options.initialQuality || MediaConfig.imageCompression.initialQuality,
    useWebWorker: options.useWebWorker ?? MediaConfig.imageCompression.useWebWorker,
    fileType: file.type || 'image/jpeg',
    preserveExif: false,
    onProgress: (progress: number) => {
      if (onProgress) {
        onProgress(Math.round(progress));
      }
    },
  };

  try {
    const compressedFile = await imageCompression(file, compressionOptions);

    const compressedSize = compressedFile.size;
    const compressionRatio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error(`Failed to compress image: ${(error as Error).message}`);
  }
}

/**
 * Check if file needs compression (is larger than max size)
 */
export function needsCompression(file: File): boolean {
  const maxBytes = MediaConfig.maxImageSizeMB * 1024 * 1024;
  return file.size > maxBytes;
}

/**
 * Get suggested compression quality based on file size
 */
export function getSuggestedQuality(file: File): number {
  const sizeMB = file.size / (1024 * 1024);
  const maxMB = MediaConfig.maxImageSizeMB;

  // If file is already smaller than max, no compression needed
  if (sizeMB <= maxMB * 0.5) {
    return 0.9;
  }

  // Calculate quality based on how much over the limit we are
  const ratio = maxMB / sizeMB;
  return Math.max(0.3, Math.min(0.9, ratio));
}
