import { User, Conversation, ConversationMember, Message, ContactRequest, FriendRequest, Friend } from '../types';

// In-Memory Database — starts empty, populated from db.json on startup
export const users: User[] = [];

export const conversations: Conversation[] = [];

export const conversationMembers: ConversationMember[] = [];

export const messages: Message[] = [];

import fs from 'fs';
import path from 'path';

export const contactRequests: ContactRequest[] = [];

export const friendRequests: FriendRequest[] = [];

export const friends: Friend[] = [];

const DB_FILE = path.join(__dirname, '../../db.json');

export function saveDb() {
  try {
    const data = {
      users,
      conversations,
      conversationMembers,
      messages,
      friendRequests,
      friends
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Failed to save db.json:', err);
  }
}

export function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (data.users) {
        users.length = 0;
        users.push(...data.users.map((u: any) => ({
          ...u,
          lastSeen: u.lastSeen ? new Date(u.lastSeen) : new Date(),
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
          deletedAt: u.deletedAt ? new Date(u.deletedAt) : null,
        })));
      }
      if (data.conversations) {
        conversations.length = 0;
        conversations.push(...data.conversations.map((c: any) => ({
          ...c,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        })));
      }
      if (data.conversationMembers) {
        conversationMembers.length = 0;
        conversationMembers.push(...data.conversationMembers.map((m: any) => ({
          ...m,
          joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
          leftAt: m.leftAt ? new Date(m.leftAt) : null,
        })));
      }
      if (data.messages) {
        messages.length = 0;
        messages.push(...data.messages.map((m: any) => ({
          ...m,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          editedAt: m.editedAt ? new Date(m.editedAt) : null,
          deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
        })));
      }
      if (data.friendRequests) {
        friendRequests.length = 0;
        friendRequests.push(...data.friendRequests.map((r: any) => ({
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
        })));
      }
      if (data.friends) {
        friends.length = 0;
        friends.push(...data.friends.map((f: any) => ({
          ...f,
          createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
        })));
      }
      console.log('[DB] Loaded persistent database state from db.json');
    } catch (err) {
      console.error('[DB] Failed to load db.json, using defaults:', err);
    }
  }
}

// Automatically load database on start
loadDb();

