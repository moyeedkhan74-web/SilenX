export type UserStatus = 'online' | 'away' | 'offline';
export type ConversationType = 'direct' | 'group';
export type ContentType = 'text' | 'system';
export type CallType = 'audio' | 'video';
export type CallStatus = 'pending' | 'accepted' | 'rejected' | 'missed' | 'ended';

export interface User {
  id: string;
  uid: string;
  email: string;
  phone?: string;
  googleId: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  lastSeen: Date;
  bio: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserEncryptionKey {
  id: string;
  userId: string;
  publicKey: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
  muted: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  encryptedContent: string;
  contentType: ContentType;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export interface MessageRead {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface Call {
  id: string;
  conversationId: string;
  initiatorId: string;
  receiverId: string;
  callType: CallType;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  createdAt: Date;
}

// Socket event payloads
export interface SendMessagePayload {
  conversationId: string;
  encryptedContent: string;
  tempId: string;
  replyTo?: {
    sender: string;
    text: string;
  };
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
}

export interface ReadReceiptPayload {
  messageId: string;
  conversationId: string;
}

export interface CallInitiatePayload {
  targetId: string;
  callerId: string;
  callType: CallType;
}

export interface CallRespondPayload {
  targetId: string;
  responderId: string;
}

export interface SDPPayload {
  targetId: string;
  sdp: RTCSessionDescriptionInit;
  senderId: string;
}

export interface ICECandidatePayload {
  targetId: string;
  candidate: RTCIceCandidateInit;
}

export interface EditMessagePayload {
  messageId: string;
  conversationId: string;
  newEncryptedContent: string;
}

export interface DeleteMessagePayload {
  messageId: string;
  conversationId: string;
}

export interface UserStatusPayload {
  userId: string;
  status: UserStatus;
}

export interface ContactRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUid: string;
  toUid: string;
  fromDisplayName?: string;
  toDisplayName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date | null;
}

export interface Friend {
  id: string;
  userId1: string;
  userId2: string;
  createdAt: Date;
}

