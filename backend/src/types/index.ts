export type UserStatus = 'online' | 'away' | 'offline';
export type ConversationType = 'direct' | 'group';
export type ContentType = 'text' | 'system' | 'image' | 'video' | 'file' | 'location' | 'contact' | 'poll' | 'event' | 'voice-note';
export type CallType = 'audio' | 'video';
export type CallStatus = 'pending' | 'accepted' | 'active' | 'rejected' | 'missed' | 'ended';

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
  showOnlineStatus: boolean;
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
  groupId?: string;
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
  groupId?: string;
  senderId: string;
  encryptedContent: string;
  contentType: ContentType;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  replyTo?: {
    sender: string;
    text: string;
  };
  reactions?: {
    userId: string;
    emoji: string;
  }[];
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  duration?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    description: string;
  };
  contactData?: {
    name: string;
    uid: string;
    avatarUrl?: string;
  };
  pollData?: {
    question: string;
    options: {
      id: string;
      text: string;
      votes: string[];
    }[];
  };
  eventData?: {
    title: string;
    description?: string;
    date: string;
    time: string;
    location?: string;
  };
}

export interface MessageRead {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members: string[];
  admins: string[];
  settings: {
    whoCanSendMessages: 'all' | 'admins' | 'owner';
    whoCanAddMembers: 'all' | 'admins' | 'owner';
    muted: boolean;
  };
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  mutedUntil: Date | null;
  lastReadMessageId: string | null;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  code: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  joinApprovalRequired: boolean;
  active: boolean;
}

export interface CallLog {
  id: string;
  conversationId: string;
  groupId?: string;
  initiatorId: string;
  receiverId?: string;
  participants: string[];
  callType: CallType;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  deletedFor?: string[];
}

export interface Call {
  id: string;
  conversationId: string;
  groupId?: string;
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
  recipientId?: string;
  replyTo?: {
    sender: string;
    text: string;
  };
  contentType?: ContentType;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  duration?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    description: string;
  };
  contactData?: {
    name: string;
    uid: string;
    avatarUrl?: string;
  };
  pollData?: {
    question: string;
    options: {
      id: string;
      text: string;
      votes: string[];
    }[];
  };
  eventData?: {
    title: string;
    description?: string;
    date: string;
    time: string;
    location?: string;
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
  targetUserId: string;
  callerName: string;
  callerAvatarUrl?: string;
  callType: CallType;
}

export interface CallRespondPayload {
  targetUserId: string;
}

export interface SDPPayload {
  targetUserId: string;
  sdp: RTCSessionDescriptionInit;
  senderId?: string;
}

export interface ICECandidatePayload {
  targetUserId: string;
  candidate: RTCIceCandidateInit;
  senderId?: string;
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

