import { openDB, IDBPDatabase } from 'idb';
import type { ChatMessage } from '../types';

const DB_NAME = 'silenx_offline_db';
const DB_VERSION = 1;

export interface StoredDraft {
  conversationId: string;
  text: string;
  updatedAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'conversationId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveOfflineMessage(message: ChatMessage): Promise<void> {
  try {
    const db = await getDb();
    await db.put('messages', message);
  } catch (error) {
    console.error('[OfflineDb] Error saving message:', error);
  }
}

export async function saveOfflineMessages(messages: ChatMessage[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('messages', 'readwrite');
    await Promise.all(messages.map(msg => tx.store.put(msg)));
    await tx.done;
  } catch (error) {
    console.error('[OfflineDb] Error batch saving messages:', error);
  }
}

export async function getOfflineMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const db = await getDb();
    return await db.getAllFromIndex('messages', 'conversationId', conversationId);
  } catch (error) {
    console.error('[OfflineDb] Error fetching messages:', error);
    return [];
  }
}

export async function saveDraft(conversationId: string, text: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('drafts', {
      conversationId,
      text,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OfflineDb] Error saving draft:', error);
  }
}

export async function getDraft(conversationId: string): Promise<string> {
  try {
    const db = await getDb();
    const draft = await db.get('drafts', conversationId);
    return draft ? draft.text : '';
  } catch (error) {
    console.error('[OfflineDb] Error getting draft:', error);
    return '';
  }
}

export async function clearDraft(conversationId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('drafts', conversationId);
  } catch (error) {
    console.error('[OfflineDb] Error clearing draft:', error);
  }
}
