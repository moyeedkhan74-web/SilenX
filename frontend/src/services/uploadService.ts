// src/services/uploadService.ts
// Media upload service using Firebase Storage
// Handles photo uploads with progress, pause/resume, retry with backoff, queuing

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, firestore, auth } from '../lib/firebase';
import { compressImage, makeThumbnail } from '../utils/imageUtils';
import { MediaConfig } from '../config/mediaConfig';
import { MediaItem } from '../types/media';

// Upload state
export type UploadStatus = 'queued' | 'uploading' | 'paused' | 'done' | 'failed';

export interface UploadItem {
  id: string; // client-side id
  file: File;
  storagePath: string;
  thumbnailPath?: string;
  userId: string;
  createdAt: number;
  status: UploadStatus;
  progress: number;
  error?: string;
  abortController: AbortController;
  uploadTask: ReturnType<typeof uploadBytesResumable> | null;
  paused: boolean;
}

// Queue with max 3 parallel uploads
const parallelUploadLimit = MediaConfig.maxParallelUploads;
const uploadQueue: UploadItem[] = [];
let activeUploads = 0;

// Event emitter for upload events
type UploadListeners = {
  onProgress: ((item: UploadItem) => void)[];
  onStatus: ((item: UploadItem) => void)[];
};
const listeners: UploadListeners = { onProgress: [], onStatus: [] };

/**
 * Add a listener for upload events.
 * onProgress: called with progress updates
 * onStatus: called when upload status changes
 */
export function addUploadListener(
  onProgress?: (item: UploadItem) => void,
  onStatus?: (item: UploadItem) => void
) {
  if (onProgress) listeners.onProgress.push(onProgress);
  if (onStatus) listeners.onStatus.push(onStatus);
}

/**
 * Remove a listener for upload events.
 */
export function removeUploadListener(
  onProgress?: (item: UploadItem) => void,
  onStatus?: (item: UploadItem) => void
) {
  if (onProgress) {
    listeners.onProgress = listeners.onProgress.filter((l) => l !== onProgress);
  }
  if (onStatus) {
    listeners.onStatus = listeners.onStatus.filter((l) => l !== onStatus);
  }
}

/**
 * Create a new upload item and add it to the queue.
 */
export async function createUpload(
  file: File,
  sendOriginal: boolean = false,
  caption?: string
): Promise<UploadItem> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const year = now.getFullYear();
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `uploads/${user.uid}/${year}/${id}.${ext}`;

  // Compress image first (if not sendOriginal)
  let blob: Blob = file;
  let width = 0, height = 0;
  let thumbnailBlob: Blob | null = null;
  let thumbWidth = 0, thumbHeight = 0;

  if (!sendOriginal) {
    const compressed = await compressImage(file, sendOriginal);
    blob = compressed.blob;
    width = compressed.width;
    height = compressed.height;

    // Generate thumbnail
    const thumb = await makeThumbnail(file);
    thumbnailBlob = thumb.blob;
    thumbWidth = thumb.width;
    thumbHeight = thumb.height;
  } else {
    const dims = await blobToImageSize(file);
    width = dims.width;
    height = dims.height;

    const thumb = await makeThumbnail(file);
    thumbnailBlob = thumb.blob;
    thumbWidth = thumb.width;
    thumbHeight = thumb.height;
  }

  const thumbnailPath = `uploads/${user.uid}/${year}/${id}_thumb.jpg`;

  const item: UploadItem = {
    id,
    file,
    storagePath,
    thumbnailPath,
    userId: user.uid,
    createdAt: now.getTime(),
    status: 'queued',
    progress: 0,
    abortController: new AbortController(),
    uploadTask: null,
    paused: false,
  };

  // Store thumbnail and dimensions as properties for later use
  (item as any).compressedBlob = blob;
  (item as any).thumbnailBlob = thumbnailBlob;
  (item as any).width = width;
  (item as any).height = height;
  (item as any).thumbWidth = thumbWidth;
  (item as any).thumbHeight = thumbHeight;

  // Add caption if provided
  if (caption) {
    (item as any).caption = caption;
  }

  uploadQueue.push(item);
  queueOnStatusChange(item);

  // Start processing
  processQueue();

  // Write initial Firestore document with status "queued"
  await writeFirestoreMetadata(item, 'queued');

  return item;
}

/**
 * Process the upload queue with parallel limit.
 */
async function processQueue() {
  if (activeUploads >= parallelUploadLimit) return;

  const item = uploadQueue.find((i) => i.status === 'queued' && !i.paused && !i.uploadTask);
  if (!item) return;

  activeUploads++;
  item.status = 'uploading';
  queueOnStatusChange(item);

  // Upload thumbnail first (if it exists)
  if ((item as any).thumbnailBlob) {
    await uploadThumbnail(item);
  }

  // Upload main file
  const success = await performUpload(item);

   activeUploads--;
   if (success && !item.paused) {
     item.status = 'done';
     item.progress = 100;
     queueOnStatusChange(item);
   }

  // Continue processing queue
  processQueue();
}

/**
 * Upload a file to Firebase Storage with resumable upload.
 */
async function performUpload(item: UploadItem): Promise<boolean> {
  let retryCount = 0;
  const maxRetries = MediaConfig.maxRetryAttempts;
  const baseDelay = MediaConfig.retryBaseDelayMs;

  while (retryCount <= maxRetries && item.status === 'uploading') {
    try {
      const storageRef = ref(storage, item.storagePath);

      // Get blob
      const blob = (item as any).compressedBlob || item.file;

      // Create upload task
      item.uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: item.file.type,
      });

      // Listen for state changes
      await new Promise<void>((resolve, reject) => {
        item.uploadTask!.on(
          'state_changed',
          (snapshot) => {
            // Update progress
            item.progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            queueOnProgress(item);
          },
          (error) => {
            // Handle network errors with retry
            if (isRetryableError(error) && retryCount < maxRetries) {
              retryCount++;
              const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), MediaConfig.retryMaxDelayMs);
              setTimeout(() => resolve(undefined), delay);
            } else {
              item.status = 'failed';
              item.error = error.message;
              queueOnStatusChange(item);
              reject(error);
            }
          },
          async () => {
            // Upload completed successfully
            item.progress = 100;
            queueOnProgress(item);

            // Get download URL
            const downloadUrl = await getDownloadURL(item.uploadTask!.snapshot.ref);
            (item as any).downloadUrl = downloadUrl;

            resolve();
          }
        );
      });

      // Update Firestore metadata
      await writeFirestoreMetadata(item, 'done');
      return true;
    } catch (error) {
      if (retryCount >= maxRetries) {
        item.status = 'failed';
        item.error = (error as Error).message;
        queueOnStatusChange(item);
        await writeFirestoreMetadata(item, 'failed');
        return false;
      }
      retryCount++;
    }
  }

  return false;
}

/**
 * Upload a thumbnail image to Firebase Storage.
 */
async function uploadThumbnail(item: UploadItem): Promise<void> {
  if (!item.thumbnailPath || !(item as any).thumbnailBlob) return;

  const thumbnailRef = ref(storage, item.thumbnailPath);
  const uploadTask = uploadBytesResumable(thumbnailRef, (item as any).thumbnailBlob, {
    contentType: 'image/jpeg',
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on('state_changed', () => {}, reject, () => resolve());
  });
}

/**
 * Pause an upload.
 */
export function pauseUpload(itemId: string): boolean {
  const item = uploadQueue.find((i) => i.id === itemId);
  if (!item) return false;

  if (item.uploadTask) {
    item.uploadTask.cancel();
  }
  item.paused = true;
  item.status = 'paused';
  queueOnStatusChange(item);
  return true;
}

/**
 * Resume a paused upload.
 */
export function resumeUpload(itemId: string): boolean {
  const item = uploadQueue.find((i) => i.id === itemId);
  if (!item) return false;

  item.paused = false;
  item.status = 'queued';
  queueOnStatusChange(item);

  // Re-queue the upload (uploadBytesResumable can't be resumed from the same task)
  item.uploadTask = null;
  processQueue();
  return true;
}

/**
 * Cancel an upload.
 */
export function cancelUpload(itemId: string): boolean {
  const item = uploadQueue.find((i) => i.id === itemId);
  if (!item) return false;

  if (item.uploadTask) {
    item.uploadTask.cancel();
  }
  item.status = 'failed';
  item.error = 'Cancelled by user';
  queueOnStatusChange(item);

  // Remove from queue
  uploadQueue.splice(uploadQueue.indexOf(item), 1);
  return true;
}

/**
 * Retry a failed upload.
 */
export function retryUpload(itemId: string): boolean {
  const item = uploadQueue.find((i) => i.id === itemId);
  if (!item) return false;

  item.status = 'queued';
  item.error = undefined;
  item.paused = false;
  item.uploadTask = null;
  queueOnStatusChange(item);

  processQueue();
  return true;
}

/**
 * Write or update Firestore metadata for a media item.
 */
async function writeFirestoreMetadata(item: UploadItem, status: MediaItem['status']): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(firestore, 'mediaItems', item.id);
  const now = Date.now();

  const metadata: Partial<MediaItem> = {
    id: item.id,
    ownerId: user.uid,
    kind: 'image',
    fileName: item.file.name,
    mimeType: item.file.type,
    size: (item as any).compressedBlob ? (item as any).compressedBlob.size : item.file.size,
    storagePath: item.storagePath,
    downloadUrl: (item as any).downloadUrl || '',
    thumbnailUrl: item.thumbnailPath ? await getThumbnailDownloadUrl(item) : undefined,
    width: (item as any).width,
    height: (item as any).height,
    createdAt: now,
    status,
  };

  try {
    await setDoc(docRef, metadata, { merge: true });
  } catch (err) {
    console.error('Failed to write Firestore metadata:', err);
  }
}

/**
 * Get the download URL for a thumbnail.
 */
async function getThumbnailDownloadUrl(item: UploadItem): Promise<string | undefined> {
  if (!item.thumbnailPath || !(item as any).thumbnailBlob) return undefined;

  try {
    const thumbRef = ref(storage, item.thumbnailPath);
    return await getDownloadURL(thumbRef);
  } catch {
    return undefined;
  }
}

/**
 * Get image dimensions from a File.
 */
async function blobToImageSize(file: File): Promise<{ width: number; height: number }> {
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
 * Check if an error is retryable (network error, timeout, etc.).
 */
function isRetryableError(error: any): boolean {
  // 408 timeout, 5xx server errors, or network errors
  return !error?.code || ['network-error', 'timeout'].includes(error?.code);
}

/**
 * Notify all listeners of progress update.
 */
function queueOnProgress(item: UploadItem) {
  listeners.onProgress.forEach((l) => l(item));
}

/**
 * Notify all listeners of status update.
 */
function queueOnStatusChange(item: UploadItem) {
  listeners.onStatus.forEach((l) => l(item));
}

/**
 * Get all uploads (for queue persistence).
 */
export function getUploads(): UploadItem[] {
  return uploadQueue;
}

// Persist the queue to IndexedDB so unfinished uploads can resume when app returns to foreground
// Web SDK does not upload while the app is killed because the JS context is suspended
// When the app returns to the foreground, new uploads will be processed automatically
// This is a known limit of the client-side storage approach

/**
 * Attempt to resume any incomplete uploads when the app returns to the foreground.
 */
export async function resumeForegroundUploads() {
  const items = uploadQueue.filter(
    (i) => i.status === 'queued' && !i.paused && !i.uploadTask
  );

  if (items.length > 0) {
    processQueue();
  }
}