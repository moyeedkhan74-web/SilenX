/**
 * Media download service using Capacitor Filesystem
 * Handles photo downloads with caching and progress tracking
 */

import {
  Filesystem,
  Directory,
} from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { MediaConfig } from '../config/mediaConfig';

export interface DownloadOptions {
  onProgress?: (progress: number) => void;
  useCache?: boolean;
}

export interface DownloadResult {
  filePath: string;
  uri: string;
  size: number;
  fromCache: boolean;
}

/**
 * Download state management
 */
interface DownloadTask {
  id: string;
  url: string;
  fileName: string;
  abortController: AbortController;
  progress: number;
  status: 'pending' | 'downloading' | 'done' | 'failed' | 'cancelled';
  error?: string;
}

const activeDownloads = new Map<string, DownloadTask>();

/**
 * Get the cache directory for media files
 */
async function getCacheDir(): Promise<Directory> {
  if (Capacitor.isNativePlatform()) {
    // On native, use cache directory (Android will clear it automatically)
    return Directory.Cache;
  }
  // On web, use Documents (Data) directory
  return Directory.Data;
}

/**
 * Generate cache file path
 */
function getCachePath(fileName: string): string {
  return `${MediaConfig.storage.basePath}/${fileName}`;
}

/**
 * Generate thumbnail cache path
 */
export function getThumbnailCachePath(fileName: string): string {
  return `${MediaConfig.storage.thumbnailsFolder}/${fileName}`;
}

/**
 * Check if file exists in cache
 */
export async function isCached(fileName: string): Promise<boolean> {
  try {
    const cacheDir = await getCacheDir();
    const filePath = getCachePath(fileName);
    await Filesystem.stat({
      path: filePath,
      directory: cacheDir,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached file URI
 */
export async function getCachedFileUri(fileName: string): Promise<string | null> {
  try {
    const cacheDir = await getCacheDir();
    const filePath = getCachePath(fileName);
    const result = await Filesystem.getUri({
      path: filePath,
      directory: cacheDir,
    });
    return result.uri;
  } catch {
    return null;
  }
}

/**
 * Read file as base64 from cache
 */
export async function readCachedFile(fileName: string): Promise<string | null> {
  try {
    const cacheDir = await getCacheDir();
    const filePath = getCachePath(fileName);
    const result = await Filesystem.readFile({
      path: filePath,
      directory: cacheDir,
    });
    return typeof result.data === 'string' ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Download a media file
 */
export async function downloadMedia(
  downloadUrl: string,
  fileName: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const { onProgress, useCache = true } = options;

  const downloadId = crypto.randomUUID();
  const abortController = new AbortController();

  const task: DownloadTask = {
    id: downloadId,
    url: downloadUrl,
    fileName,
    abortController,
    progress: 0,
    status: 'pending',
  };

  activeDownloads.set(downloadId, task);

  try {
    // Check cache first
    if (useCache) {
      const cachedUri = await getCachedFileUri(fileName);
      if (cachedUri) {
        task.status = 'done';
        task.progress = 100;
        onProgress?.(100);

        // Get file size
        const stat = await Filesystem.stat({
          path: getCachePath(fileName),
          directory: await getCacheDir(),
        });

        activeDownloads.delete(downloadId);

        return {
          filePath: getCachePath(fileName),
          uri: cachedUri,
          size: stat.size,
          fromCache: true,
        };
      }
    }

    task.status = 'downloading';

    // Fetch the file
    const response = await fetch(downloadUrl, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // Get content length
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    // Read response with progress tracking
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (contentLength > 0) {
        const progress = Math.round((receivedLength / contentLength) * 100);
        task.progress = progress;
        onProgress?.(progress);
      }
    }

    // Combine chunks
    const blob = new Blob(chunks as unknown as BlobPart[]);

    // Convert to base64 for Capacitor Filesystem
    const base64 = await blobToBase64(blob);

    // Save to cache
    const cacheDir = await getCacheDir();
    const filePath = getCachePath(fileName);

    const writeResult = await Filesystem.writeFile({
      path: filePath,
      data: base64,
      directory: cacheDir,
      recursive: true,
    });

    task.status = 'done';
    task.progress = 100;
    onProgress?.(100);

    activeDownloads.delete(downloadId);

    return {
      filePath,
      uri: writeResult.uri,
      size: receivedLength,
      fromCache: false,
    };
  } catch (error) {
    task.status = 'failed';
    task.error = (error as Error).message;
    activeDownloads.delete(downloadId);
    throw error;
  }
}

/**
 * Convert Blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        // Remove data URL prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Cancel a download
 */
export function cancelDownload(downloadId: string): boolean {
  const task = activeDownloads.get(downloadId);
  if (!task) return false;

  task.abortController.abort();
  task.status = 'cancelled';
  activeDownloads.delete(downloadId);
  return true;
}

/**
 * Get download progress
 */
export function getDownloadProgress(downloadId: string): number {
  const task = activeDownloads.get(downloadId);
  return task?.progress || 0;
}

/**
 * Get all active downloads
 */
export function getActiveDownloads(): DownloadTask[] {
  return Array.from(activeDownloads.values());
}

/**
 * Clear cache (delete all cached files)
 */
export async function clearCache(): Promise<{ deletedCount: number; totalSize: number }> {
  try {
    const cacheDir = await getCacheDir();
    const files = await Filesystem.readdir({
      path: MediaConfig.storage.basePath,
      directory: cacheDir,
    });

    let deletedCount = 0;
    let totalSize = 0;

    for (const file of files.files) {
      try {
        const stat = await Filesystem.stat({
          path: `${MediaConfig.storage.basePath}/${file.name}`,
          directory: cacheDir,
        });
        totalSize += stat.size;

        await Filesystem.deleteFile({
          path: `${MediaConfig.storage.basePath}/${file.name}`,
          directory: cacheDir,
        });
        deletedCount++;
      } catch (err) {
        console.warn('Failed to delete cache file:', file.name, err);
      }
    }

    return { deletedCount, totalSize };
  } catch (error) {
    console.error('Clear cache error:', error);
    return { deletedCount: 0, totalSize: 0 };
  }
}

/**
 * Get cache size
 */
export async function getCacheSize(): Promise<number> {
  try {
    const cacheDir = await getCacheDir();
    const files = await Filesystem.readdir({
      path: MediaConfig.storage.basePath,
      directory: cacheDir,
    });

    let totalSize = 0;

    for (const file of files.files) {
      try {
        const stat = await Filesystem.stat({
          path: `${MediaConfig.storage.basePath}/${file.name}`,
          directory: cacheDir,
        });
        totalSize += stat.size;
      } catch (err) {
        console.warn('Failed to stat cache file:', file.name, err);
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}
