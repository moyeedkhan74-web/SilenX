/**
 * Web Storage Adapter
 * Uses IndexedDB via Dexie.js for client-side storage
 */

import { IStorage, Contact, Chat, Message, MediaMetadata } from '@silenx/core';

/**
 * Dexie IndexedDB Storage Implementation for Web
 * Requires: npm install dexie
 */
export class DexieStorage implements IStorage {
  private db: any; // Dexie database instance

  constructor(db: any) {
    this.db = db;
  }

  // ============ CONTACTS ============

  async addContact(contact: Contact): Promise<void> {
    await this.db.contacts.add(contact);
  }

  async getContact(id: string): Promise<Contact | null> {
    return (await this.db.contacts.get(id)) || null;
  }

  async getAllContacts(userId: string): Promise<Contact[]> {
    return await this.db.contacts.where('userId').equals(userId).toArray();
  }

  async updateContact(contact: Contact): Promise<void> {
    await this.db.contacts.put(contact);
  }

  async deleteContact(id: string): Promise<void> {
    await this.db.contacts.delete(id);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    const lowerQuery = query.toLowerCase();
    return await this.db.contacts
      .filter(
        (c: Contact) =>
          c.name.toLowerCase().includes(lowerQuery) ||
          (c.phoneNumber?.toLowerCase().includes(lowerQuery) || false) ||
          (c.email?.toLowerCase().includes(lowerQuery) || false)
      )
      .toArray();
  }

  // ============ CHATS ============

  async addChat(chat: Chat): Promise<void> {
    await this.db.chats.add(chat);
  }

  async getChat(id: string): Promise<Chat | null> {
    return (await this.db.chats.get(id)) || null;
  }

  async getAllChats(userId: string): Promise<Chat[]> {
    return await this.db.chats.where('userId').equals(userId).toArray();
  }

  async updateChat(chat: Chat): Promise<void> {
    await this.db.chats.put(chat);
  }

  async deleteChat(id: string): Promise<void> {
    await this.db.chats.delete(id);
  }

  // ============ MESSAGES ============

  async addMessage(message: Message): Promise<void> {
    await this.db.messages.add(message);
  }

  async getMessage(id: string): Promise<Message | null> {
    return (await this.db.messages.get(id)) || null;
  }

  async getMessagesForChat(
    chatId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    return await this.db.messages
      .where('chatId')
      .equals(chatId)
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray();
  }

  async updateMessage(message: Message): Promise<void> {
    await this.db.messages.put(message);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.messages.delete(id);
  }

  // ============ MEDIA METADATA ============

  async addMediaMetadata(media: MediaMetadata): Promise<void> {
    await this.db.mediaMetadata.add(media);
  }

  async getMediaMetadata(id: string): Promise<MediaMetadata | null> {
    return (await this.db.mediaMetadata.get(id)) || null;
  }

  async getMediaMetadataForMessage(messageId: string): Promise<MediaMetadata[]> {
    return await this.db.mediaMetadata
      .where('messageId')
      .equals(messageId)
      .toArray();
  }

  async updateMediaMetadata(media: MediaMetadata): Promise<void> {
    await this.db.mediaMetadata.put(media);
  }

  async deleteMediaMetadata(id: string): Promise<void> {
    await this.db.mediaMetadata.delete(id);
  }

  // ============ BATCH OPERATIONS ============

  async clear(): Promise<void> {
    await this.db.contacts.clear();
    await this.db.chats.clear();
    await this.db.messages.clear();
    await this.db.mediaMetadata.clear();
  }

  async exportData(): Promise<any> {
    const contacts = await this.db.contacts.toArray();
    const chats = await this.db.chats.toArray();
    const messages = await this.db.messages.toArray();
    const mediaMetadata = await this.db.mediaMetadata.toArray();

    return {
      contacts,
      chats,
      messages,
      mediaMetadata,
      settings: {},
    };
  }

  async importData(data: any): Promise<void> {
    await this.clear();

    if (data.contacts?.length) {
      await this.db.contacts.bulkAdd(data.contacts);
    }
    if (data.chats?.length) {
      await this.db.chats.bulkAdd(data.chats);
    }
    if (data.messages?.length) {
      await this.db.messages.bulkAdd(data.messages);
    }
    if (data.mediaMetadata?.length) {
      await this.db.mediaMetadata.bulkAdd(data.mediaMetadata);
    }
  }
}

/**
 * Initialize IndexedDB with Dexie
 */
export function initializeDexie() {
  const Dexie = require('dexie').default;

  const db = new Dexie('SilenX');

  db.version(1).stores({
    contacts: '++id, userId',
    chats: '++id, userId',
    messages: '++id, chatId, timestamp',
    mediaMetadata: '++id, messageId, downloadStatus',
  });

  return db;
}
