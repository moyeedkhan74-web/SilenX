/**
 * useMediaUpload - React hook for media uploads
 * Manages photo selection, upload progress, and state
 */

import { useState, useCallback, useRef } from 'react';
import {
  createUploadTask,
  startUpload,
  cancelUpload,
  retryUpload,
} from '../services/mediaUploadService';
import { downloadMedia, isCached } from '../services/mediaDownloadService';
import { MediaFile, UploadResult } from '../config/mediaConfig';
import { validateFile } from '../utils/mediaValidation';

export interface UseMediaUploadOptions {
  maxConcurrent?: number;
  autoUpload?: boolean;
}

export interface MediaUploadState {
  uploadId: string | null;
  file: MediaFile | null;
  progress: number;
  status: 'idle' | 'pending' | 'uploading' | 'done' | 'failed' | 'cancelled';
  error: string | null;
  result: UploadResult | null;
}

export interface UseMediaUploadReturn {
  state: MediaUploadState;
  selectFile: (file: File) => Promise<void>;
  startUpload: () => Promise<UploadResult | null>;
  cancelUpload: () => boolean;
  retryUpload: () => Promise<UploadResult | null>;
  reset: () => void;
  downloadAndCache: (url: string, fileName: string) => Promise<string | null>;
  isCached: (fileName: string) => Promise<boolean>;
}

/**
 * React hook for managing media uploads
 */
export function useMediaUpload(
  options: UseMediaUploadOptions = {}
): UseMediaUploadReturn {
  const { autoUpload = false } = options;

  const [state, setState] = useState<MediaUploadState>({
    uploadId: null,
    file: null,
    progress: 0,
    status: 'idle',
    error: null,
    result: null,
  });

  const uploadIdRef = useRef<string | null>(null);

  /**
   * Select a file and prepare for upload
   */
  const selectFile = useCallback(async (file: File) => {
    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        setState({
          uploadId: null,
          file: null,
          progress: 0,
          status: 'failed',
          error: validation.error || 'Invalid file',
          result: null,
        });
        return;
      }

      // Create upload task
      const mediaFile = await createUploadTask(file);
      uploadIdRef.current = mediaFile.id;

      setState({
        uploadId: mediaFile.id,
        file: mediaFile,
        progress: 0,
        status: 'pending',
        error: null,
        result: null,
      });

      // Auto-upload if enabled
      if (autoUpload) {
        await startUploadHandler(mediaFile.id);
      }
    } catch (error) {
      setState({
        uploadId: null,
        file: null,
        progress: 0,
        status: 'failed',
        error: (error as Error).message,
        result: null,
      });
    }
  }, [autoUpload]);

  /**
   * Internal upload handler with progress tracking
   */
  const startUploadHandler = useCallback(async (uploadId: string): Promise<UploadResult | null> => {
    return new Promise((resolve, reject) => {
      startUpload(
        uploadId,
        (progress) => {
          setState((prev) => ({
            ...prev,
            progress,
            status: 'uploading',
            file: prev.file ? { ...prev.file, progress } : null,
          }));
        },
        (result) => {
          setState((prev) => ({
            ...prev,
            progress: 100,
            status: 'done',
            file: prev.file ? { ...prev.file, status: 'done', progress: 100 } : null,
            result,
            error: null,
          }));
          resolve(result);
        },
        (error) => {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: error.message,
            file: prev.file ? { ...prev.file, status: 'failed' } : null,
          }));
          reject(error);
        }
      );
    });
  }, []);

  /**
   * Start upload for the currently selected file
   */
  const startUploadFn = useCallback(async (): Promise<UploadResult | null> => {
    if (!uploadIdRef.current) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'No file selected',
      }));
      return null;
    }

    try {
      return await startUploadHandler(uploadIdRef.current);
    } catch (error) {
      return null;
    }
  }, [startUploadHandler]);

  /**
   * Cancel current upload
   */
  const cancelUploadFn = useCallback((): boolean => {
    if (!uploadIdRef.current) return false;

    const cancelled = cancelUpload(uploadIdRef.current);
    if (cancelled) {
      setState((prev) => ({
        ...prev,
        status: 'cancelled',
      }));
    }
    return cancelled;
  }, []);

  /**
   * Retry failed upload
   */
  const retryUploadFn = useCallback(async (): Promise<UploadResult | null> => {
    if (!uploadIdRef.current) return null;

    try {
      return await new Promise<UploadResult | null>((resolve, reject) => {
        retryUpload(
          uploadIdRef.current!,
          (progress) => {
            setState((prev) => ({
              ...prev,
              progress,
              status: 'uploading',
            }));
          },
          (result) => {
            setState((prev) => ({
              ...prev,
              progress: 100,
              status: 'done',
              result,
              error: null,
            }));
            resolve(result);
          },
          (error) => {
            setState((prev) => ({
              ...prev,
              status: 'failed',
              error: error.message,
            }));
            reject(error);
          }
        );
      });
    } catch {
      return null;
    }
  }, []);

  /**
   * Reset upload state
   */
  const reset = useCallback(() => {
    if (uploadIdRef.current) {
      cancelUpload(uploadIdRef.current);
    }
    uploadIdRef.current = null;
    setState({
      uploadId: null,
      file: null,
      progress: 0,
      status: 'idle',
      error: null,
      result: null,
    });
  }, []);

  /**
   * Download and cache a media file
   * Returns the local file URI
   */
  const downloadAndCache = useCallback(
    async (url: string, fileName: string): Promise<string | null> => {
      try {
        const result = await downloadMedia(url, fileName, {
          useCache: true,
        });
        return result.uri;
      } catch (error) {
        console.error('Download error:', error);
        return null;
      }
    },
    []
  );

  /**
   * Check if a file is cached
   */
  const isCachedFn = useCallback(async (fileName: string): Promise<boolean> => {
    return isCached(fileName);
  }, []);

  return {
    state,
    selectFile,
    startUpload: startUploadFn,
    cancelUpload: cancelUploadFn,
    retryUpload: retryUploadFn,
    reset,
    downloadAndCache,
    isCached: isCachedFn,
  };
}
