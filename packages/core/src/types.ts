/**
 * SilenX Core Types
 * Shared data models for all platforms (Desktop, Web, Mobile)
 */

// ============ CONTACTS ============
export interface Contact {
  id: string;
  userId: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'away';
  lastSeen?: number;
  createdAt: number;
  updatedAt: number;
  isBlocked: boolean;
  isFavorite: boolean;
}

// ============ CHATS ============
export interface Chat {
  id: string;
  userId: string;
  participantIds: string[]; // For group chats
  chatName?: string; // For group chats
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============ MESSAGES ============
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  mediaItems?: MediaAttachment[];
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: number;
  editedAt?: number;
  isDeleted: boolean;
  deletedAt?: number;
  isPinned: boolean;
  pinnedAt?: number;
  pinnedBy?: string;
}

// ============ MEDIA ============
export interface MediaAttachment {
  id: string;
  messageId: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'file' | 'pdf' | 'location' | 'voiceNote';
  originalName: string;
  mimeType: string;
  size: number;
  url?: string; // Temporary server URL
  localPath?: string; // Downloaded file path
  thumbnailUrl?: string;
  thumbnailPath?: string;
  duration?: number; // For video/audio/voiceNote (seconds)
  latitude?: number; // For location
  longitude?: number; // For location
  locationAddress?: string; // Human-readable address
  createdAt: number;
}

export interface VoiceNote {
  id: string;
  messageId: string;
  chatId: string;
  senderId: string;
  duration: number; // in seconds
  originalName: string;
  filePath: string;
  localPath?: string;
  mimeType: string; // audio/mp3, audio/wav, audio/m4a, etc.
  size: number;
  createdAt: number;
  isDownloaded: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number; // in meters
}

export interface FileTypeConfig {
  type: MediaAttachment['type'];
  mimeTypes: string[];
  extensions: string[];
  maxSize: number; // in bytes
  canPreview: boolean;
}

export interface MediaMetadata {
  id: string;
  mediaId: string;
  messageId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed';
  downloadProgress: number; // 0-100
  downloadedAt?: number;
  isDeleted: boolean;
}

// ============ BACKUP ============
export interface BackupData {
  metadata: {
    version: string;
    timestamp: number;
    platform: 'desktop' | 'web' | 'mobile';
    encrypted: boolean;
    encryptionVersion?: string;
  };
  contacts: Contact[];
  chats: Chat[];
  messages: Message[];
  mediaMetadata: MediaMetadata[];
  settings: Record<string, any>;
}

export interface BackupOptions {
  includeMedia: boolean;
  encryption: boolean;
  compressionLevel: 'none' | 'default' | 'high';
  destination: 'local' | 'google-drive' | 'icloud' | 'onedrive';
}

// ============ CACHE ============
export interface CacheItem<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Max items in cache
  autoCleanup: boolean;
  cleanupInterval: number; // milliseconds
}

// ============ STORAGE ABSTRACTION ============
export interface IStorage {
  // Contacts
  addContact(contact: Contact): Promise<void>;
  getContact(id: string): Promise<Contact | null>;
  getAllContacts(userId: string): Promise<Contact[]>;
  updateContact(contact: Contact): Promise<void>;
  deleteContact(id: string): Promise<void>;
  searchContacts(query: string): Promise<Contact[]>;

  // Chats
  addChat(chat: Chat): Promise<void>;
  getChat(id: string): Promise<Chat | null>;
  getAllChats(userId: string): Promise<Chat[]>;
  updateChat(chat: Chat): Promise<void>;
  deleteChat(id: string): Promise<void>;

  // Messages
  addMessage(message: Message): Promise<void>;
  getMessage(id: string): Promise<Message | null>;
  getMessagesForChat(chatId: string, limit?: number, offset?: number): Promise<Message[]>;
  updateMessage(message: Message): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  getPinnedMessages(chatId: string): Promise<Message[]>;
  pinMessage(messageId: string, pinnedBy: string): Promise<void>;
  unpinMessage(messageId: string): Promise<void>;

  // Media Metadata
  addMediaMetadata(media: MediaMetadata): Promise<void>;
  getMediaMetadata(id: string): Promise<MediaMetadata | null>;
  getMediaMetadataForMessage(messageId: string): Promise<MediaMetadata[]>;
  updateMediaMetadata(media: MediaMetadata): Promise<void>;
  deleteMediaMetadata(id: string): Promise<void>;

  // Voice Notes
  addVoiceNote(voiceNote: VoiceNote): Promise<void>;
  getVoiceNote(id: string): Promise<VoiceNote | null>;
  getVoiceNotesForChat(chatId: string): Promise<VoiceNote[]>;
  updateVoiceNote(voiceNote: VoiceNote): Promise<void>;
  deleteVoiceNote(id: string): Promise<void>;

  // Batch operations
  clear(): Promise<void>;
  exportData(): Promise<any>;
  importData(data: any): Promise<void>;
}

// ============ DOWNLOAD MANAGER ============
export interface DownloadOptions {
  url: string;
  fileName: string;
  mediaId: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  resumable?: boolean;
}

export interface IMediaDownloader {
  download(options: DownloadOptions): Promise<string>; // Returns file path
  pause(mediaId: string): Promise<void>;
  resume(mediaId: string): Promise<void>;
  cancel(mediaId: string): Promise<void>;
  getDownloadStatus(mediaId: string): Promise<MediaMetadata | null>;
}

// ============ VOICE RECORDER ============
export interface VoiceRecorderOptions {
  format?: 'mp3' | 'wav' | 'm4a';
  bitrate?: number;
  sampleRate?: number;
  onStart?: () => void;
  onStop?: (filePath: string, duration: number) => void;
  onError?: (error: Error) => void;
  onProgress?: (duration: number) => void;
}

export interface IVoiceRecorder {
  startRecording(options?: VoiceRecorderOptions): Promise<void>;
  stopRecording(): Promise<{ filePath: string; duration: number }>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  cancelRecording(): Promise<void>;
  isRecording(): boolean;
  getDuration(): number;
}

// ============ BACKUP ENGINE ============
export interface IBackupEngine {
  createBackup(options: BackupOptions): Promise<Blob | Buffer>; // Returns encrypted backup
  restoreBackup(backupData: Blob | Buffer, password: string): Promise<BackupData>;
  exportToJSON(): Promise<string>;
  importFromJSON(jsonData: string): Promise<void>;
}
