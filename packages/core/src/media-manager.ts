/**
 * Media Manager
 * Handles media downloads, deletion, backup
 * Platform-agnostic implementation
 */

import {
  MediaAttachment,
  MediaMetadata,
  DownloadOptions,
  IMediaDownloader,
  IStorage,
} from './types';

/**
 * Abstract Media Downloader (implemented by each platform)
 */
export abstract class AbstractMediaDownloader implements IMediaDownloader {
  protected storage: IStorage;
  protected downloadQueue: Map<string, DownloadOptions> = new Map();
  protected activeDownloads: Set<string> = new Set();

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Platform-specific: Download file to device storage
   */
  abstract download(options: DownloadOptions): Promise<string>;

  /**
   * Platform-specific: Delete file from device storage
   */
  abstract deleteFile(filePath: string): Promise<void>;

  /**
   * Platform-specific: Get file size
   */
  abstract getFileSize(filePath: string): Promise<number>;

  /**
   * Platform-specific: File exists check
   */
  abstract fileExists(filePath: string): Promise<boolean>;

  /**
   * Pause download
   */
  async pause(mediaId: string): Promise<void> {
    const media = await this.storage.getMediaMetadata(mediaId);
    if (!media) throw new Error(`Media ${mediaId} not found`);

    media.downloadStatus = 'pending';
    await this.storage.updateMediaMetadata(media);
    this.activeDownloads.delete(mediaId);
  }

  /**
   * Resume download
   */
  async resume(mediaId: string): Promise<void> {
    const media = await this.storage.getMediaMetadata(mediaId);
    if (!media) throw new Error(`Media ${mediaId} not found`);

    const options = this.downloadQueue.get(mediaId);
    if (!options) throw new Error(`Download options not found for ${mediaId}`);

    media.downloadStatus = 'downloading';
    await this.storage.updateMediaMetadata(media);

    await this.download(options);
  }

  /**
   * Cancel download
   */
  async cancel(mediaId: string): Promise<void> {
    const media = await this.storage.getMediaMetadata(mediaId);
    if (!media) throw new Error(`Media ${mediaId} not found`);

    media.downloadStatus = 'failed';
    await this.storage.updateMediaMetadata(media);
    this.activeDownloads.delete(mediaId);
    this.downloadQueue.delete(mediaId);
  }

  /**
   * Get download status
   */
  async getDownloadStatus(mediaId: string): Promise<MediaMetadata | null> {
    return await this.storage.getMediaMetadata(mediaId);
  }

  /**
   * Delete media file and metadata
   */
  async deleteMedia(mediaId: string): Promise<void> {
    const media = await this.storage.getMediaMetadata(mediaId);
    if (!media) throw new Error(`Media ${mediaId} not found`);

    // Delete file if exists
    if (await this.fileExists(media.filePath)) {
      await this.deleteFile(media.filePath);
    }

    // Delete thumbnail if exists
    if (media.thumbnailPath && (await this.fileExists(media.thumbnailPath))) {
      await this.deleteFile(media.thumbnailPath);
    }

    // Mark as deleted in metadata
    media.isDeleted = true;
    await this.storage.updateMediaMetadata(media);
  }

  /**
   * Get total downloaded media size
   */
  async getDownloadedSize(): Promise<number> {
    let totalSize = 0;
    // This would need to be implemented based on platform capabilities
    return totalSize;
  }

  /**
   * Cleanup old media based on policy
   */
  async cleanupOldMedia(daysThreshold: number = 30): Promise<void> {
    const thirtyDaysAgo = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

    // Note: Implementation would depend on platform's ability to query storage
    // This is a placeholder for the logic
  }
}

/**
 * Media Manager - orchestrates all media operations
 */
export class MediaManager {
  private storage: IStorage;
  private downloader: AbstractMediaDownloader;

  constructor(storage: IStorage, downloader: AbstractMediaDownloader) {
    this.storage = storage;
    this.downloader = downloader;
  }

  /**
   * Download media
   */
  async downloadMedia(
    mediaUrl: string,
    fileName: string,
    messageId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create initial metadata
    const metadata: MediaMetadata = {
      id: mediaId,
      mediaId: mediaId,
      messageId,
      fileName,
      filePath: '', // Will be set by platform downloader
      fileSize: 0,
      mimeType: this.getMimeType(fileName),
      downloadStatus: 'downloading',
      downloadProgress: 0,
      isDeleted: false,
    };

    await this.storage.addMediaMetadata(metadata);

    try {
      const filePath = await this.downloader.download({
        url: mediaUrl,
        fileName,
        mediaId,
        onProgress: (progress) => {
          // Update progress
          metadata.downloadProgress = progress;
          onProgress?.(progress);
        },
        onComplete: async () => {
          metadata.downloadStatus = 'completed';
          metadata.downloadedAt = Date.now();
          metadata.fileSize = await this.downloader.getFileSize(metadata.filePath);
          await this.storage.updateMediaMetadata(metadata);
        },
        onError: async (error) => {
          metadata.downloadStatus = 'failed';
          await this.storage.updateMediaMetadata(metadata);
          throw error;
        },
      });

      metadata.filePath = filePath;
      await this.storage.updateMediaMetadata(metadata);
      return filePath;
    } catch (error) {
      metadata.downloadStatus = 'failed';
      await this.storage.updateMediaMetadata(metadata);
      throw error;
    }
  }

  /**
   * Pause media download
   */
  async pauseDownload(mediaId: string): Promise<void> {
    await this.downloader.pause(mediaId);
  }

  /**
   * Resume media download
   */
  async resumeDownload(mediaId: string): Promise<void> {
    await this.downloader.resume(mediaId);
  }

  /**
   * Cancel media download
   */
  async cancelDownload(mediaId: string): Promise<void> {
    await this.downloader.cancel(mediaId);
  }

  /**
   * Delete media (file + metadata)
   */
  async deleteMedia(mediaId: string): Promise<void> {
    await this.downloader.deleteMedia(mediaId);
  }

  /**
   * Get media for message
   */
  async getMediaForMessage(messageId: string): Promise<MediaMetadata[]> {
    return await this.storage.getMediaMetadataForMessage(messageId);
  }

  /**
   * Get media download status
   */
  async getMediaStatus(mediaId: string): Promise<MediaMetadata | null> {
    return await this.storage.getMediaMetadata(mediaId);
  }

  /**
   * Check if media is downloaded
   */
  async isMediaDownloaded(mediaId: string): Promise<boolean> {
    const media = await this.storage.getMediaMetadata(mediaId);
    return media ? media.downloadStatus === 'completed' : false;
  }

  /**
   * Get media file path
   */
  async getMediaFilePath(mediaId: string): Promise<string | null> {
    const media = await this.storage.getMediaMetadata(mediaId);
    return media && media.downloadStatus === 'completed' ? media.filePath : null;
  }

  /**
   * Cleanup old/unused media
   */
  async cleanupMedia(daysThreshold: number = 30): Promise<void> {
    await this.downloader.cleanupOldMedia(daysThreshold);
  }

  /**
   * Get total media storage used
   */
  async getMediaStorageUsed(): Promise<number> {
    return await this.downloader.getDownloadedSize();
  }

  /**
   * Determine MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      zip: 'application/zip',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
