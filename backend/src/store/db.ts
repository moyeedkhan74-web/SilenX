import { User, Conversation, ConversationMember, Message, ContactRequest, FriendRequest, Friend } from '../types';

// In-Memory Database Seed Sets
export const users: User[] = [
  {
    id: 'self',
    uid: 'SEC_8f7d6e5c4b3a',
    email: 'user@gmail.com',
    phone: '+1-555-0100',
    googleId: 'google_self_123',
    displayName: 'User',
    avatarUrl: null,
    status: 'online',
    lastSeen: new Date(),
    bio: "Hey there! I'm using SlienX.",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  },
  {
    id: 'u1',
    uid: 'SEC_a1b2c3d4e5f6',
    email: 'alice@proton.me',
    phone: '+1-555-0101',
    googleId: 'google_alice_123',
    displayName: 'Alice Chen',
    avatarUrl: null,
    status: 'online',
    lastSeen: new Date(),
    bio: 'Security researcher',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  },
  {
    id: 'u2',
    uid: 'SEC_f6e5d4c3b2a1',
    email: 'bob@signal.org',
    phone: '+1-555-0102',
    googleId: 'google_bob_123',
    displayName: 'Bob Martinez',
    avatarUrl: null,
    status: 'online',
    lastSeen: new Date(),
    bio: 'Full-stack developer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  },
  {
    id: 'u3',
    uid: 'SEC_1a2b3c4d5e6f',
    email: 'carol@pm.me',
    phone: '+1-555-0103',
    googleId: 'google_carol_123',
    displayName: 'Carol White',
    avatarUrl: null,
    status: 'away',
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    bio: 'Product designer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  },
  {
    id: 'u4',
    uid: 'SEC_6f5e4d3c2b1a',
    email: 'dave@tutanota.com',
    phone: '+1-555-0104',
    googleId: 'google_dave_123',
    displayName: 'Dave Kim',
    avatarUrl: null,
    status: 'offline',
    lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    bio: 'DevOps engineer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  },
  {
    id: 'u5',
    uid: 'SEC_ab12cd34ef56',
    email: 'eva@proton.me',
    phone: '+1-555-0105',
    googleId: 'google_eva_123',
    displayName: 'Eva López',
    avatarUrl: null,
    status: 'online',
    lastSeen: new Date(),
    bio: 'Crypto enthusiast',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  },
  {
    id: 'u6',
    uid: 'SEC_FjEcUktRBeZlbLxX',
    email: 'testuser@example.com',
    phone: '+1-555-0199',
    googleId: 'google_testuser_123',
    displayName: 'Test User',
    avatarUrl: null,
    status: 'online',
    lastSeen: new Date(),
    bio: 'Test account for Secure ID lookup',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  }
];

export const conversations: Conversation[] = [
  {
    id: 'conv1',
    type: 'direct',
    name: null,
    avatarUrl: null,
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'conv2',
    type: 'direct',
    name: null,
    avatarUrl: null,
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'conv3',
    type: 'direct',
    name: null,
    avatarUrl: null,
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'conv4',
    type: 'group',
    name: 'SlienX Team',
    avatarUrl: null,
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'conv5',
    type: 'direct',
    name: null,
    avatarUrl: null,
    createdBy: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const conversationMembers: ConversationMember[] = [
  // conv1: self & Alice
  { id: 'm1_1', conversationId: 'conv1', userId: 'self', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm1_2', conversationId: 'conv1', userId: 'u1', joinedAt: new Date(), leftAt: null, muted: false },
  // conv2: self & Bob
  { id: 'm2_1', conversationId: 'conv2', userId: 'self', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm2_2', conversationId: 'conv2', userId: 'u2', joinedAt: new Date(), leftAt: null, muted: false },
  // conv3: self & Carol
  { id: 'm3_1', conversationId: 'conv3', userId: 'self', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm3_2', conversationId: 'conv3', userId: 'u3', joinedAt: new Date(), leftAt: null, muted: false },
  // conv4: group self, Alice, Bob, Dave
  { id: 'm4_1', conversationId: 'conv4', userId: 'self', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm4_2', conversationId: 'conv4', userId: 'u1', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm4_3', conversationId: 'conv4', userId: 'u2', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm4_4', conversationId: 'conv4', userId: 'u4', joinedAt: new Date(), leftAt: null, muted: false },
  // conv5: self & Eva
  { id: 'm5_1', conversationId: 'conv5', userId: 'self', joinedAt: new Date(), leftAt: null, muted: false },
  { id: 'm5_2', conversationId: 'conv5', userId: 'u5', joinedAt: new Date(), leftAt: null, muted: false }
];

export const messages: Message[] = [
  // conv1 messages
  { id: 'm1', conversationId: 'conv1', senderId: 'u1', encryptedContent: 'Hey! How\'s the E2E encryption implementation going?', contentType: 'text', createdAt: new Date(Date.now() - 14 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm2', conversationId: 'conv1', senderId: 'self', encryptedContent: 'Going great! Just finished the X25519 key exchange 🔑', contentType: 'text', createdAt: new Date(Date.now() - 12 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm3', conversationId: 'conv1', senderId: 'u1', encryptedContent: 'Nice! Did you use TweetNaCl for the box implementation?', contentType: 'text', createdAt: new Date(Date.now() - 9 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm4', conversationId: 'conv1', senderId: 'self', encryptedContent: 'Yes, it\'s perfect for our use case. The nonce generation is handled via crypto.getRandomValues()', contentType: 'text', createdAt: new Date(Date.now() - 6 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm5', conversationId: 'conv1', senderId: 'u1', encryptedContent: 'That\'s exactly what I was hoping for. Let me review the PR.', contentType: 'text', createdAt: new Date(Date.now() - 4 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm6', conversationId: 'conv1', senderId: 'u1', encryptedContent: 'The encryption layer looks solid 🔐', contentType: 'text', createdAt: new Date(Date.now() - 2 * 60 * 1000), editedAt: null, deletedAt: null },
  
  // conv2 messages
  { id: 'm7', conversationId: 'conv2', senderId: 'self', encryptedContent: 'Bob, can you take a look at the WebRTC signaling server?', contentType: 'text', createdAt: new Date(Date.now() - 44 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm8', conversationId: 'conv2', senderId: 'u2', encryptedContent: 'On it! The STUN/TURN configuration might need adjustment', contentType: 'text', createdAt: new Date(Date.now() - 29 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm9', conversationId: 'conv2', senderId: 'u2', encryptedContent: 'Sure, I\'ll push the commit now', contentType: 'text', createdAt: new Date(Date.now() - 19 * 60 * 1000), editedAt: null, deletedAt: null },

  // conv3 messages
  { id: 'm10', conversationId: 'conv3', senderId: 'u3', encryptedContent: 'I redesigned the chat bubble components with the new design system', contentType: 'text', createdAt: new Date(Date.now() - 64 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm11', conversationId: 'conv3', senderId: 'self', encryptedContent: 'Looks amazing! Love the glassmorphism effect', contentType: 'text', createdAt: new Date(Date.now() - 59 * 60 * 1000), editedAt: null, deletedAt: null },
  { id: 'm12', conversationId: 'conv3', senderId: 'u3', encryptedContent: 'Check the new mockups I sent', contentType: 'text', createdAt: new Date(Date.now() - 52 * 60 * 1000), editedAt: null, deletedAt: null }
];

export const contactRequests: ContactRequest[] = [];

export const friendRequests: FriendRequest[] = [];

export const friends: Friend[] = [];
