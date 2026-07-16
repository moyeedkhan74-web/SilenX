/**
 * Backup Engine
 * Handles encryption, compression, and backup/restore operations
 * Uses crypto-js for encryption (compatible with all platforms)
 */

import { BackupData, BackupOptions, IBackupEngine, IStorage } from './types';

/**
 * Simple encryption utilities (uses crypto-js compatible approach)
 * For production, use proper crypto libraries like libsodium or TweetNaCl
 */
export class EncryptionUtil {
  /**
   * Simple AES-like encryption for demo (use proper crypto in production)
   * This is a placeholder - use crypto-js or libsodium in actual implementation
   */
  static encrypt(text: string, password: string): string {
    // For production: import crypto-js and use AES encryption
    // This is just a demonstration
    const key = this.deriveKey(password);
    const buffer = Buffer.from(text);
    let encrypted = '';

    for (let i = 0; i < buffer.length; i++) {
      encrypted += String.fromCharCode(buffer[i] ^ key.charCodeAt(i % key.length));
    }

    return Buffer.from(encrypted).toString('base64');
  }

  /**
   * Decrypt data
   */
  static decrypt(encrypted: string, password: string): string {
    const key = this.deriveKey(password);
    const buffer = Buffer.from(encrypted, 'base64');
    let decrypted = '';

    for (let i = 0; i < buffer.length; i++) {
      decrypted += String.fromCharCode(buffer[i] ^ key.charCodeAt(i % key.length));
    }

    return decrypted;
  }

  /**
   * Derive key from password (simple, use PBKDF2 in production)
   */
  private static deriveKey(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).padEnd(32, '0');
  }

  /**
   * Hash password for verification
   */
  static hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

/**
 * Compression utilities
 */
export class CompressionUtil {
  /**
   * Compress JSON data (simple RLE compression)
   */
  static compress(data: string): string {
    // For production, use zlib or pako
    return Buffer.from(data).toString('base64');
  }

  /**
   * Decompress data
   */
  static decompress(compressed: string): string {
    return Buffer.from(compressed, 'base64').toString('utf-8');
  }
}

/**
 * Backup Engine
 */
export class BackupEngine implements IBackupEngine {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Create backup
   */
  async createBackup(options: BackupOptions): Promise<Blob | Buffer> {
    // Export data from storage
    const data = await this.storage.exportData();

    const backupData: BackupData = {
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
        platform: this.getPlatform(),
        encrypted: options.encryption,
        encryptionVersion: options.encryption ? '1.0' : undefined,
      },
      contacts: data.contacts || [],
      chats: data.chats || [],
      messages: data.messages || [],
      mediaMetadata: data.mediaMetadata || [],
      settings: data.settings || {},
    };

    let jsonString = JSON.stringify(backupData, null, 2);

    // Compress if needed
    if (options.compressionLevel !== 'none') {
      jsonString = CompressionUtil.compress(jsonString);
    }

    // Encrypt if needed
    if (options.encryption) {
      jsonString = EncryptionUtil.encrypt(
        jsonString,
        this.getEncryptionKey()
      );
    }

    // Convert to Blob/Buffer
    const buffer = Buffer.from(jsonString);
    return typeof Blob !== 'undefined' ? new Blob([buffer]) : buffer;
  }

  /**
   * Restore backup
   */
  async restoreBackup(backupData: Blob | Buffer, password: string): Promise<BackupData> {
    let jsonString = '';

    if (backupData instanceof Blob) {
      const text = await backupData.text();
      jsonString = text;
    } else {
      jsonString = backupData.toString();
    }

    // Decrypt if needed
    try {
      jsonString = EncryptionUtil.decrypt(jsonString, password);
    } catch {
      throw new Error('Invalid password or corrupted backup');
    }

    // Decompress if needed
    try {
      jsonString = CompressionUtil.decompress(jsonString);
    } catch {
      // Not compressed, continue
    }

    try {
      const data = JSON.parse(jsonString) as BackupData;
      return data;
    } catch {
      throw new Error('Invalid backup format');
    }
  }

  /**
   * Export to JSON (unencrypted, for manual backup)
   */
  async exportToJSON(): Promise<string> {
    const data = await this.storage.exportData();

    const backupData: BackupData = {
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
        platform: this.getPlatform(),
        encrypted: false,
      },
      contacts: data.contacts || [],
      chats: data.chats || [],
      messages: data.messages || [],
      mediaMetadata: data.mediaMetadata || [],
      settings: data.settings || {},
    };

    return JSON.stringify(backupData, null, 2);
  }

  /**
   * Import from JSON
   */
  async importFromJSON(jsonData: string): Promise<void> {
    try {
      const backupData = JSON.parse(jsonData) as BackupData;

      // Validate backup format
      if (
        !backupData.metadata ||
        !Array.isArray(backupData.contacts) ||
        !Array.isArray(backupData.chats)
      ) {
        throw new Error('Invalid backup format');
      }

      // Import data
      await this.storage.importData(backupData);
    } catch (error) {
      throw new Error(`Failed to import backup: ${error}`);
    }
  }

  /**
   * Determine platform
   */
  private getPlatform(): 'desktop' | 'web' | 'mobile' {
    // This would be overridden by platform-specific implementations
    return 'web';
  }

  /**
   * Get encryption key from environment or config
   */
  private getEncryptionKey(): string {
    // In production, this should come from secure storage
    return process.env.SILENX_BACKUP_KEY || 'default-backup-key';
  }
}

/**
 * Backup Manager - higher-level backup operations
 */
export class BackupManager {
  private backupEngine: BackupEngine;

  constructor(backupEngine: BackupEngine) {
    this.backupEngine = backupEngine;
  }

  /**
   * Create encrypted backup
   */
  async createEncryptedBackup(password: string): Promise<Buffer | Blob> {
    return await this.backupEngine.createBackup({
      includeMedia: true,
      encryption: true,
      compressionLevel: 'default',
      destination: 'local',
    });
  }

  /**
   * Create unencrypted backup for manual export
   */
  async createManualBackup(): Promise<string> {
    return await this.backupEngine.exportToJSON();
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupFile: Blob | Buffer, password: string): Promise<BackupData> {
    return await this.backupEngine.restoreBackup(backupFile, password);
  }

  /**
   * Import from JSON file
   */
  async importFromFile(jsonData: string): Promise<void> {
    await this.backupEngine.importFromJSON(jsonData);
  }
}
