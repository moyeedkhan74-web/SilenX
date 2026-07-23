export type UserStatus = 'online' | 'away' | 'offline';
export type ConversationType = 'direct' | 'group';
export type CallType = 'audio' | 'video';
export type CallStatus = 'pending' | 'accepted' | 'rejected' | 'missed' | 'ended';

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  lastSeen: string;
  bio: string;
  showOnlineStatus?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  members: User[];
  isPinned?: boolean;
  isMuted?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isSelf: boolean;
  time: string;
  createdAt?: string;
  isRead: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'received';
  reactions?: {
    userId: string;
    emoji: string;
  }[];
  isPinned?: boolean;
  isStarred?: boolean;
  isSystem?: boolean;
  replyTo?: {
    sender: string;
    text: string;
  };
  contentType?: 'text' | 'system' | 'image' | 'video' | 'file' | 'location' | 'contact' | 'poll' | 'event' | 'voice-note';
  mediaUrl?: string; // for images, videos, files, voice notes
  fileName?: string; // for files and videos
  fileSize?: string; // for files and videos
  fileType?: string; // MIME type for download and preview
  duration?: string; // for voice notes
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
      votes: string[]; // List of userIds
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

export interface CallInfo {
  id: string;
  callType: CallType;
  status: CallStatus;
  callerName: string;
  callerId: string;
  startedAt: string | null;
  duration: number;
}
