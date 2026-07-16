/**
 * Desktop (Electron) Storage Adapter
 * Uses SQLite for persistent local storage
 */

import {
  IStorage,
  Contact,
  Chat,
  Message,
  MediaMetadata,
} from '@silenx/core';

/**
 * SQLite Storage Implementation for Electron
 * Uses better-sqlite3 for synchronous operations
 */
export class ElectronSQLiteStorage implements IStorage {
  private db: any; // Would be better-sqlite3 Database instance
  private dbPath: string;

  constructor(dbPath: string, db: any) {
    this.dbPath = dbPath;
    this.db = db;
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        phoneNumber TEXT,
        email TEXT,
        avatar TEXT,
        status TEXT DEFAULT 'offline',
        lastSeen INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        isBlocked BOOLEAN DEFAULT 0,
        isFavorite BOOLEAN DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_userId ON contacts(userId);

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        participantIds TEXT NOT NULL,
        chatName TEXT,
        lastMessage TEXT,
        lastMessageTime INTEGER,
        unreadCount INTEGER DEFAULT 0,
        isPinned BOOLEAN DEFAULT 0,
        isMuted BOOLEAN DEFAULT 0,
        isArchived BOOLEAN DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chats_userId ON chats(userId);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        timestamp INTEGER NOT NULL,
        editedAt INTEGER,
        isDeleted BOOLEAN DEFAULT 0,
        deletedAt INTEGER,
        isPinned BOOLEAN DEFAULT 0,
        pinnedAt INTEGER,
        pinnedBy TEXT,
        FOREIGN KEY(chatId) REFERENCES chats(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
      CREATE INDEX IF NOT EXISTS idx_messages_isPinned ON messages(isPinned);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

      CREATE TABLE IF NOT EXISTS voice_notes (
        id TEXT PRIMARY KEY,
        messageId TEXT,
        chatId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        duration INTEGER NOT NULL,
        originalName TEXT NOT NULL,
        filePath TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        size INTEGER NOT NULL,
        isDownloaded BOOLEAN DEFAULT 1,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(chatId) REFERENCES chats(id),
        FOREIGN KEY(messageId) REFERENCES messages(id)
      );

      CREATE INDEX IF NOT EXISTS idx_voice_notes_chatId ON voice_notes(chatId);
      CREATE INDEX IF NOT EXISTS idx_voice_notes_messageId ON voice_notes(messageId);

      CREATE TABLE IF NOT EXISTS media_metadata (
        id TEXT PRIMARY KEY,
        mediaId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        filePath TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        mimeType TEXT NOT NULL,
        downloadStatus TEXT DEFAULT 'pending',
        downloadProgress INTEGER DEFAULT 0,
        downloadedAt INTEGER,
        isDeleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(messageId) REFERENCES messages(id)
      );

      CREATE INDEX IF NOT EXISTS idx_media_messageId ON media_metadata(messageId);
      CREATE INDEX IF NOT EXISTS idx_media_status ON media_metadata(downloadStatus);
    `);
  }

  // ============ CONTACTS ============

  async addContact(contact: Contact): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO contacts (
        id, userId, name, phoneNumber, email, avatar, status,
        lastSeen, createdAt, updatedAt, isBlocked, isFavorite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      contact.id,
      contact.userId,
      contact.name,
      contact.phoneNumber || null,
      contact.email || null,
      contact.avatar || null,
      contact.status || 'offline',
      contact.lastSeen || null,
      contact.createdAt,
      contact.updatedAt,
      contact.isBlocked ? 1 : 0,
      contact.isFavorite ? 1 : 0
    );
  }

  async getContact(id: string): Promise<Contact | null> {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToContact(row) : null;
  }

  async getAllContacts(userId: string): Promise<Contact[]> {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE userId = ?');
    const rows = stmt.all(userId);
    return rows.map((row: any) => this.rowToContact(row));
  }

  async updateContact(contact: Contact): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE contacts SET
        name = ?, phoneNumber = ?, email = ?, avatar = ?, status = ?,
        lastSeen = ?, updatedAt = ?, isBlocked = ?, isFavorite = ?
      WHERE id = ?
    `);

    stmt.run(
      contact.name,
      contact.phoneNumber || null,
      contact.email || null,
      contact.avatar || null,
      contact.status || 'offline',
      contact.lastSeen || null,
      contact.updatedAt,
      contact.isBlocked ? 1 : 0,
      contact.isFavorite ? 1 : 0,
      contact.id
    );
  }

  async deleteContact(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM contacts WHERE id = ?');
    stmt.run(id);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM contacts
      WHERE name LIKE ? OR phoneNumber LIKE ? OR email LIKE ?
    `);
    const searchQuery = `%${query}%`;
    const rows = stmt.all(searchQuery, searchQuery, searchQuery);
    return rows.map((row: any) => this.rowToContact(row));
  }

  // ============ CHATS ============

  async addChat(chat: Chat): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO chats (
        id, userId, participantIds, chatName, lastMessage, lastMessageTime,
        unreadCount, isPinned, isMuted, isArchived, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      chat.id,
      chat.userId,
      JSON.stringify(chat.participantIds),
      chat.chatName || null,
      chat.lastMessage || null,
      chat.lastMessageTime || null,
      chat.unreadCount,
      chat.isPinned ? 1 : 0,
      chat.isMuted ? 1 : 0,
      chat.isArchived ? 1 : 0,
      chat.createdAt,
      chat.updatedAt
    );
  }

  async getChat(id: string): Promise<Chat | null> {
    const stmt = this.db.prepare('SELECT * FROM chats WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToChat(row) : null;
  }

  async getAllChats(userId: string): Promise<Chat[]> {
    const stmt = this.db.prepare('SELECT * FROM chats WHERE userId = ?');
    const rows = stmt.all(userId);
    return rows.map((row: any) => this.rowToChat(row));
  }

  async updateChat(chat: Chat): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE chats SET
        chatName = ?, lastMessage = ?, lastMessageTime = ?, unreadCount = ?,
        isPinned = ?, isMuted = ?, isArchived = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(
      chat.chatName || null,
      chat.lastMessage || null,
      chat.lastMessageTime || null,
      chat.unreadCount,
      chat.isPinned ? 1 : 0,
      chat.isMuted ? 1 : 0,
      chat.isArchived ? 1 : 0,
      chat.updatedAt,
      chat.id
    );
  }

  async deleteChat(id: string): Promise<void> {
    // Delete associated messages first
    const deleteMessages = this.db.prepare('DELETE FROM messages WHERE chatId = ?');
    deleteMessages.run(id);

    // Delete chat
    const deleteChat = this.db.prepare('DELETE FROM chats WHERE id = ?');
    deleteChat.run(id);
  }

  // ============ MESSAGES ============

  async addMessage(message: Message): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, chatId, senderId, content, status, timestamp, editedAt, isDeleted, deletedAt, isPinned, pinnedAt, pinnedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.chatId,
      message.senderId,
      message.content,
      message.status,
      message.timestamp,
      message.editedAt || null,
      message.isDeleted ? 1 : 0,
      message.deletedAt || null,
      message.isPinned ? 1 : 0,
      message.pinnedAt || null,
      message.pinnedBy || null
    );
  }

  async getMessage(id: string): Promise<Message | null> {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToMessage(row) : null;
  }

  async getMessagesForChat(
    chatId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE chatId = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(chatId, limit, offset);
    return rows.map((row: any) => this.rowToMessage(row));
  }

  async updateMessage(message: Message): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET
        content = ?, status = ?, editedAt = ?, isDeleted = ?, deletedAt = ?, isPinned = ?, pinnedAt = ?, pinnedBy = ?
      WHERE id = ?
    `);

    stmt.run(
      message.content,
      message.status,
      message.editedAt || null,
      message.isDeleted ? 1 : 0,
      message.deletedAt || null,
      message.isPinned ? 1 : 0,
      message.pinnedAt || null,
      message.pinnedBy || null,
      message.id
    );
  }

  async deleteMessage(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    stmt.run(id);
  }

  // ============ MEDIA METADATA ============

  async addMediaMetadata(media: MediaMetadata): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO media_metadata (
        id, mediaId, messageId, fileName, filePath, fileSize, mimeType,
        downloadStatus, downloadProgress, downloadedAt, isDeleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      media.id,
      media.mediaId,
      media.messageId,
      media.fileName,
      media.filePath,
      media.fileSize,
      media.mimeType,
      media.downloadStatus,
      media.downloadProgress,
      media.downloadedAt || null,
      media.isDeleted ? 1 : 0
    );
  }

  async getMediaMetadata(id: string): Promise<MediaMetadata | null> {
    const stmt = this.db.prepare('SELECT * FROM media_metadata WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToMediaMetadata(row) : null;
  }

  async getMediaMetadataForMessage(messageId: string): Promise<MediaMetadata[]> {
    const stmt = this.db.prepare('SELECT * FROM media_metadata WHERE messageId = ?');
    const rows = stmt.all(messageId);
    return rows.map((row: any) => this.rowToMediaMetadata(row));
  }

  async updateMediaMetadata(media: MediaMetadata): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE media_metadata SET
        downloadStatus = ?, downloadProgress = ?, downloadedAt = ?, filePath = ?
      WHERE id = ?
    `);

    stmt.run(
      media.downloadStatus,
      media.downloadProgress,
      media.downloadedAt || null,
      media.filePath,
      media.id
    );
  }

  async deleteMediaMetadata(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM media_metadata WHERE id = ?');
    stmt.run(id);
  }

  // ============ MESSAGE PINNING ============

  async getPinnedMessages(chatId: string): Promise<Message[]> {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE chatId = ? AND isPinned = 1 ORDER BY pinnedAt DESC');
    const rows = stmt.all(chatId);
    return rows.map((row: any) => this.rowToMessage(row));
  }

  async pinMessage(messageId: string, pinnedBy: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET isPinned = 1, pinnedAt = ?, pinnedBy = ? WHERE id = ?
    `);
    stmt.run(Date.now(), pinnedBy, messageId);
  }

  async unpinMessage(messageId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages SET isPinned = 0, pinnedAt = NULL, pinnedBy = NULL WHERE id = ?
    `);
    stmt.run(messageId);
  }

  // ============ VOICE NOTES ============

  async addVoiceNote(voiceNote: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO voice_notes (
        id, messageId, chatId, senderId, duration, originalName, filePath, mimeType, size, isDownloaded, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      voiceNote.id,
      voiceNote.messageId || null,
      voiceNote.chatId,
      voiceNote.senderId,
      voiceNote.duration,
      voiceNote.originalName,
      voiceNote.filePath,
      voiceNote.mimeType,
      voiceNote.size,
      voiceNote.isDownloaded ? 1 : 0,
      voiceNote.createdAt
    );
  }

  async getVoiceNote(id: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM voice_notes WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToVoiceNote(row) : null;
  }

  async getVoiceNotesForChat(chatId: string): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM voice_notes WHERE chatId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(chatId);
    return rows.map((row: any) => this.rowToVoiceNote(row));
  }

  async updateVoiceNote(voiceNote: any): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE voice_notes SET messageId = ?, filePath = ?, size = ?, isDownloaded = ? WHERE id = ?
    `);

    stmt.run(
      voiceNote.messageId || null,
      voiceNote.filePath,
      voiceNote.size,
      voiceNote.isDownloaded ? 1 : 0,
      voiceNote.id
    );
  }

  async deleteVoiceNote(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM voice_notes WHERE id = ?');
    stmt.run(id);
  }

  // ============ BATCH OPERATIONS ============

  async clear(): Promise<void> {
    this.db.exec('DELETE FROM voice_notes; DELETE FROM media_metadata; DELETE FROM messages; DELETE FROM chats; DELETE FROM contacts;');
  }

  async exportData(): Promise<any> {
    const contacts = this.db.prepare('SELECT * FROM contacts').all();
    const chats = this.db.prepare('SELECT * FROM chats').all();
    const messages = this.db.prepare('SELECT * FROM messages').all();
    const mediaMetadata = this.db.prepare('SELECT * FROM media_metadata').all();

    return {
      contacts: contacts.map((row: any) => this.rowToContact(row)),
      chats: chats.map((row: any) => this.rowToChat(row)),
      messages: messages.map((row: any) => this.rowToMessage(row)),
      mediaMetadata: mediaMetadata.map((row: any) => this.rowToMediaMetadata(row)),
      settings: {},
    };
  }

  async importData(data: any): Promise<void> {
    // Clear existing data
    await this.clear();

    // Import contacts
    for (const contact of data.contacts || []) {
      await this.addContact(contact);
    }

    // Import chats
    for (const chat of data.chats || []) {
      await this.addChat(chat);
    }

    // Import messages
    for (const message of data.messages || []) {
      await this.addMessage(message);
    }

    // Import media metadata
    for (const media of data.mediaMetadata || []) {
      await this.addMediaMetadata(media);
    }
  }

  // ============ HELPERS ============

  private rowToContact(row: any): Contact {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      phoneNumber: row.phoneNumber,
      email: row.email,
      avatar: row.avatar,
      status: row.status as any,
      lastSeen: row.lastSeen,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isBlocked: Boolean(row.isBlocked),
      isFavorite: Boolean(row.isFavorite),
    };
  }

  private rowToChat(row: any): Chat {
    return {
      id: row.id,
      userId: row.userId,
      participantIds: JSON.parse(row.participantIds),
      chatName: row.chatName,
      lastMessage: row.lastMessage,
      lastMessageTime: row.lastMessageTime,
      unreadCount: row.unreadCount,
      isPinned: Boolean(row.isPinned),
      isMuted: Boolean(row.isMuted),
      isArchived: Boolean(row.isArchived),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      content: row.content,
      status: row.status as any,
      timestamp: row.timestamp,
      editedAt: row.editedAt,
      isDeleted: Boolean(row.isDeleted),
      deletedAt: row.deletedAt,
      isPinned: Boolean(row.isPinned),
      pinnedAt: row.pinnedAt,
      pinnedBy: row.pinnedBy,
    };
  }

  private rowToMediaMetadata(row: any): MediaMetadata {
    return {
      id: row.id,
      mediaId: row.mediaId,
      messageId: row.messageId,
      fileName: row.fileName,
      filePath: row.filePath,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      downloadStatus: row.downloadStatus as any,
      downloadProgress: row.downloadProgress,
      downloadedAt: row.downloadedAt,
      isDeleted: Boolean(row.isDeleted),
    };
  }

  private rowToVoiceNote(row: any): any {
    return {
      id: row.id,
      messageId: row.messageId,
      chatId: row.chatId,
      senderId: row.senderId,
      duration: row.duration,
      originalName: row.originalName,
      filePath: row.filePath,
      mimeType: row.mimeType,
      size: row.size,
      isDownloaded: Boolean(row.isDownloaded),
      createdAt: row.createdAt,
    };
  }
}
