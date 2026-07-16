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
  bio: { type: String, default: '' },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now },
  deletedAt: { type: Date, default: null },
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

// Message Schema
const MessageSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  encryptedContent: { type: String, required: true },
  contentType: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
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

export const UserModel = mongoose.model('User', UserSchema);
export const ConversationModel = mongoose.model('Conversation', ConversationSchema);
export const ConversationMemberModel = mongoose.model('ConversationMember', ConversationMemberSchema);
export const MessageModel = mongoose.model('Message', MessageSchema);
export const FriendRequestModel = mongoose.model('FriendRequest', FriendRequestSchema);
export const FriendModel = mongoose.model('Friend', FriendSchema);
