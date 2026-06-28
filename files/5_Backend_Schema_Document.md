# Backend Schema Document
## Secure Chat App - Database Design & Data Structures

---

## 1. Database Overview

**Database Type:** PostgreSQL (Relational)

**Why PostgreSQL:**
- ACID transactions (data consistency)
- JSON support (flexibility)
- Full-text search (future enhancement)
- Excellent for relational data
- Open source & production-ready

**Connection Pool:** pg-pool (Node.js)
- Min connections: 2
- Max connections: 20
- Idle timeout: 30 seconds

---

## 2. Core Tables & Schema

### 2.1 Users Table

**Purpose:** Store user account information and profiles

```sql
CREATE TABLE users (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid VARCHAR(64) UNIQUE NOT NULL,  -- User ID (e.g., "SEC_8f7d6e5c4b3a2910")
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  
  -- Profile
  display_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  
  -- Status
  status ENUM('online', 'away', 'offline') DEFAULT 'offline',
  last_seen TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP,  -- Soft delete
  
  -- Constraints
  CHECK (char_length(display_name) > 0),
  CHECK (char_length(display_name) <= 255),
  CHECK (bio IS NULL OR char_length(bio) <= 500)
);

-- Indexes for fast queries
CREATE INDEX idx_users_uid ON users(uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**Example Data:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "uid": "SEC_8f7d6e5c4b3a2910",
  "email": "john@example.com",
  "google_id": "118277335344963903896",
  "display_name": "John Doe",
  "avatar_url": "https://lh3.googleusercontent.com/.../photo.jpg",
  "bio": "Software engineer, privacy advocate",
  "status": "online",
  "last_seen": "2024-06-25T14:30:00Z",
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-06-25T14:30:00Z",
  "deleted_at": null
}
```

---

### 2.2 User Encryption Keys Table

**Purpose:** Store users' X25519 public encryption keys (used for E2E encryption)

```sql
CREATE TABLE user_encryption_keys (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Key data (base64 encoded)
  public_key TEXT NOT NULL,  -- X25519 public key (32 bytes base64)
  key_fingerprint VARCHAR(64),  -- SHA256 of public key (for verification)
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,  -- Key rotation expiry (optional)
  
  -- Constraints
  UNIQUE(user_id, is_active)  -- Only one active key per user
);

-- Indexes
CREATE INDEX idx_user_encryption_keys_user_id ON user_encryption_keys(user_id);
CREATE INDEX idx_user_encryption_keys_is_active ON user_encryption_keys(is_active);
```

**Example Data:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440111",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "public_key": "Ujx9KVw8U5JhD2+Aw...=",  // Base64 X25519 public key
  "key_fingerprint": "abc123def456...",  // For verification
  "is_active": true,
  "created_at": "2024-01-15T10:00:00Z",
  "expires_at": "2025-01-15T10:00:00Z"
}
```

**Security Notes:**
- Public key is stored (needed for encryption)
- Private key NEVER stored on server (only on client device)
- Key rotation possible but not in MVP
- Fingerprint for future key verification feature

---

### 2.3 Conversations Table

**Purpose:** Store conversation metadata (1-to-1 chats and groups)

```sql
CREATE TABLE conversations (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Type indicator
  type ENUM('direct', 'group') NOT NULL,
  
  -- Group-specific fields (NULL for direct messages)
  name VARCHAR(255),  -- Group name only
  avatar_url TEXT,    -- Group avatar only
  description TEXT,   -- Group description (future)
  
  -- Creator & ownership
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  archived_at TIMESTAMP,  -- Soft archive (future)
  
  -- Constraints
  CHECK (
    (type = 'group' AND name IS NOT NULL) OR
    (type = 'direct' AND name IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
```

**Example Data - Direct Message:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440222",
  "type": "direct",
  "name": null,
  "avatar_url": null,
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-06-20T09:15:00Z",
  "updated_at": "2024-06-25T14:30:00Z",
  "archived_at": null
}
```

**Example Data - Group:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440333",
  "type": "group",
  "name": "Project Team",
  "avatar_url": "https://app.com/avatars/group_880e8400.png",
  "description": "Team working on product launch",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-06-01T14:00:00Z",
  "updated_at": "2024-06-25T14:30:00Z",
  "archived_at": null
}
```

---

### 2.4 Conversation Members Table

**Purpose:** Track which users are members of which conversations (JOIN table)

```sql
CREATE TABLE conversation_members (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role (future: admin, moderator, member)
  role ENUM('admin', 'member') DEFAULT 'member',
  
  -- Membership status
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  left_at TIMESTAMP,  -- NULL = still member, NOT NULL = left group
  
  -- User preferences
  muted BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Constraints
  UNIQUE(conversation_id, user_id),
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

-- Indexes
CREATE INDEX idx_conversation_members_conversation_id 
  ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user_id 
  ON conversation_members(user_id);
CREATE INDEX idx_conversation_members_role 
  ON conversation_members(role);
CREATE INDEX idx_conversation_members_left_at 
  ON conversation_members(left_at);
```

**Example Data:**
```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440444",
    "conversation_id": "880e8400-e29b-41d4-a716-446655440333",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "admin",
    "joined_at": "2024-06-01T14:00:00Z",
    "left_at": null,
    "muted": false,
    "created_at": "2024-06-01T14:00:00Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440555",
    "conversation_id": "880e8400-e29b-41d4-a716-446655440333",
    "user_id": "111e8400-e29b-41d4-a716-446655440666",
    "role": "member",
    "joined_at": "2024-06-02T10:30:00Z",
    "left_at": null,
    "muted": false,
    "created_at": "2024-06-02T10:30:00Z"
  }
]
```

---

### 2.5 Messages Table

**Purpose:** Store all messages (encrypted content + metadata)

```sql
CREATE TABLE messages (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Content (encrypted)
  encrypted_content TEXT NOT NULL,  -- Encrypted message blob (base64)
  content_type ENUM('text', 'system', 'deleted') DEFAULT 'text',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  edited_at TIMESTAMP,  -- When edited
  deleted_at TIMESTAMP,  -- Soft delete
  
  -- Ordering
  sequence_number BIGINT,  -- For message ordering in conversation
  
  -- Constraints
  CHECK (content_type IN ('text', 'system', 'deleted')),
  CHECK (
    (content_type != 'deleted' AND encrypted_content IS NOT NULL) OR
    (content_type = 'deleted' AND encrypted_content IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_messages_conversation_id_created_at 
  ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender_id 
  ON messages(sender_id);
CREATE INDEX idx_messages_created_at 
  ON messages(created_at DESC);
CREATE INDEX idx_messages_deleted_at 
  ON messages(deleted_at);
CREATE INDEX idx_messages_conversation_sequence 
  ON messages(conversation_id, sequence_number);
```

**Example Data:**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440777",
  "conversation_id": "770e8400-e29b-41d4-a716-446655440222",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "encrypted_content": "k7uQ8xK/w9LmP2H...==",  // Encrypted message
  "content_type": "text",
  "created_at": "2024-06-25T14:32:15Z",
  "edited_at": null,
  "deleted_at": null,
  "sequence_number": 42
}
```

**Security Notes:**
- Content is encrypted (server can't read)
- Content type indicates message type
- Timestamps preserved for message ordering
- Deleted messages soft-deleted (can be purged later)

---

### 2.6 Message Reads Table

**Purpose:** Track which users have read which messages (read receipts)

```sql
CREATE TABLE message_reads (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Status
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Constraints
  UNIQUE(message_id, user_id)  -- Each user reads message once
);

-- Indexes
CREATE INDEX idx_message_reads_message_id 
  ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id 
  ON message_reads(user_id);
CREATE INDEX idx_message_reads_read_at 
  ON message_reads(read_at);
```

**Example Data:**
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440888",
  "message_id": "bb0e8400-e29b-41d4-a716-446655440777",
  "user_id": "111e8400-e29b-41d4-a716-446655440666",
  "read_at": "2024-06-25T14:33:20Z"
}
```

**Usage:**
- When a message is received, record read_at
- To show read receipts: Check if message_id exists in message_reads
- To get who read a message: `SELECT user_id FROM message_reads WHERE message_id = ?`
- To get read count: `SELECT COUNT(*) FROM message_reads WHERE message_id = ?`

---

### 2.7 Calls Table

**Purpose:** Store call history and call metadata

```sql
CREATE TABLE calls (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Call details
  call_type ENUM('audio', 'video') NOT NULL,
  status ENUM('pending', 'accepted', 'rejected', 'missed', 'ended') 
    DEFAULT 'pending',
  
  -- Timing
  started_at TIMESTAMP,  -- When call was accepted
  ended_at TIMESTAMP,    -- When call ended
  duration_seconds INTEGER,  -- Call length in seconds
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Constraints
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CHECK (
    (status != 'ended' AND ended_at IS NULL) OR
    (status = 'ended' AND ended_at IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_calls_conversation_id 
  ON calls(conversation_id);
CREATE INDEX idx_calls_initiator_id 
  ON calls(initiator_id);
CREATE INDEX idx_calls_receiver_id 
  ON calls(receiver_id);
CREATE INDEX idx_calls_status 
  ON calls(status);
CREATE INDEX idx_calls_created_at 
  ON calls(created_at DESC);
```

**Example Data - Accepted Call:**
```json
{
  "id": "dd0e8400-e29b-41d4-a716-446655440999",
  "conversation_id": "770e8400-e29b-41d4-a716-446655440222",
  "initiator_id": "550e8400-e29b-41d4-a716-446655440000",
  "receiver_id": "111e8400-e29b-41d4-a716-446655440666",
  "call_type": "video",
  "status": "ended",
  "started_at": "2024-06-25T14:35:00Z",
  "ended_at": "2024-06-25T14:38:45Z",
  "duration_seconds": 225,
  "created_at": "2024-06-25T14:34:50Z",
  "updated_at": "2024-06-25T14:38:45Z"
}
```

**Example Data - Rejected Call:**
```json
{
  "id": "ee0e8400-e29b-41d4-a716-446655440aaa",
  "conversation_id": "770e8400-e29b-41d4-a716-446655440222",
  "initiator_id": "550e8400-e29b-41d4-a716-446655440000",
  "receiver_id": "111e8400-e29b-41d4-a716-446655440666",
  "call_type": "audio",
  "status": "rejected",
  "started_at": null,
  "ended_at": "2024-06-25T14:20:15Z",
  "duration_seconds": null,
  "created_at": "2024-06-25T14:20:10Z",
  "updated_at": "2024-06-25T14:20:15Z"
}
```

**Call Status Meanings:**
- `pending` - Call initiated, waiting for receiver
- `accepted` - Receiver accepted, call started
- `rejected` - Receiver declined
- `missed` - Call expired (30 second timeout without response)
- `ended` - Call completed

---

### 2.8 Sessions Table

**Purpose:** Manage user sessions and refresh tokens

```sql
CREATE TABLE sessions (
  -- Identifiers
  id VARCHAR(255) PRIMARY KEY,  -- Session ID (random)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tokens
  refresh_token TEXT NOT NULL UNIQUE,  -- JWT refresh token
  
  -- Session info
  ip_address VARCHAR(45),  -- IPv4 or IPv6
  user_agent TEXT,  -- Browser/app info
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,  -- When session expires
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Constraints
  CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_sessions_user_id 
  ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token 
  ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at 
  ON sessions(expires_at);
```

**Example Data:**
```json
{
  "id": "sess_8f7d6e5c4b3a2910",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "created_at": "2024-06-25T08:00:00Z",
  "expires_at": "2024-07-02T08:00:00Z",
  "last_activity_at": "2024-06-25T14:32:00Z"
}
```

**Token Rotation:**
- Refresh token is unique
- When refreshing, invalidate old token and issue new one
- Helps prevent token replay attacks

---

## 3. Relationships Diagram

```
users (1) ─────→ (many) conversations [created_by]
  ↓ (many)
  ├─→ user_encryption_keys (1-to-1 or 1-to-many for key rotation)
  ├─→ conversation_members (join table)
  │   ↓ (many)
  │   └─→ conversations (many)
  ├─→ messages [sender_id]
  │   ├─→ message_reads [user_id reads message]
  │   └─→ calls [initiator_id, receiver_id]
  ├─→ calls
  └─→ sessions

conversations (1) ─────→ (many) conversation_members
                  ───────→ (many) messages
                  ───────→ (many) calls
```

---

## 4. Data Types & Field Specifications

### UUID vs Auto-Increment ID

**Decision: Use UUID for primary keys**

**Reasons:**
- ✅ Privacy (ID doesn't leak sequence)
- ✅ Distributed systems (no coordination needed)
- ✅ Security (harder to guess IDs)
- ✅ Shardable (split data across servers)

```sql
-- Good
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Avoid (in this app)
id BIGSERIAL PRIMARY KEY  -- Sequential, not private
```

### ENUM Types

**Usage in schema:**
```sql
-- Users
status ENUM('online', 'away', 'offline')

-- Conversations
type ENUM('direct', 'group')

-- Conversation Members
role ENUM('admin', 'member')

-- Messages
content_type ENUM('text', 'system', 'deleted')

-- Calls
call_type ENUM('audio', 'video')
status ENUM('pending', 'accepted', 'rejected', 'missed', 'ended')
```

**Why ENUM:**
- ✅ Type safety (prevents invalid values)
- ✅ Better performance (smaller storage)
- ✅ Validation at database level

### TIMESTAMP Columns

**Standards:**
- All timestamps are UTC (CURRENT_TIMESTAMP)
- Frontend converts to user's local time
- Never store user timezone in database

```sql
-- Good
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL

-- Avoid (timezone-dependent)
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
```

### Text Encoding

**Encrypted Content:**
- Stored as base64-encoded TEXT
- Encrypted as binary, then base64 for storage
- Decode on retrieval

```javascript
// Encryption (JavaScript)
const plaintext = "Hello";
const encrypted = nacl.secretbox(plaintext, nonce, key);  // returns Uint8Array
const base64 = btoa(String.fromCharCode(...encrypted));   // convert to string

// Storage
INSERT INTO messages (encrypted_content) VALUES ('k7uQ8xK/w9Lm...');

// Retrieval
SELECT encrypted_content FROM messages WHERE id = ?;  // returns 'k7uQ8xK/w9Lm...'

// Decryption
const encrypted = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const plaintext = nacl.secretbox.open(encrypted, nonce, key);
```

---

## 5. Data Integrity & Constraints

### Unique Constraints

```sql
-- Email must be unique
ALTER TABLE users ADD CONSTRAINT uniq_users_email UNIQUE (email);

-- Only one active encryption key per user
ALTER TABLE user_encryption_keys 
  ADD CONSTRAINT uniq_active_encryption_key 
  UNIQUE (user_id) WHERE is_active = true;

-- User can't read same message twice
ALTER TABLE message_reads 
  ADD CONSTRAINT uniq_message_read 
  UNIQUE (message_id, user_id);

-- User can't be member of same conversation twice
ALTER TABLE conversation_members 
  ADD CONSTRAINT uniq_conversation_member 
  UNIQUE (conversation_id, user_id);

-- Each session token is unique
ALTER TABLE sessions 
  ADD CONSTRAINT uniq_refresh_token UNIQUE (refresh_token);
```

### Foreign Key Constraints

```sql
-- Cascade delete: When user deleted, delete all their data
ALTER TABLE conversation_members 
  ADD CONSTRAINT fk_conv_members_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Set NULL: When user deleted, set reference to NULL
ALTER TABLE messages 
  ADD CONSTRAINT fk_messages_sender 
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

-- Cascade: When conversation deleted, delete all messages
ALTER TABLE messages 
  ADD CONSTRAINT fk_messages_conv 
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) 
  ON DELETE CASCADE;
```

### Check Constraints

```sql
-- Validate display name length
CHECK (char_length(display_name) > 0 AND char_length(display_name) <= 255)

-- Ensure bio is under limit
CHECK (bio IS NULL OR char_length(bio) <= 500)

-- Duration must be positive
CHECK (duration_seconds IS NULL OR duration_seconds >= 0)

-- Conversation type consistency
CHECK ((type = 'group' AND name IS NOT NULL) OR 
       (type = 'direct' AND name IS NULL))

-- Ensure left_at >= joined_at
CHECK (left_at IS NULL OR left_at >= joined_at)

-- Ensure logical status transitions
CHECK ((status != 'ended' AND ended_at IS NULL) OR 
       (status = 'ended' AND ended_at IS NOT NULL))
```

---

## 6. Query Examples & Performance

### Fast Queries (Optimized with Indexes)

#### Get User's Conversations

```sql
SELECT 
  c.id,
  c.type,
  c.name,
  c.avatar_url,
  (SELECT COUNT(*) FROM messages 
   WHERE conversation_id = c.id AND deleted_at IS NULL) as message_count,
  (SELECT MAX(created_at) FROM messages 
   WHERE conversation_id = c.id) as last_message_at
FROM conversations c
INNER JOIN conversation_members cm ON c.id = cm.conversation_id
WHERE cm.user_id = ? AND cm.left_at IS NULL
ORDER BY c.updated_at DESC
LIMIT 50;

-- Uses indexes:
-- - idx_conversation_members_user_id
-- - idx_conversation_members_left_at
-- - idx_messages_conversation_id_created_at
```

#### Get Recent Messages in Conversation

```sql
SELECT 
  id,
  sender_id,
  encrypted_content,
  created_at,
  (SELECT COUNT(*) FROM message_reads mr 
   WHERE mr.message_id = m.id) as read_by_count
FROM messages m
WHERE conversation_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- Uses index: idx_messages_conversation_id_created_at
-- With pagination cursor:
WHERE conversation_id = ? AND created_at < ? AND deleted_at IS NULL
```

#### Check if Message is Read

```sql
SELECT COUNT(*) > 0 as is_read
FROM message_reads
WHERE message_id = ? AND user_id = ?;

-- Uses index: idx_message_reads_message_id, idx_message_reads_user_id
-- Combined query is very fast
```

#### Get Call History

```sql
SELECT 
  id,
  call_type,
  status,
  started_at,
  duration_seconds,
  CASE 
    WHEN initiator_id = ? THEN receiver_id
    ELSE initiator_id
  END as other_user_id
FROM calls
WHERE conversation_id = ?
ORDER BY created_at DESC
LIMIT 50;

-- Uses index: idx_calls_conversation_id, idx_calls_created_at
```

#### Search Users

```sql
SELECT id, email, display_name, avatar_url
FROM users
WHERE (display_name ILIKE ? OR email ILIKE ?)
  AND deleted_at IS NULL
ORDER BY display_name
LIMIT 10;

-- Uses index: idx_users_deleted_at
-- Full-text search can be added later if needed
```

### Queries to Avoid (Slow)

```sql
-- ❌ BAD: No index on messages.sender_id + expensive COUNT
SELECT COUNT(*) FROM messages WHERE sender_id = ?;

-- ❌ BAD: Scanning all sessions
SELECT * FROM sessions WHERE user_id = ?;

-- ❌ BAD: Full table scan (no index on left_at + user_id combo)
SELECT * FROM conversation_members 
WHERE user_id = ? AND left_at IS NOT NULL;
```

---

## 7. Encryption Data Flow

### How Encrypted Messages are Stored

**Step 1: Client Side (Encryption)**
```javascript
// User A wants to send "Hello" to User B

// 1. Fetch User B's public key
const userBPublicKey = await fetch('/api/users/userB_id/public-key');

// 2. Encrypt message using User B's public key
const plaintext = "Hello";
const nonce = nacl.randomBytes(24);
const encrypted = nacl.secretbox(
  nacl.util.decodeUTF8(plaintext),
  nonce,
  nacl.box(
    nacl.util.decodeUTF8(plaintext),
    nonce,
    userBPublicKey,
    userAPrivateKey
  )
);

// 3. Base64 encode for transmission
const encryptedBase64 = btoa(String.fromCharCode(...encrypted));

// 4. Send to server
POST /api/messages {
  conversationId: "...",
  encryptedContent: encryptedBase64,
  nonce: btoa(String.fromCharCode(...nonce))
}
```

**Step 2: Server Side (No Decryption)**
```sql
-- Server receives encrypted blob and stores as-is
-- Cannot decrypt (doesn't have private keys)
INSERT INTO messages 
(conversation_id, sender_id, encrypted_content, content_type, created_at)
VALUES 
(?, ?, 'k7uQ8xK/w9Lm...', 'text', CURRENT_TIMESTAMP);
```

**Step 3: Client Side (Decryption)**
```javascript
// User B receives encrypted message

// 1. Get encrypted content from server
const message = {
  encryptedContent: 'k7uQ8xK/w9Lm...',
  nonce: '...'
};

// 2. Decrypt using own private key
const encryptedBytes = Uint8Array.from(
  atob(message.encryptedContent),
  c => c.charCodeAt(0)
);
const nonceBytes = Uint8Array.from(atob(message.nonce), c => c.charCodeAt(0));

const decrypted = nacl.secretbox.open(
  encryptedBytes,
  nonceBytes,
  userBPrivateKey
);

// 3. Convert back to text
const plaintext = nacl.util.encodeUTF8(decrypted);
// Result: "Hello"
```

**What Server Sees:**
```
encrypted_content: 'k7uQ8xK/w9Lm...'  ← Random blob, unreadable
sender_id: 550e8400-...                ← Metadata visible
created_at: 2024-06-25T14:32:15Z       ← Metadata visible
```

**What Server CANNOT See:**
- ❌ Message content ("Hello")
- ❌ Any information about the plaintext
- ❌ Who the message is for (only sender visible)

---

## 8. Data Privacy & Compliance

### GDPR Right to be Forgotten

```sql
-- User requests data deletion
BEGIN TRANSACTION;

-- 1. Delete encryption keys
DELETE FROM user_encryption_keys WHERE user_id = ?;

-- 2. Remove from conversations
UPDATE conversation_members SET left_at = CURRENT_TIMESTAMP 
WHERE user_id = ? AND left_at IS NULL;

-- 3. Anonymize sent messages
UPDATE messages SET sender_id = NULL 
WHERE sender_id = ?;

-- 4. Delete user profile
UPDATE users SET deleted_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- 5. Delete sessions
DELETE FROM sessions WHERE user_id = ?;

COMMIT;
```

### Data Retention Policy

```sql
-- Delete soft-deleted users after 90 days
DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '90 days';

-- Delete archived conversations after 1 year
DELETE FROM conversations WHERE archived_at < NOW() - INTERVAL '1 year';

-- Delete deleted messages after 30 days
DELETE FROM messages WHERE deleted_at < NOW() - INTERVAL '30 days';

-- Delete expired sessions
DELETE FROM sessions WHERE expires_at < NOW();
```

---

## 9. Backup & Recovery

### PostgreSQL Backup Strategy

```bash
# Full backup (daily)
pg_dump securechat > backup_$(date +%Y%m%d).sql

# Compressed backup (for storage)
pg_dump securechat | gzip > backup_$(date +%Y%m%d).sql.gz

# Continuous WAL archiving (for PITR - Point In Time Recovery)
# Set in postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'test ! -f /backups/wal/%f && cp %p /backups/wal/%f'
```

### Recovery Process

```bash
# Restore from full backup
psql securechat < backup_20240625.sql

# Restore with WAL recovery (if needed)
# Set restore_command in recovery.conf
# Place backup, then PostgreSQL will apply WAL files
```

**Backup Schedule:**
- Full backup: Daily (off-peak hours)
- Transaction logs: Every hour
- Test restore: Weekly

---

## 10. Monitoring & Optimization

### Key Metrics to Monitor

```sql
-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries taking > 100ms
ORDER BY total_time DESC
LIMIT 20;
```

### Optimization Techniques

**1. Connection Pooling**
```javascript
// PgBouncer or node-postgres pool
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**2. Query Optimization**
```sql
-- Use EXPLAIN ANALYZE to check query plans
EXPLAIN ANALYZE
SELECT * FROM messages 
WHERE conversation_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- Should show "Index Scan" using idx_messages_conversation_id_created_at
```

**3. Caching with Redis**
```javascript
// Cache user encryption keys (static per key)
const cacheKey = `pubkey:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const key = await db.query('SELECT public_key FROM user_encryption_keys ...');
await redis.setex(cacheKey, 86400, JSON.stringify(key));  // Cache 24h
return key;
```

---

## 11. Database Migration Strategy

### Tools: Prisma Migrations or Flyway

```javascript
// Prisma migration workflow
npx prisma migrate dev --name add_messages_table
npx prisma migrate deploy  // In production
npx prisma migrate reset   // In dev (resets DB)
```

### Migration Example

```sql
-- migration_001_create_users_table.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
```

### Zero-Downtime Migrations

```sql
-- ✅ Safe: Add non-required column
ALTER TABLE users ADD COLUMN bio TEXT;

-- ❌ Unsafe: Drop column (breaks app)
ALTER TABLE users DROP COLUMN bio;

-- ✅ Safe: Add index (doesn't lock reads)
CREATE INDEX CONCURRENTLY idx_new ON messages(created_at);

-- ✅ Safe: Add ENUM value
ALTER TYPE call_type ADD VALUE 'group_video';
```

---

## 12. Database Security

### Access Control

```sql
-- Create application user (read/write)
CREATE USER securechat_app WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO securechat_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO securechat_app;

-- Create read-only user (for analytics)
CREATE USER securechat_readonly WITH PASSWORD 'readonly_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO securechat_readonly;
```

### Network Security

```bash
# PostgreSQL config (postgresql.conf)
listen_addresses = 'localhost'  # Only local connections
# OR
listen_addresses = '10.0.0.0/8'  # Private network only

# Use SSL/TLS for remote connections
ssl = on
ssl_cert_file = '/etc/ssl/certs/cert.pem'
ssl_key_file = '/etc/ssl/private/key.pem'
```

### SQL Injection Prevention

```javascript
// ✅ Safe: Use parameterized queries
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]
);

// ❌ UNSAFE: String concatenation
const result = await db.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`
);
```

---

## 13. Data Validation

### Application-Level Validation

```typescript
// Zod schema for message creation
import { z } from 'zod';

const CreateMessageSchema = z.object({
  conversationId: z.string().uuid(),
  encryptedContent: z.string().min(1).max(50000),  // Encrypted blob
  nonce: z.string().min(1).max(200),  // Base64 encoded
  contentType: z.enum(['text', 'system']).default('text'),
});

// Validation before insert
const validated = CreateMessageSchema.parse(req.body);
await db.query('INSERT INTO messages ...', [validated]);
```

### Database Constraints

All validation above backed by CHECK constraints in database (defense in depth).

---

## 14. Open Schema Decisions

**Questions to finalize:**

1. **Message Deletion:** Soft delete or hard delete?
   - Recommended: Soft delete (deleted_at timestamp)

2. **Encryption Key Rotation:** Support in MVP?
   - Recommended: Not in MVP (can add in V2)

3. **Message Editing History:** Keep old versions?
   - Recommended: Not in MVP

4. **Group Permissions:** Complex roles?
   - Recommended: Simple (admin/member) for MVP

5. **Conversation Search/Archive:** Support?
   - Recommended: Archive for MVP, search in V2

6. **Message Reactions:** Support?
   - Recommended: Not in MVP (add in V2)

7. **Call Recording:** Support?
   - Recommended: Not in MVP (privacy concerns)

---

## 15. Disaster Recovery Plan

**RPO (Recovery Point Objective):** 1 hour
**RTO (Recovery Time Objective):** 4 hours

```
1. Daily full backups (off-peak)
2. Hourly incremental backups (transaction logs)
3. Weekly test restore
4. Geo-replicated backup storage (separate region)

If database corrupted:
1. Restore from latest full backup
2. Apply transaction logs from backup time
3. Verify data integrity
4. Switch to backup (if replication set up)
```

---

This schema is production-ready and designed for:
- ✅ E2E encryption (encrypted content storage)
- ✅ Read receipts (message_reads table)
- ✅ Call history tracking
- ✅ Group management
- ✅ Data privacy (soft deletes, minimal metadata)
- ✅ Performance (optimized indexes)
- ✅ Scalability (UUID keys, partitioning-ready)
