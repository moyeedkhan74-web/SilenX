import { saveOfflineMessage as saveOfflineMessageDb, saveOfflineMessages as saveOfflineMessagesDb, deleteOfflineMessage as deleteOfflineMessageDb, getOfflineMessages as getOfflineMessagesDb, getAllOfflineMessages as getAllOfflineMessagesDb, saveConversationsCache as saveConversationsCacheDb, getConversationsCache as getConversationsCacheDb, deleteConversationCache as deleteConversationCacheDb, saveDraft as saveDraftDb, getDraft as getDraftDb, clearDraft as clearDraftDb, queueOutgoing, listPendingOutgoing, getOutgoing, removeOutgoing, markOutgoingSending, requeueAllSending, getPendingCount } from '../utils/offlineDb';
import type { ChatMessage, Conversation } from '../types';
import type { OutgoingEntry } from '../utils/offlineDb';

/**
 * High-level IndexedDB persistence service.
 *
 * Wraps the lower-level `offlineDb` utilities so the rest of the app can
 * import a single service for all offline-first storage concerns:
 *  - conversations cache
 *  - messages cache
 *  - drafts
 *  - outgoing queue
 */
export class DbService {
  // ── Messages ────────────────────────────────────────────────────────────────

  async saveMessage(message: ChatMessage): Promise<void> {
    await saveOfflineMessageDb(message);
  }

  async saveMessages(messages: ChatMessage[]): Promise<void> {
    await saveOfflineMessagesDb(messages);
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    return getOfflineMessagesDb(conversationId);
  }

  async getAllMessages(): Promise<ChatMessage[]> {
    return getAllOfflineMessagesDb();
  }

  async deleteMessage(id: string): Promise<void> {
    await deleteOfflineMessageDb(id);
  }

  // ── Conversations ───────────────────────────────────────────────────────────

  async saveConversations(conversations: Conversation[]): Promise<void> {
    await saveConversationsCacheDb(conversations);
  }

  async getConversations(userId?: string): Promise<Conversation[]> {
    return getConversationsCacheDb(userId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await deleteConversationCacheDb(conversationId);
  }

  // ── Drafts ──────────────────────────────────────────────────────────────────

  async saveDraft(conversationId: string, text: string): Promise<void> {
    await saveDraftDb(conversationId, text);
  }

  async getDraft(conversationId: string): Promise<string> {
    return getDraftDb(conversationId);
  }

  async clearDraft(conversationId: string): Promise<void> {
    await clearDraftDb(conversationId);
  }

  // ── Outbox ──────────────────────────────────────────────────────────────────

  async enqueueOutgoing(entry: OutgoingEntry): Promise<void> {
    await queueOutgoing(entry);
  }

  async getPendingOutgoing(): Promise<OutgoingEntry[]> {
    return listPendingOutgoing();
  }

  async getOutgoingEntry(tempId: string): Promise<OutgoingEntry | undefined> {
    return getOutgoing(tempId);
  }

  async removeOutgoingEntry(tempId: string): Promise<void> {
    await removeOutgoing(tempId);
  }

  async markOutgoingAsSending(tempId: string): Promise<void> {
    await markOutgoingSending(tempId);
  }

  async requeueStuckSending(): Promise<void> {
    await requeueAllSending();
  }

  async getPendingOutgoingCount(): Promise<number> {
    return getPendingCount();
  }

  // ── Hydration helpers ───────────────────────────────────────────────────────

  async hydrateConversations(userId: string): Promise<Conversation[]> {
    const conversations = await this.getConversations(userId);
    return conversations;
  }

  async hydrateMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.getMessages(conversationId);
  }
}

export const dbService = new DbService();
