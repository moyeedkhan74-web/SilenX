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

import mongoose from 'mongoose';
import { UserModel, ConversationModel, ConversationMemberModel, MessageModel, FriendRequestModel, FriendModel } from './models';

let isSyncing = false;
let hasPendingChanges = false;

async function performSync() {
  if (isSyncing) {
    hasPendingChanges = true;
    return;
  }
  isSyncing = true;
  hasPendingChanges = false;

  try {
    // 1. Always save to local file backup first so we don't lose local state
    const data = {
      users,
      conversations,
      conversationMembers,
      messages,
      friendRequests,
      friends
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('[DB] Saved backup to db.json');

    // 2. Sync to MongoDB only if it is connected
    if (mongoose.connection.readyState === 1) {
      await syncCollection(UserModel, users);
      await syncCollection(ConversationModel, conversations);
      await syncCollection(ConversationMemberModel, conversationMembers);
      await syncCollection(MessageModel, messages);
      await syncCollection(FriendRequestModel, friendRequests);
      await syncCollection(FriendModel, friends);
      console.log('[DB] Synchronized memory store with MongoDB');
    }
  } catch (err) {
    console.error('[DB] Synchronization failed:', err);
  } finally {
    isSyncing = false;
    if (hasPendingChanges) {
      performSync().catch(err => console.error('[DB] saveDb async queue failed:', err));
    }
  }
}

async function syncCollection(Model: any, arr: any[]) {
  const ids = arr.map(e => e.id);
  // Remove items in DB that are not in memory
  await Model.deleteMany({ id: { $nin: ids } });

  if (arr.length > 0) {
    const ops = arr.map(item => {
      const doc = { ...item };
      delete doc._id;
      delete doc.__v;
      return {
        updateOne: {
          filter: { id: item.id },
          update: { $set: doc },
          upsert: true
        }
      };
    });
    await Model.bulkWrite(ops);
  }
}

export function saveDb() {
  performSync().catch(err => console.error('[DB] saveDb sync triggered error:', err));
}

export async function connectDb() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/slienx';
  console.log('[DB] Connecting to MongoDB...', mongoUri.replace(/:([^@]+)@/, ':****@'));
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 45000 });
  console.log('[DB] Connected to MongoDB Atlas success');

  // Seed MongoDB with local db.json if database is completely empty
  const userCount = await UserModel.countDocuments();
  if (userCount === 0 && fs.existsSync(DB_FILE)) {
    console.log('[DB] MongoDB is empty. Seeding from db.json...');
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (data.users && data.users.length > 0) await UserModel.insertMany(data.users);
      if (data.conversations && data.conversations.length > 0) await ConversationModel.insertMany(data.conversations);
      if (data.conversationMembers && data.conversationMembers.length > 0) await ConversationMemberModel.insertMany(data.conversationMembers);
      if (data.messages && data.messages.length > 0) await MessageModel.insertMany(data.messages);
      if (data.friendRequests && data.friendRequests.length > 0) await FriendRequestModel.insertMany(data.friendRequests);
      if (data.friends && data.friends.length > 0) await FriendModel.insertMany(data.friends);
      console.log('[DB] Seed successful!');
    } catch (seedErr) {
      console.error('[DB] Failed to seed from db.json:', seedErr);
    }
  }

  // Load from MongoDB
  const dbUsers = await UserModel.find({}).lean();
  users.length = 0;
  users.push(...dbUsers.map((u: any) => ({
    ...u,
    lastSeen: u.lastSeen ? new Date(u.lastSeen) : new Date(),
    createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
    updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
    deletedAt: u.deletedAt ? new Date(u.deletedAt) : null,
  })));

  const dbConvos = await ConversationModel.find({}).lean();
  conversations.length = 0;
  conversations.push(...dbConvos.map((c: any) => ({
    ...c,
    createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
  })));

  const dbMembers = await ConversationMemberModel.find({}).lean();
  conversationMembers.length = 0;
  conversationMembers.push(...dbMembers.map((m: any) => ({
    ...m,
    joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
    leftAt: m.leftAt ? new Date(m.leftAt) : null,
  })));

  const dbMessages = await MessageModel.find({}).lean();
  messages.length = 0;
  messages.push(...dbMessages.map((m: any) => ({
    ...m,
    createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
    editedAt: m.editedAt ? new Date(m.editedAt) : null,
    deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
  })));

  const dbRequests = await FriendRequestModel.find({}).lean();
  friendRequests.length = 0;
  friendRequests.push(...dbRequests.map((r: any) => ({
    ...r,
    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
  })));

  const dbFriends = await FriendModel.find({}).lean();
  friends.length = 0;
  friends.push(...dbFriends.map((f: any) => ({
    ...f,
    createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
  })));

  console.log(`[DB] Successfully loaded state from MongoDB (${users.length} users, ${conversations.length} conversations, ${messages.length} messages)`);
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
      console.log('[DB] Loaded persistent fallback state from db.json');
    } catch (err) {
      console.error('[DB] Failed to load db.json fallback, using defaults:', err);
    }
  }
}

// Automatically load fallback database on start, which will be overridden by connectDb()
loadDb();

