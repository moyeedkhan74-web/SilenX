/**
 * Media upload service using Firebase Storage
 * Handles photo uploads with progress tracking, retry, and cancellation
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  FirebaseStorage,
  getStorage,
} from 'firebase/storage';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { UploadResult, MediaFile } from '../config/mediaConfig';
import { compressImageWithProgress } from '../utils/mediaCompression';
import { generateImageThumbnail } from '../utils/mediaThumbnail';
import { validateFile } from '../utils/mediaValidation';

// Firebase configuration - using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase (only once)
let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

function getFirebaseInstances(): { storage: FirebaseStorage; auth: Auth } {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  if (!storage) {
    storage = getStorage(app);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return { storage, auth };
}

/**
 * Generate unique file path for storage
 */
function generateStoragePath(userId: string, fileName: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const ext = fileName.split('.').pop() || 'jpg';

  return `uploads/${userId}/${year}/${month}/${uuid}.${ext}`;
}

/**
 * Upload state management
 */
interface UploadTask {
  id: string;
  file: File;
  mediaFile: MediaFile;
  abortController: AbortController;
  uploadTask: ReturnType<typeof uploadBytesResumable> | null;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'failed' | 'cancelled';
  error?: string;
}

// Active upload tasks
const activeUploads = new Map<string, UploadTask>();

/**
 * Create a new upload task
 */
export async function createUploadTask(file: File): Promise<MediaFile> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const id = crypto.randomUUID();
  const mediaFile: MediaFile = {
    id,
    name: file.name,
    path: '',
    size: file.size,
    mimeType: 'image',
    status: 'pending',
    progress: 0,
  };

  const abortController = new AbortController();

  const task: UploadTask = {
    id,
    file,
    mediaFile,
    abortController,
    uploadTask: null,
    progress: 0,
    status: 'pending',
  };

  activeUploads.set(id, task);
  return mediaFile;
}

/**
 * Start uploading a file
 */
export async function startUpload(
  uploadId: string,
  onProgress?: (progress: number) => void,
  onComplete?: (result: UploadResult) => void,
  onError?: (error: Error) => void
): Promise<UploadResult | null> {
  const task = activeUploads.get(uploadId);
  if (!task) {
    throw new Error('Upload task not found');
  }

  const { storage: firebaseStorage, auth: firebaseAuth } = getFirebaseInstances();
  const user = firebaseAuth.currentUser;

  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    task.status = 'uploading';
    task.mediaFile.status = 'uploading';

    // Step 1: Compress image
    const compressionResult = await compressImageWithProgress(
      task.file,
      (progress) => {
        const overallProgress = Math.round(progress * 0.3); // 30% for compression
        task.progress = overallProgress;
        task.mediaFile.progress = overallProgress;
        onProgress?.(overallProgress);
      }
    );

    const compressedFile = compressionResult.file;

    // Step 2: Generate thumbnail
    let thumbnailDataUrl: string | undefined;
    try {
      const thumbnail = await generateImageThumbnail(compressedFile);
      thumbnailDataUrl = thumbnail.dataUrl;
    } catch (err) {
      console.warn('Thumbnail generation failed:', err);
    }

    // Update progress to 40%
    task.progress = 40;
    task.mediaFile.progress = 40;
    onProgress?.(40);

    // Step 3: Upload to Firebase Storage
    const storagePath = generateStoragePath(user.uid, compressedFile.name);
    const storageRef = ref(firebaseStorage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, compressedFile, {
      contentType: compressedFile.type,
    });

    task.uploadTask = uploadTask;

    // Wrap in Promise to track progress
    const snapshot = await new Promise<{
      ref: ReturnType<typeof ref>;
      metadata: { size: number };
    }>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            40 + snapshot.bytesTransferred / snapshot.totalBytes * 55
          ); // 40-95%
          task.progress = progress;
          task.mediaFile.progress = progress;
          onProgress?.(progress);
        },
        (error) => {
          reject(error);
        },
        async () => {
          resolve({
            ref: uploadTask.snapshot.ref,
            metadata: uploadTask.snapshot.metadata,
          });
        }
      );
    });

    // Step 4: Get download URLs
    const downloadUrl = await getDownloadURL(snapshot.ref);

    // Create thumbnail storage reference
    let thumbnailUrl: string | undefined;
    if (thumbnailDataUrl) {
      const thumbPath = storagePath.replace('/uploads/', '/thumbnails/');
      const thumbRef = ref(firebaseStorage, thumbPath);
      // Upload thumbnail as base64
      const thumbBase64 = thumbnailDataUrl.split(',')[1];
      const thumbBinary = atob(thumbBase64);
      const thumbArray = new Uint8Array(thumbBinary.length);
      for (let i = 0; i < thumbBinary.length; i++) {
        thumbArray[i] = thumbBinary.charCodeAt(i);
      }
      await uploadBytesResumable(thumbRef, thumbArray, {
        contentType: 'image/jpeg',
      });
      thumbnailUrl = await getDownloadURL(thumbRef);
    }

    // Update task status
    task.status = 'done';
    task.mediaFile.status = 'done';
    task.progress = 100;
    task.mediaFile.progress = 100;

    const result: UploadResult = {
      id: uploadId,
      storagePath,
      downloadUrl,
      thumbnailUrl,
      size: compressedFile.size,
      mimeType: compressedFile.type,
    };

    onProgress?.(100);
    onComplete?.(result);

    // Clean up task after a delay
    setTimeout(() => {
      activeUploads.delete(uploadId);
    }, 5000);

    return result;
  } catch (error) {
    task.status = 'failed';
    task.mediaFile.status = 'failed';
    task.error = (error as Error).message;
    onError?.(error as Error);
    throw error;
  }
}

/**
 * Cancel an upload
 */
export function cancelUpload(uploadId: string): boolean {
  const task = activeUploads.get(uploadId);
  if (!task) return false;

  task.abortController.abort();
  if (task.uploadTask) {
    task.uploadTask.cancel();
  }
  task.status = 'cancelled';
  task.mediaFile.status = 'failed';
  activeUploads.delete(uploadId);
  return true;
}

/**
 * Retry a failed upload
 */
export async function retryUpload(
  uploadId: string,
  onProgress?: (progress: number) => void,
  onComplete?: (result: UploadResult) => void,
  onError?: (error: Error) => void
): Promise<UploadResult | null> {
  const task = activeUploads.get(uploadId);
  if (!task || task.status !== 'failed') {
    throw new Error('Cannot retry: task not found or not in failed state');
  }

  // Reset status
  task.status = 'pending';
  task.mediaFile.status = 'pending';
  task.progress = 0;
  task.mediaFile.progress = 0;
  task.error = undefined;

  return startUpload(uploadId, onProgress, onComplete, onError);
}

/**
 * Get all active uploads
 */
export function getActiveUploads(): MediaFile[] {
  return Array.from(activeUploads.values()).map((task) => task.mediaFile);
}

/**
 * Get upload status
 */
export function getUploadStatus(uploadId: string): MediaFile | null {
  const task = activeUploads.get(uploadId);
  return task?.mediaFile || null;
}

/**
 * Delete a file from storage
 */
export async function deleteUpload(storagePath: string): Promise<void> {
  const { storage: firebaseStorage } = getFirebaseInstances();
  const storageRef = ref(firebaseStorage, storagePath);
  await deleteObject(storageRef);
}
