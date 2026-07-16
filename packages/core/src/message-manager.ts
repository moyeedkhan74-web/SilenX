/**
 * Message Manager
 * Handles message operations including pinning
 */

import { Message, IStorage } from './types';

export class MessageManager {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Add a message
   */
  async addMessage(message: Message): Promise<void> {
    message.isPinned = false;
    await this.storage.addMessage(message);
  }

  /**
   * Get a message
   */
  async getMessage(messageId: string): Promise<Message | null> {
    return await this.storage.getMessage(messageId);
  }

  /**
   * Get messages for a chat with pagination
   */
  async getMessagesForChat(
    chatId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    return await this.storage.getMessagesForChat(chatId, limit, offset);
  }

  /**
   * Update a message
   */
  async updateMessage(message: Message): Promise<void> {
    await this.storage.updateMessage(message);
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.storage.deleteMessage(messageId);
  }

  /**
   * Pin a message
   */
  async pinMessage(messageId: string, pinnedBy: string): Promise<void> {
    const message = await this.storage.getMessage(messageId);
    if (!message) throw new Error(`Message ${messageId} not found`);

    message.isPinned = true;
    message.pinnedAt = Date.now();
    message.pinnedBy = pinnedBy;

    await this.storage.pinMessage(messageId, pinnedBy);
  }

  /**
   * Unpin a message
   */
  async unpinMessage(messageId: string): Promise<void> {
    const message = await this.storage.getMessage(messageId);
    if (!message) throw new Error(`Message ${messageId} not found`);

    message.isPinned = false;
    message.pinnedAt = undefined;
    message.pinnedBy = undefined;

    await this.storage.unpinMessage(messageId);
  }

  /**
   * Get all pinned messages in a chat
   */
  async getPinnedMessages(chatId: string): Promise<Message[]> {
    return await this.storage.getPinnedMessages(chatId);
  }

  /**
   * Check if message is pinned
   */
  async isMessagePinned(messageId: string): Promise<boolean> {
    const message = await this.storage.getMessage(messageId);
    return message ? message.isPinned : false;
  }

  /**
   * Get pinned messages count
   */
  async getPinnedCount(chatId: string): Promise<number> {
    const pinned = await this.storage.getPinnedMessages(chatId);
    return pinned.length;
  }

  /**
   * Soft delete a message (mark as deleted but keep data)
   */
  async softDeleteMessage(messageId: string): Promise<void> {
    const message = await this.storage.getMessage(messageId);
    if (!message) throw new Error(`Message ${messageId} not found`);

    message.isDeleted = true;
    message.deletedAt = Date.now();

    await this.storage.updateMessage(message);
  }

  /**
   * Permanently delete a message (including media)
   */
  async permanentlyDeleteMessage(messageId: string): Promise<void> {
    const message = await this.storage.getMessage(messageId);
    if (!message) throw new Error(`Message ${messageId} not found`);

    // Delete associated media
    if (message.mediaItems && message.mediaItems.length > 0) {
      for (const media of message.mediaItems) {
        await this.storage.deleteMediaMetadata(media.id);
      }
    }

    // Delete message
    await this.storage.deleteMessage(messageId);
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, newContent: string): Promise<void> {
    const message = await this.storage.getMessage(messageId);
    if (!message) throw new Error(`Message ${messageId} not found`);

    message.content = newContent;
    message.editedAt = Date.now();

    await this.storage.updateMessage(message);
  }

  /**
   * Search messages in chat
   */
  async searchMessagesInChat(chatId: string, query: string): Promise<Message[]> {
    const messages = await this.storage.getMessagesForChat(chatId, 1000, 0);
    return messages.filter(
      (msg) =>
        msg.content.toLowerCase().includes(query.toLowerCase()) && !msg.isDeleted
    );
  }

  /**
   * Get message statistics for a chat
   */
  async getMessageStats(chatId: string): Promise<{
    totalMessages: number;
    pinnedCount: number;
    deletedCount: number;
  }> {
    const messages = await this.storage.getMessagesForChat(chatId, 10000, 0);
    const pinnedMessages = await this.storage.getPinnedMessages(chatId);

    return {
      totalMessages: messages.filter((m) => !m.isDeleted).length,
      pinnedCount: pinnedMessages.length,
      deletedCount: messages.filter((m) => m.isDeleted).length,
    };
  }
}
