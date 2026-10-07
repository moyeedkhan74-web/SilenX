// src/hooks/useMediaUpload.ts
// React hook for managing media uploads
// Exposes items, progress per item, pick, pause, resume, cancel, retry.

import { useState, useEffect, useCallback } from 'react';
import {
  createUpload,
  pauseUpload,
  resumeUpload,
  cancelUpload,
  retryUpload,
  addUploadListener,
  removeUploadListener,
  getUploads,
  resumeForegroundUploads,
  UploadItem,
} from '../services/uploadService';
import { takePhoto, pickFromGallery } from '../services/pickerService';

/**
 * Hook for managing media uploads with progress tracking and controls.
 * Usage:
 *   const { items, isUploading, error, pickCamera, pickGallery, pause, resume, cancel, retry, reset } = useMediaUpload();
 */
export function useMediaUpload() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    setItems([...getUploads()]);

    // Add listeners
    const onProgress = (item: UploadItem) => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...item } : i))
      );
    };

    const onStatus = (item: UploadItem) => {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === item.id);
        if (!exists) {
          return [...prev, item];
        }
        return prev.map((i) => (i.id === item.id ? { ...item } : i));
      });
    };

    addUploadListener(onProgress, onStatus);

    // Cleanup
    return () => {
      removeUploadListener(onProgress);
      removeUploadListener(onStatus);
    };
  }, []);

  const pickCamera = useCallback(async () => {
    setError(null);
    const result = await takePhoto();
    if (!(result instanceof File)) {
      const msg = result.type === 'permission'
        ? 'Camera permission denied. Please grant permission in your device settings.'
        : result.type === 'cancelled'
          ? 'No photo taken.'
          : result.message;
      setError(msg);
      return;
    }
    // Success case: create upload item
    try {
      const item = await createUpload(result);
      setItems((prev) => [...prev, item]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const pickGallery = useCallback(async () => {
    setError(null);
    const results = await pickFromGallery();
    for (const result of results) {
      if (!(result instanceof File)) {
        const msg = result.type === 'permission'
          ? 'Gallery permission denied. Please grant permission in your device settings.'
          : result.message;
        setError(msg);
        continue;
      }
      try {
        const item = await createUpload(result);
        setItems((prev) => [...prev, item]);
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }, []);

  const pause = useCallback((itemId: string) => {
    pauseUpload(itemId);
  }, []);

  const resume = useCallback((itemId: string) => {
    resumeUpload(itemId);
  }, []);

  const cancel = useCallback((itemId: string) => {
    cancelUpload(itemId);
  }, []);

  const retry = useCallback((itemId: string) => {
    retryUpload(itemId);
  }, []);

  const retryAll = useCallback(() => {
    items.forEach((item) => {
      if (item.status === 'failed') {
        retryUpload(item.id);
      }
    });
  }, [items]);

  const reset = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  // Resume uploads when app returns to foreground
  useEffect(() => {
    const handleResume = () => {
      resumeForegroundUploads();
    };

    // Listen for app resume (Capacitor)
    try {
      const { App } = require('@capacitor/app');
      const listener = App.addListener('resume', handleResume);

      // Also listen for window focus (web)
      window.addEventListener('focus', handleResume);

      return () => {
        listener.remove();
        window.removeEventListener('focus', handleResume);
      };
    } catch {
      // Fallback: window focus only
      window.addEventListener('focus', handleResume);
      return () => window.removeEventListener('focus', handleResume);
    }
  }, []);

  return {
    items,
    isUploading: items.some((i) => i.status === 'uploading'),
    error,
    pickCamera,
    pickGallery,
    pause,
    resume,
    cancel,
    retry,
    retryAll,
    reset,
    clearError: () => setError(null),
  };
}
