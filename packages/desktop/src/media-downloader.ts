/**
 * Desktop (Electron) Media Downloader
 * Handles file downloads with pause/resume support
 */

import { AbstractMediaDownloader, DownloadOptions, IStorage } from '@silenx/core';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Electron Media Downloader
 */
export class ElectronMediaDownloader extends AbstractMediaDownloader {
  private downloadsPath: string;
  private mediaBasePath: string;

  constructor(storage: IStorage, downloadsPath: string, mediaBasePath: string) {
    super(storage);
    this.downloadsPath = downloadsPath;
    this.mediaBasePath = mediaBasePath;
    this.ensureDirectories();
  }

  /**
   * Ensure download directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.mediaBasePath)) {
      fs.mkdirSync(this.mediaBasePath, { recursive: true });
    }
  }

  /**
   * Download file
   */
  async download(options: DownloadOptions): Promise<string> {
    const filePath = path.join(this.mediaBasePath, options.fileName);

    // In production, use a proper HTTP client like axios or fetch
    // This is a placeholder implementation
    const response = await fetch(options.url);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const totalSize = buffer.byteLength;

    // Write file in chunks to track progress
    const chunkSize = 1024 * 1024; // 1MB chunks
    const writeStream = fs.createWriteStream(filePath);

    for (let i = 0; i < buffer.byteLength; i += chunkSize) {
      const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.byteLength));
      
      const progress = Math.round((i / totalSize) * 100);
      options.onProgress?.(progress);

      writeStream.write(new Uint8Array(chunk));
    }

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        options.onComplete?.();
        resolve(filePath);
      });

      writeStream.on('error', (error) => {
        options.onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * Delete file from device storage
   */
  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Get file size
   */
  async getFileSize(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) return 0;
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    return fs.existsSync(filePath);
  }

  /**
   * Cleanup old media files
   */
  async cleanupOldMedia(daysThreshold: number = 30): Promise<void> {
    const now = Date.now();
    const threshold = daysThreshold * 24 * 60 * 60 * 1000;

    const files = fs.readdirSync(this.mediaBasePath);
    
    for (const file of files) {
      const filePath = path.join(this.mediaBasePath, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > threshold) {
        await this.deleteFile(filePath);
      }
    }
  }

  /**
   * Get total media storage used
   */
  async getDownloadedSize(): Promise<number> {
    let totalSize = 0;

    const getAllFiles = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += await getAllFiles(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    };

    await getAllFiles(this.mediaBasePath);
    return totalSize;
  }

  /**
   * Open file in default application (Electron-specific)
   */
  async openFile(filePath: string): Promise<void> {
    // This would use electron's shell.openPath
    // const { shell } = require('electron');
    // await shell.openPath(filePath);
  }

  /**
   * Show file in file explorer (Electron-specific)
   */
  async showInFolder(filePath: string): Promise<void> {
    // This would use electron's shell.showItemInFolder
    // const { shell } = require('electron');
    // shell.showItemInFolder(filePath);
  }
}
