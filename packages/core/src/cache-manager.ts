/**
 * Cache Manager
 * In-memory cache with TTL and auto-cleanup
 * Syncs with persistent storage
 */

import { CacheItem, CacheConfig, Contact, Chat, Message, MediaMetadata } from './types';

export class CacheManager {
  private cache: Map<string, CacheItem<any>> = new Map();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 24 * 60 * 60 * 1000, // 24 hours default
      maxSize: 1000,
      autoCleanup: true,
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      ...config,
    };

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Store item in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttl || this.config.ttl);
    this.cache.set(key, {
      data: value,
      expiresAt,
      createdAt: Date.now(),
    });
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Check if key exists and not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    itemCount: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      itemCount: this.cache.size,
    };
  }

  /**
   * Auto-cleanup expired items
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * Remove all expired items
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((item, key) => {
      if (now > item.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Evict oldest item when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((item, key) => {
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Stop auto-cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Specialized cache for specific data types
 */
export class TypedCacheManager {
  private contactsCache = new CacheManager({ ttl: 60 * 60 * 1000 }); // 1 hour
  private chatsCache = new CacheManager({ ttl: 30 * 60 * 1000 }); // 30 mins
  private messagesCache = new CacheManager({ ttl: 24 * 60 * 60 * 1000 }); // 24 hours
  private mediaCache = new CacheManager({ ttl: 7 * 24 * 60 * 60 * 1000 }); // 7 days

  // Contact operations
  setContact(contact: Contact): void {
    this.contactsCache.set(`contact:${contact.id}`, contact);
    this.contactsCache.set(`contacts:${contact.userId}`, null); // Invalidate list cache
  }

  getContact(id: string): Contact | null {
    return this.contactsCache.get(`contact:${id}`);
  }

  setContacts(userId: string, contacts: Contact[]): void {
    this.contactsCache.set(`contacts:${userId}`, contacts);
  }

  getContacts(userId: string): Contact[] | null {
    return this.contactsCache.get(`contacts:${userId}`);
  }

  invalidateContacts(userId: string): void {
    this.contactsCache.delete(`contacts:${userId}`);
  }

  // Chat operations
  setChat(chat: Chat): void {
    this.chatsCache.set(`chat:${chat.id}`, chat);
    this.chatsCache.set(`chats:${chat.userId}`, null); // Invalidate list cache
  }

  getChat(id: string): Chat | null {
    return this.chatsCache.get(`chat:${id}`);
  }

  setChats(userId: string, chats: Chat[]): void {
    this.chatsCache.set(`chats:${userId}`, chats);
  }

  getChats(userId: string): Chat[] | null {
    return this.chatsCache.get(`chats:${userId}`);
  }

  invalidateChats(userId: string): void {
    this.chatsCache.delete(`chats:${userId}`);
  }

  // Message operations
  setMessage(message: Message): void {
    this.messagesCache.set(`message:${message.id}`, message);
    this.messagesCache.set(`messages:${message.chatId}`, null); // Invalidate list cache
  }

  getMessage(id: string): Message | null {
    return this.messagesCache.get(`message:${id}`);
  }

  setMessages(chatId: string, messages: Message[]): void {
    this.messagesCache.set(`messages:${chatId}`, messages);
  }

  getMessages(chatId: string): Message[] | null {
    return this.messagesCache.get(`messages:${chatId}`);
  }

  invalidateMessages(chatId: string): void {
    this.messagesCache.delete(`messages:${chatId}`);
  }

  // Media operations
  setMediaMetadata(media: MediaMetadata): void {
    this.mediaCache.set(`media:${media.id}`, media);
  }

  getMediaMetadata(id: string): MediaMetadata | null {
    return this.mediaCache.get(`media:${id}`);
  }

  setMediaList(messageId: string, mediaList: MediaMetadata[]): void {
    this.mediaCache.set(`media_list:${messageId}`, mediaList);
  }

  getMediaList(messageId: string): MediaMetadata[] | null {
    return this.mediaCache.get(`media_list:${messageId}`);
  }

  invalidateMedia(id: string): void {
    this.mediaCache.delete(`media:${id}`);
  }

  // Utility methods
  clearAll(): void {
    this.contactsCache.clear();
    this.chatsCache.clear();
    this.messagesCache.clear();
    this.mediaCache.clear();
  }

  destroy(): void {
    this.contactsCache.destroy();
    this.chatsCache.destroy();
    this.messagesCache.destroy();
    this.mediaCache.destroy();
  }

  getStats() {
    return {
      contacts: this.contactsCache.getStats(),
      chats: this.chatsCache.getStats(),
      messages: this.messagesCache.getStats(),
      media: this.mediaCache.getStats(),
    };
  }
}
