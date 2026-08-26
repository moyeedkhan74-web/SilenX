import mongoose, { Schema } from 'mongoose';

// User Schema
const UserSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, index: true },
  phone: { type: String },
  googleId: { type: String, index: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  status: { type: String, required: true, default: 'offline' },
  lastSeen: { type: Date, required: true, default: Date.now },
  showOnlineStatus: { type: Boolean, default: true },
  bio: { type: String, default: '' },
  publicKey: { type: String, default: null },
  // Versioned public-key history — MUST be declared here or Mongoose strict
  // mode strips it on every Mongo sync and it is lost on server restart.
  publicKeys: [
    new Schema(
      {
        id: { type: String, required: true },
        userId: { type: String, required: true },
        publicKey: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null },
        version: { type: Number, default: 1 },
        fingerprint: { type: String, default: null },
      },
      { _id: false }
    ),
  ],
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now },
  deletedAt: { type: Date, default: null },
  fcmTokens: { type: [String], default: [] },
});

// Conversation Schema
const ConversationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, enum: ['direct', 'group'] },
  name: { type: String, default: null },
  avatarUrl: { type: String, default: null },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now },
});

// ConversationMember Schema
const ConversationMemberSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  joinedAt: { type: Date, required: true, default: Date.now },
  leftAt: { type: Date, default: null },
  muted: { type: Boolean, required: true, default: false },
});

// Group Schema
const GroupSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  avatarUrl: { type: String, default: null },
  createdBy: { type: String, required: true, index: true },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now },
  members: [{ type: String, index: true }],
  admins: [{ type: String, index: true }],
  settings: {
    whoCanSendMessages: { type: String, enum: ['all', 'admins', 'owner'], default: 'all' },
    whoCanAddMembers: { type: String, enum: ['all', 'admins', 'owner'], default: 'admins' },
    muted: { type: Boolean, default: false },
  },
});

// GroupMember Schema
const GroupMemberSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  groupId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  joinedAt: { type: Date, required: true, default: Date.now },
  mutedUntil: { type: Date, default: null },
  lastReadMessageId: { type: String, default: null },
});

// GroupInvite Schema
const GroupInviteSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  groupId: { type: String, required: true, index: true },
  code: { type: String, required: true, unique: true, index: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  joinApprovalRequired: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
});

// Message Schema
const MessageSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  groupId: { type: String, default: null, index: true },
  senderId: { type: String, required: true },
  encryptedContent: { type: String, required: true },
  contentType: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, index: true },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  // Native MongoDB TTL index: the document is auto-deleted once `expireAt`
  // passes. Documents keep `expireAt: null` until the pruner schedules them,
  // and null dates are ignored by the TTL monitor — safe default.
  expireAt: { type: Date, default: null, index: { expires: 0 } },
  // Set when a heavy media payload has been replaced with a placeholder.
  prunedAt: { type: Date, default: null },
  replyTo: {
    sender: { type: String },
    text: { type: String },
  },
  reactions: [{
    userId: { type: String, required: true },
    emoji: { type: String, required: true },
  }],
  mediaUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: String },
  fileType: { type: String },
  duration: { type: String },
  locationData: {
    latitude: { type: Number },
    longitude: { type: Number },
    description: { type: String },
  },
  contactData: {
    name: { type: String },
    uid: { type: String },
    avatarUrl: { type: String },
  },
  pollData: {
    question: { type: String },
    options: [{
      id: { type: String },
      text: { type: String },
      votes: [{ type: String }],
    }],
  },
  eventData: {
    title: { type: String },
    description: { type: String },
    date: { type: String },
    time: { type: String },
    location: { type: String },
  },
});

// FriendRequest Schema
const FriendRequestSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  senderId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  fromUserId: { type: String },
  toUserId: { type: String },
  fromDisplayName: { type: String },
  fromUid: { type: String },
  fromAvatarUrl: { type: String },
  toDisplayName: { type: String },
  toUid: { type: String },
  status: { type: String, required: true, enum: ['pending', 'accepted', 'declined'] },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, default: null },
});

// Friend Schema
const FriendSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId1: { type: String, required: true, index: true },
  userId2: { type: String, required: true, index: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

// CallLog Schema
const CallLogSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  groupId: { type: String, default: null, index: true },
  initiatorId: { type: String, required: true, index: true },
  receiverId: { type: String, default: null, index: true },
  participants: [{ type: String, index: true }],
  callType: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'missed', 'ended'], required: true },
  startedAt: { type: Date, required: true, default: Date.now },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: null },
  deletedFor: [{ type: String, index: true }],
});

export const UserModel = mongoose.model('User', UserSchema);
export const ConversationModel = mongoose.model('Conversation', ConversationSchema);
export const ConversationMemberModel = mongoose.model('ConversationMember', ConversationMemberSchema);
export const GroupModel = mongoose.model('Group', GroupSchema);
export const GroupMemberModel = mongoose.model('GroupMember', GroupMemberSchema);
export const GroupInviteModel = mongoose.model('GroupInvite', GroupInviteSchema);
export const MessageModel = mongoose.model('Message', MessageSchema);
export const FriendRequestModel = mongoose.model('FriendRequest', FriendRequestSchema);
export const FriendModel = mongoose.model('Friend', FriendSchema);
export const CallLogModel = mongoose.model('CallLog', CallLogSchema);
