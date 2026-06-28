# Technical Requirements Document (TRD)
## Secure Chat App with End-to-End Encryption

---

## 1. Technology Stack Overview

### Frontend Stack
- **Web:** React 18+ with TypeScript
- **State Management:** Redux Toolkit or Zustand
- **UI Components:** Material-UI (MUI) or Tailwind CSS
- **Real-time:** Socket.io client
- **Encryption Library:** TweetNaCl.js or libsodium.js
- **QR Code Generation:** qrcode.react (frontend) or qrcode (backend)
- **QR Code Scanning:** jsQR or html5-qrcode (camera scanning)
- **Build Tool:** Vite
- **Mobile PWA:** Workbox for service workers

### Backend Stack
- **Runtime:** Node.js 18+ or Deno
- **Framework:** Express.js or Fastify
- **Language:** TypeScript
- **Real-time Communication:** Socket.io server
- **Database:** PostgreSQL (relational)
- **Cache:** Redis (optional, for session management)
- **QR Code Generation:** qrcode (server-side QR generation)

### Infrastructure & Deployment
- **Hosting:** AWS (EC2 + RDS) or Google Cloud (Compute Engine + Cloud SQL)
- **CDN:** CloudFlare or AWS CloudFront
- **Video/Audio:** WebRTC (Peer-to-Peer) + TURN servers
- **Monitoring:** Sentry or LogRocket
- **CI/CD:** GitHub Actions or GitLab CI

### Encryption & Security
- **End-to-End Encryption:** libsodium (NaCl)
  - **Algorithm:** ChaCha20-Poly1305 (modern) or AES-256-GCM
  - **Key Exchange:** X25519 (Elliptic Curve Diffie-Hellman)
  - **Perfect Forward Secrecy:** Double Ratchet Algorithm (optional for MVP, add in V2)
  
- **Hashing:** Argon2 (password hashing)
- **Random Number Generation:** Secure RNG from OS
- **TLS/HTTPS:** Let's Encrypt certificates

---

## 2. Frontend Architecture

### Structure
```
frontend/
├── public/
├── src/
│   ├── components/        (UI components)
│   ├── pages/            (Page components)
│   ├── services/         (API calls)
│   ├── crypto/           (Encryption logic)
│   ├── store/            (Redux/Zustand state)
│   ├── hooks/            (Custom React hooks)
│   ├── utils/            (Utilities)
│   ├── types/            (TypeScript types)
│   └── App.tsx
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Key Technologies

| Purpose | Technology |
|---------|-----------|
| State Mgmt | Redux Toolkit / Zustand |
| UI Components | MUI + Tailwind CSS |
| HTTP Requests | Axios or Fetch API |
| Real-time | Socket.io-client |
| Encryption | TweetNaCl.js or libsodium.js |
| Form Validation | React Hook Form + Zod |
| Routing | React Router v6 |
| Testing | Vitest + React Testing Library |
| Icons | Feather Icons or MUI Icons |

### Components Architecture
- **Pages:** Login, Chat, Contacts, Call, Profile, Settings
- **Layouts:** Sidebar Layout, Full-Screen Call Layout
- **Shared Components:** Message Bubble, User Avatar, Input Field, Modal, etc.

---

## 3. Backend Architecture

### Folder Structure
```
backend/
├── src/
│   ├── controllers/       (Route handlers)
│   ├── services/          (Business logic)
│   ├── middlewares/       (Auth, validation, etc.)
│   ├── models/            (Database models)
│   ├── routes/            (API routes)
│   ├── crypto/            (Encryption logic)
│   ├── websocket/         (Socket.io handlers)
│   ├── types/             (TypeScript types)
│   ├── config/            (Configuration)
│   ├── utils/             (Utility functions)
│   └── server.ts
├── tests/
├── .env
├── .env.example
├── tsconfig.json
└── package.json
```

### API Architecture
- **REST API:** For authentication, user lookup, profile management
- **WebSocket (Socket.io):** For real-time messaging, calls, typing indicators
- **GraphQL:** (Optional, not in MVP)

### Key Technologies

| Purpose | Technology |
|---------|-----------|
| Framework | Express.js or Fastify |
| ORM | TypeORM or Prisma |
| Database | PostgreSQL |
| Real-time | Socket.io |
| Auth | JWT + Refresh Tokens |
| Email Verification | Nodemailer or SendGrid |
| WebRTC | WebRTC libraries (RTCPeerConnection) |
| Logging | Winston or Pino |
| Rate Limiting | express-rate-limit |

---

## 4. Database Schema (PostgreSQL)

### Core Tables

#### users
```
- id (UUID, Primary Key)
- uid (VARCHAR, UNIQUE, NOT NULL) - User ID for sharing (e.g., "SEC_8f7d6e5c")
- email (VARCHAR, UNIQUE, NOT NULL)
- google_id (VARCHAR, UNIQUE)
- display_name (VARCHAR)
- avatar_url (TEXT)
- status (ENUM: online, away, offline)
- last_seen (TIMESTAMP)
- bio (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP, soft delete)
```

#### user_encryption_keys
```
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → users)
- public_key (TEXT, NOT NULL)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP, optional)
```

#### conversations
```
- id (UUID, Primary Key)
- type (ENUM: direct, group)
- name (VARCHAR, for groups)
- avatar_url (TEXT, for groups)
- created_by (UUID, Foreign Key → users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### conversation_members
```
- id (UUID, Primary Key)
- conversation_id (UUID, Foreign Key → conversations)
- user_id (UUID, Foreign Key → users)
- joined_at (TIMESTAMP)
- left_at (TIMESTAMP, nullable)
- muted (BOOLEAN, default: false)
```

#### messages
```
- id (UUID, Primary Key)
- conversation_id (UUID, Foreign Key → conversations)
- sender_id (UUID, Foreign Key → users)
- encrypted_content (TEXT, encrypted)
- content_type (ENUM: text, system)
- created_at (TIMESTAMP)
- edited_at (TIMESTAMP, nullable)
- deleted_at (TIMESTAMP, nullable)
```

#### message_reads
```
- id (UUID, Primary Key)
- message_id (UUID, Foreign Key → messages)
- user_id (UUID, Foreign Key → users)
- read_at (TIMESTAMP)
```

#### calls
```
- id (UUID, Primary Key)
- conversation_id (UUID, Foreign Key → conversations)
- initiator_id (UUID, Foreign Key → users)
- receiver_id (UUID, Foreign Key → users)
- call_type (ENUM: audio, video)
- status (ENUM: pending, accepted, rejected, missed, ended)
- started_at (TIMESTAMP)
- ended_at (TIMESTAMP, nullable)
- duration_seconds (INTEGER, nullable)
```

#### sessions
```
- id (VARCHAR, Primary Key)
- user_id (UUID, Foreign Key → users)
- refresh_token (TEXT)
- ip_address (VARCHAR)
- user_agent (TEXT)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

### Indexes
```
- users(email)
- users(google_id)
- user_encryption_keys(user_id)
- conversation_members(conversation_id)
- conversation_members(user_id)
- messages(conversation_id, created_at DESC)
- messages(sender_id)
- message_reads(message_id)
- calls(conversation_id)
- calls(created_at DESC)
- sessions(user_id)
```

---

## 5. Authentication & Authorization

### Authentication Flow

**Step 1: Google OAuth**
```
1. User clicks "Login with Google"
2. Frontend redirects to Google OAuth endpoint
3. Google returns authorization code
4. Frontend sends code to backend
5. Backend exchanges code for Google ID token
6. Backend verifies token and creates/updates user
7. Backend generates JWT + Refresh Token
8. Frontend stores JWT in memory, Refresh Token in secure HTTP-only cookie
```

### JWT & Token Strategy
- **Access Token:** Valid for 15 minutes, stored in memory
- **Refresh Token:** Valid for 7 days, stored in HTTP-only cookie
- **Token Rotation:** New refresh token issued on every use

### Authorization
- Users can only:
  - See conversations they're a member of
  - See messages in conversations they're in
  - Initiate calls with other users
  - Edit/delete own messages
  - Not see other users' encryption keys in plaintext

---

## 6. End-to-End Encryption Details

### Key Management

**Phase 1 (MVP - Simple):**
- Each user has ONE long-lived X25519 public/private key pair
- Public keys stored on server (needed for message encryption)
- Private keys NEVER sent to server (stored locally)
- Users retrieve each other's public keys to encrypt messages

**Encryption Process:**
```
1. User A types message → "Hello"
2. User A retrieves User B's public key from server
3. User A encrypts: ChaCha20-Poly1305(plaintext, User B's public key via X25519)
4. User A sends encrypted blob to server
5. Server stores encrypted blob (can't read it)
6. Server sends encrypted blob to User B
7. User B decrypts using own private key
8. Message appears as plaintext only on User B's device
```

### Encryption Libraries
- **JavaScript:** TweetNaCl.js (lightweight) or libsodium.js (comprehensive)
- **Installation:**
  ```bash
  npm install tweetnacl libsodium.js
  ```

### Call Encryption
- WebRTC connections are encrypted by default (DTLS-SRTP)
- No additional application-level encryption needed for calls (WebRTC handles it)

### Data at Rest
- Local IndexedDB: Messages cached locally with same encryption
- Server: Encrypted message blobs stored as-is (can't decrypt)

---

## 7. Real-Time Communication (Socket.io)

### WebSocket Events

**Client → Server:**
- `send-message` - New message
- `typing` - Typing indicator
- `read-receipt` - Message marked as read
- `call-initiate` - Start call
- `call-accept` - Accept incoming call
- `call-reject` - Reject incoming call
- `call-end` - End call
- `user-status` - Update online/offline status

**Server → Client:**
- `receive-message` - New incoming message
- `user-typing` - Someone is typing
- `message-delivered` - Message delivered
- `message-read` - Message read by recipient
- `call-incoming` - Incoming call notification
- `call-accepted` - Call accepted by recipient
- `call-rejected` - Call rejected
- `call-ended` - Call ended
- `user-status-changed` - User came online/offline

---

## 8. WebRTC Configuration

### TURN Servers
- For peer-to-peer calls, need TURN servers (if direct connection fails)
- Options:
  - **Twilio TURN Service** ($0.06/GB)
  - **Open Relay Project** (free)
  - **Self-hosted TURN** (Coturn)

### Call Flow
```
1. User A clicks "Call User B"
2. User A sends "call-initiate" event via Socket.io
3. User B receives notification
4. User B clicks "Accept"
5. User A creates RTCPeerConnection
6. User A creates SDP offer
7. User A sends offer to User B via Socket.io
8. User B receives offer
9. User B creates RTCPeerConnection
10. User B creates SDP answer
11. User B sends answer to User A via Socket.io
12. ICE candidates exchanged
13. P2P connection established
14. Media stream flows directly (encrypted by WebRTC)
```

---

## 9. API Endpoints (REST)

### Authentication
- `POST /api/auth/google` - Login with Google token
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update profile
- `GET /api/users/me/uid` - Get current user's UID
- `GET /api/users/me/qr` - Get current user's QR code (image or data URL)
- `POST /api/users/me/qr/download` - Download QR code as image
- `GET /api/users/by-uid/:uid` - Get user by UID (for adding)
- `GET /api/users/:id/public-key` - Get user's public encryption key

### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation details
- `GET /api/conversations/:id/messages` - Get messages (paginated)
- `POST /api/conversations/:id/members` - Add member to group

### Calls
- `GET /api/calls/history` - Get call history
- `POST /api/calls/:id/end` - Record call end time

---

## 10. Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/securechat

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# WebRTC TURN Servers
TURN_SERVER_URL=turn:turn.example.com
TURN_USERNAME=username
TURN_PASSWORD=password

# Encryption
ENCRYPTION_ALGORITHM=ChaCha20-Poly1305

# Server
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com

# Logging
LOG_LEVEL=info

# Sentry (Error tracking)
SENTRY_DSN=your_sentry_dsn
```

---

## 11. Security Considerations

### Protection Against Attacks
- **XSS (Cross-Site Scripting):** Content Security Policy (CSP) headers
- **CSRF:** SameSite cookies + CSRF tokens
- **SQL Injection:** Parameterized queries (ORM)
- **Man-in-the-Middle:** TLS/HTTPS only
- **Message Tampering:** Authenticated encryption (Poly1305)
- **Replay Attacks:** Timestamps + message IDs
- **Brute Force:** Rate limiting on auth endpoints
- **Session Hijacking:** Secure HTTP-only cookies + IP validation

### Headers to Set
```
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer
```

---

## 12. Performance Requirements

| Metric | Target |
|--------|--------|
| Message delivery latency | < 2 seconds |
| Call connection time | < 5 seconds |
| Page load time | < 3 seconds |
| API response time | < 500ms |
| Database query time | < 100ms |
| Concurrent connections | 1M+ users |

### Optimization Strategies
- Database connection pooling
- Message pagination (load 20 messages initially)
- Code splitting & lazy loading (React)
- Image compression & CDN
- Caching with Redis
- Database indexing on frequently queried columns

---

## 13. Testing Strategy

| Test Type | Coverage | Tools |
|-----------|----------|-------|
| Unit Tests | 80%+ | Vitest, Jest |
| Integration Tests | 60%+ | Supertest |
| E2E Tests | 40%+ | Playwright, Cypress |
| Security Tests | Encryption logic | Manual + OWASP |
| Load Tests | 10k concurrent | K6 or Apache JMeter |

---

## 14. Deployment

### Development
- Local development with Docker Compose
- Frontend: `npm run dev`
- Backend: `npm run dev`
- Database: PostgreSQL in Docker

### Production
- Docker containers for frontend & backend
- Kubernetes (optional) for scaling
- Nginx as reverse proxy
- CloudFlare for CDN

### CI/CD Pipeline
```
1. Push to GitHub
2. GitHub Actions runs tests
3. If tests pass, build Docker images
4. Push to Docker registry
5. Deploy to production (AWS/GCP)
6. Health checks validate deployment
```

---

## 15. Scalability & Architecture Decisions

### Why Node.js + Express?
- Fast for I/O operations (messaging)
- WebSocket support via Socket.io
- Large ecosystem (npm packages)

### Why PostgreSQL?
- Relational data (conversations, members, messages)
- ACID transactions
- JSON support for flexibility

### Why WebRTC?
- Peer-to-peer (no server bandwidth cost)
- Built-in encryption (DTLS-SRTP)
- Low latency

### Horizontal Scaling
- Backend: Multiple Node.js instances behind load balancer
- Database: Master-slave replication (PostgreSQL)
- Socket.io: Socket.io Redis adapter for message distribution
- Storage: S3/GCS for file uploads (future)

---

## 16. Monitoring & Logging

### Metrics to Track
- API response times
- WebSocket message latency
- Database query times
- Call connection success rate
- User authentication failures
- Encryption errors

### Tools
- **Error Tracking:** Sentry
- **Analytics:** Google Analytics or Mixpanel
- **Logging:** Winston or ELK Stack
- **Monitoring:** DataDog or New Relic

---

## 17. Open Technical Decisions

- **Group Video Calls:** Requires SFU (Selective Forwarding Unit), not MVP
- **Message Search:** Requires Elasticsearch, future version
- **File Sharing:** Requires encrypted S3 storage, future version
- **Offline Message Queue:** Optional, use local IndexedDB for draft messages
