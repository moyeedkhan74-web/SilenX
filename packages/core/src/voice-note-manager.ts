/**
 * Voice Note Manager
 * Handles recording, storing, and playing voice notes
 */

import { VoiceNote, VoiceRecorderOptions, IVoiceRecorder, IStorage } from './types';

/**
 * Abstract Voice Recorder (implemented by each platform)
 */
export abstract class AbstractVoiceRecorder implements IVoiceRecorder {
  protected isRecordingNow: boolean = false;
  protected currentDuration: number = 0;
  protected recordingPath: string = '';

  /**
   * Platform-specific: Start recording
   */
  abstract startRecording(options?: VoiceRecorderOptions): Promise<void>;

  /**
   * Platform-specific: Stop recording and return file info
   */
  abstract stopRecording(): Promise<{ filePath: string; duration: number }>;

  /**
   * Platform-specific: Pause recording
   */
  abstract pauseRecording(): Promise<void>;

  /**
   * Platform-specific: Resume recording
   */
  abstract resumeRecording(): Promise<void>;

  /**
   * Platform-specific: Cancel recording
   */
  abstract cancelRecording(): Promise<void>;

  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.isRecordingNow;
  }

  /**
   * Get current recording duration
   */
  getDuration(): number {
    return this.currentDuration;
  }
}

/**
 * Voice Note Manager
 */
export class VoiceNoteManager {
  private storage: IStorage;
  private recorder: AbstractVoiceRecorder;

  constructor(storage: IStorage, recorder: AbstractVoiceRecorder) {
    this.storage = storage;
    this.recorder = recorder;
  }

  /**
   * Record voice note for a chat
   */
  async recordVoiceNote(
    chatId: string,
    senderId: string,
    options?: VoiceRecorderOptions
  ): Promise<VoiceNote> {
    const startTime = Date.now();

    // Start recording
    await this.recorder.startRecording(options);

    // User will call stopRecording() when done
    const { filePath, duration } = await this.recorder.stopRecording();

    // Create voice note record
    const voiceNote: VoiceNote = {
      id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messageId: '',
      chatId,
      senderId,
      duration,
      originalName: `voice_${Date.now()}.${options?.format || 'mp3'}`,
      filePath,
      mimeType: this.getMimeType(options?.format),
      size: 0, // Will be updated after upload
      createdAt: Date.now(),
      isDownloaded: true, // Local recording is always available
    };

    // Store voice note
    await this.storage.addVoiceNote(voiceNote);

    return voiceNote;
  }

  /**
   * Add voice note to message
   */
  async addVoiceNoteToMessage(messageId: string, voiceNote: VoiceNote): Promise<void> {
    voiceNote.messageId = messageId;
    await this.storage.updateVoiceNote(voiceNote);
  }

  /**
   * Get voice note
   */
  async getVoiceNote(voiceNoteId: string): Promise<VoiceNote | null> {
    return await this.storage.getVoiceNote(voiceNoteId);
  }

  /**
   * Get all voice notes in a chat
   */
  async getVoiceNotesForChat(chatId: string): Promise<VoiceNote[]> {
    return await this.storage.getVoiceNotesForChat(chatId);
  }

  /**
   * Delete voice note
   */
  async deleteVoiceNote(voiceNoteId: string): Promise<void> {
    const voiceNote = await this.storage.getVoiceNote(voiceNoteId);
    if (!voiceNote) throw new Error(`Voice note ${voiceNoteId} not found`);

    // Delete file from storage (platform-specific)
    // This would be handled by the media downloader

    // Delete record
    await this.storage.deleteVoiceNote(voiceNoteId);
  }

  /**
   * Start recording
   */
  async startRecording(options?: VoiceRecorderOptions): Promise<void> {
    if (this.recorder.isRecording()) {
      throw new Error('Recording already in progress');
    }

    await this.recorder.startRecording(options);
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<{ filePath: string; duration: number }> {
    if (!this.recorder.isRecording()) {
      throw new Error('No recording in progress');
    }

    return await this.recorder.stopRecording();
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<void> {
    if (!this.recorder.isRecording()) {
      throw new Error('No recording in progress');
    }

    await this.recorder.pauseRecording();
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<void> {
    await this.recorder.resumeRecording();
  }

  /**
   * Cancel recording
   */
  async cancelRecording(): Promise<void> {
    await this.recorder.cancelRecording();
  }

  /**
   * Get recording status
   */
  getRecordingStatus(): {
    isRecording: boolean;
    duration: number;
  } {
    return {
      isRecording: this.recorder.isRecording(),
      duration: this.recorder.getDuration(),
    };
  }

  /**
   * Get MIME type from format
   */
  private getMimeType(format?: string): string {
    const mimeTypes: { [key: string]: string } = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
    };

    return mimeTypes[format || 'mp3'];
  }

  /**
   * Get total voice notes size
   */
  async getTotalVoiceNotesSize(chatId: string): Promise<number> {
    const voiceNotes = await this.storage.getVoiceNotesForChat(chatId);
    return voiceNotes.reduce((total, note) => total + note.size, 0);
  }

  /**
   * Convert voice note to message attachment
   */
  async voiceNoteToAttachment(voiceNoteId: string): Promise<any> {
    const voiceNote = await this.storage.getVoiceNote(voiceNoteId);
    if (!voiceNote) throw new Error(`Voice note ${voiceNoteId} not found`);

    return {
      id: voiceNote.id,
      messageId: voiceNote.messageId,
      type: 'voiceNote',
      originalName: voiceNote.originalName,
      mimeType: voiceNote.mimeType,
      size: voiceNote.size,
      localPath: voiceNote.localPath,
      duration: voiceNote.duration,
      createdAt: voiceNote.createdAt,
    };
  }
}

/**
 * File type utilities for different file types
 */
export class FileTypeManager {
  static readonly FILE_TYPES = {
    image: {
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
      maxSize: 50 * 1024 * 1024, // 50 MB
    },
    video: {
      extensions: ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'],
      mimeTypes: ['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/x-flv'],
      maxSize: 500 * 1024 * 1024, // 500 MB
    },
    audio: {
      extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac'],
      maxSize: 100 * 1024 * 1024, // 100 MB
    },
    pdf: {
      extensions: ['.pdf'],
      mimeTypes: ['application/pdf'],
      maxSize: 100 * 1024 * 1024, // 100 MB
    },
    document: {
      extensions: ['.doc', '.docx', '.txt', '.rtf', '.odt'],
      mimeTypes: [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
        'application/vnd.oasis.opendocument.text',
      ],
      maxSize: 50 * 1024 * 1024, // 50 MB
    },
    spreadsheet: {
      extensions: ['.xls', '.xlsx', '.csv', '.ods'],
      mimeTypes: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/vnd.oasis.opendocument.spreadsheet',
      ],
      maxSize: 50 * 1024 * 1024, // 50 MB
    },
    archive: {
      extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
      mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip'],
      maxSize: 500 * 1024 * 1024, // 500 MB
    },
    voiceNote: {
      extensions: ['.mp3', '.wav', '.m4a', '.ogg'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'],
      maxSize: 50 * 1024 * 1024, // 50 MB
    },
  };

  /**
   * Get file type from MIME type or extension
   */
  static getFileType(mimeTypeOrExtension: string): string | null {
    const lower = mimeTypeOrExtension.toLowerCase();

    for (const [type, config] of Object.entries(this.FILE_TYPES)) {
      if (
        config.mimeTypes.includes(lower) ||
        config.extensions.includes(lower)
      ) {
        return type;
      }
    }

    return null;
  }

  /**
   * Check if file type is allowed
   */
  static isFileTypeAllowed(fileType: string): boolean {
    return fileType in this.FILE_TYPES;
  }

  /**
   * Check if file size is within limits
   */
  static isFileSizeValid(fileType: string, fileSize: number): boolean {
    const config = this.FILE_TYPES[fileType as keyof typeof this.FILE_TYPES];
    if (!config) return false;
    return fileSize <= config.maxSize;
  }

  /**
   * Get file type info
   */
  static getFileTypeInfo(fileType: string): any {
    return this.FILE_TYPES[fileType as keyof typeof this.FILE_TYPES] || null;
  }

  /**
   * Get max file size for type (in MB)
   */
  static getMaxFileSizeMB(fileType: string): number {
    const config = this.FILE_TYPES[fileType as keyof typeof this.FILE_TYPES];
    if (!config) return 0;
    return config.maxSize / (1024 * 1024);
  }
}
