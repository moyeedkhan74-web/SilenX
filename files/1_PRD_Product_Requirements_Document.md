# Product Requirements Document (PRD)
## Secure Chat App with End-to-End Encryption

---

## 1. App Overview

**App Name:** SecureChat (or your preferred name)

**One-Line Idea:** 
A Google OAuth-authenticated messaging platform with military-grade end-to-end encryption, supporting text, audio calls, and video calls across web and mobile devices.

**Tagline:** 
"Privacy-First Communication Platform"

---

## 2. Target Users

- **Primary:** Privacy-conscious users (18-65 years old)
- **Secondary:** Business teams needing secure communication
- **Tertiary:** International users avoiding phone number-based apps
- **Geographic:** Global (initially English-speaking markets)
- **Device Usage:** Desktop, tablet, and smartphone users

---

## 3. Problem Statement

**Problems Solved:**
1. WhatsApp/Telegram require phone numbers (privacy concern)
2. Most chat apps don't offer true end-to-end encryption by default
3. Users want one platform for text, voice, and video (without switching apps)
4. Developers/platforms often have access to user data
5. No open alternative with Google single sign-on (SSO)

---

## 4. Core Features (MVP - Version 1.0)

### 4.1 Authentication & User Management
- [ ] Google OAuth 2.0 login
- [ ] Automatic UID assignment (unique identifier per user)
- [ ] QR code generation for UID
- [ ] User profile creation (display name, avatar, bio, status)
- [ ] Profile customization
- [ ] Online/offline status
- [ ] Last seen timestamp
- [ ] Account deletion option
- [ ] Share UID via QR code (display, copy, download)

### 4.2 One-to-One Messaging
- [ ] Send and receive encrypted text messages
- [ ] Message timestamps
- [ ] Read receipts (seen/unseen)
- [ ] Typing indicators
- [ ] Delete message for me / Delete for everyone
- [ ] Edit message capability
- [ ] Message search within conversations
- [ ] Emoji support

### 4.3 Group Messaging
- [ ] Create group chats
- [ ] Add/remove members
- [ ] Group admin controls
- [ ] Group info page
- [ ] Group avatar and name
- [ ] Group member list
- [ ] Leave group
- [ ] Mute notifications for groups

### 4.4 Audio & Video Calls
- [ ] One-to-one audio calls
- [ ] One-to-one video calls
- [ ] Call notifications
- [ ] Missed call log
- [ ] Call duration tracking
- [ ] End call functionality
- [ ] Mute/unmute audio
- [ ] Disable/enable video during call

### 4.5 Security & Encryption
- [ ] End-to-end encryption for all messages
- [ ] End-to-end encryption for calls (audio/video)
- [ ] Key exchange mechanism (no server-side key storage)
- [ ] Perfect forward secrecy
- [ ] Encryption at rest for local storage
- [ ] Security notifications for key changes
- [ ] No metadata access (even server can't see content)

### 4.6 User Experience
- [ ] Conversation list view
- [ ] Search users to start chat
- [ ] Dark mode and light mode
- [ ] Responsive design (mobile & desktop)
- [ ] Push notifications (encrypted)
- [ ] Offline message queueing
- [ ] Message sync across devices

---

## 5. User Roles

| Role | Permissions |
|------|------------|
| **User** | Send/receive messages, create groups, join groups, start calls, edit own profile |
| **Group Admin** | Add/remove members, delete group, change group settings |
| **System** | No data access (end-to-end encryption), handle routing only |

---

## 6. User Stories

### Story 1: Authentication
**As a** new user  
**I want to** sign up using Google OAuth  
**So that** I don't need to share my phone number

**Acceptance Criteria:**
- Google login button visible on splash screen
- OAuth redirects to Google, then back to app
- User profile created automatically with Google email
- User can customize display name and avatar

---

### Story 2: Add User via UID/QR
**As a** user  
**I want to** add other users by scanning their QR code or entering their UID  
**So that** I can connect with them privately

**Acceptance Criteria:**
- Scan QR code using device camera
- Or manually enter UID in text input
- System finds user by UID
- Create new conversation
- Connection established

### Story 2b: Share UID/QR
**As a** user  
**I want to** share my UID and QR code with others  
**So that** they can add me

**Acceptance Criteria:**
- View my UID on profile
- Click to copy UID to clipboard
- Display QR code in modal
- Download QR code as image
- QR code contains my UID

### Story 3: One-to-One Chat
**As a** user  
**I want to** message my added contacts  
**So that** I can have private encrypted conversations

**Acceptance Criteria:**
- Send encrypted message
- Receive encrypted message (decrypted locally)
- See read receipts
- Delete/edit messages

---

### Story 4: Group Chat
**As a** user  
**I want to** create a group and add users by their UID/QR code  
**So that** I can discuss topics with a team

**Acceptance Criteria:**
- Create group with name and avatar
- Add multiple members by scanning QR or entering UID
- All messages encrypted and visible to group
- Leave group anytime
- Admin can remove members

---

### Story 5: Audio Call
**As a** user  
**I want to** make encrypted audio calls  
**So that** I can have private voice conversations

**Acceptance Criteria:**
- Initiate call from conversation
- Receive call notification
- Accept/reject call
- Mute/unmute during call
- End call
- Call duration visible

---

### Story 6: Video Call
**As a** user  
**I want to** make encrypted video calls  
**So that** I can see the person I'm talking to

**Acceptance Criteria:**
- Initiate video call from conversation
- Share video feed
- Toggle camera on/off
- See other person's video feed
- Mute audio during video call
- End call

---

### Story 7: Encryption Assurance
**As a** privacy-conscious user  
**I want to** verify my chat is encrypted  
**So that** I can trust the platform

**Acceptance Criteria:**
- "Encrypted" badge on all conversations
- Security notification when encryption key changes
- Option to verify recipient's encryption key (future)
- No warning messages about unencrypted data

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| User registration (first 6 months) | 10,000+ users |
| Daily active users | 30% of registered users |
| Message delivery rate | 99.9% |
| Call connection success rate | 98%+ |
| Average message latency | < 2 seconds |
| App crash rate | < 0.1% |
| User retention (30 days) | 40%+ |

---

## 8. MVP Scope (Version 1.0)

### Included:
✅ Google OAuth login  
✅ User profiles and status  
✅ One-to-one encrypted messaging  
✅ Group chat (basic)  
✅ One-to-one audio calls (encrypted)  
✅ One-to-one video calls (encrypted)  
✅ Message read receipts  
✅ Typing indicators  
✅ Push notifications  
✅ Web and mobile (responsive web + PWA)  
✅ Dark/light mode  

### NOT Included in Version 1:
❌ Message search/archive  
❌ File sharing (images, documents)  
❌ Voice messages  
❌ Stickers/GIFs  
❌ Group video calls  
❌ Message forwarding  
❌ Message reactions  
❌ User verification/badges  
❌ Advanced privacy settings  
❌ Message scheduling  
❌ Call recording  

---

## 9. Non-Functional Requirements

- **Security:** Military-grade E2E encryption (AES-256 or better)
- **Privacy:** No metadata storage, server-side analytics, or logging
- **Performance:** Messages delivered within 2 seconds
- **Scalability:** Support 1M+ concurrent users
- **Availability:** 99.9% uptime SLA
- **Compliance:** GDPR compliant, right to be forgotten
- **Accessibility:** WCAG 2.1 AA standard

---

## 10. Success Criteria for Launch

1. ✅ All core features working end-to-end
2. ✅ End-to-end encryption verified by security audit
3. ✅ Web app fully responsive on mobile/desktop
4. ✅ Mobile PWA installable on iOS/Android
5. ✅ Zero known critical security issues
6. ✅ Messaging latency < 2 seconds
7. ✅ Call quality tested with real data

---

## 11. Timeline (Estimated)

- **Phase 1 (Auth + Messaging):** 3-4 weeks
- **Phase 2 (Calls):** 2-3 weeks
- **Phase 3 (Security Hardening):** 2 weeks
- **Phase 4 (Testing & Deployment):** 1-2 weeks
- **Total MVP:** 8-11 weeks

---

## 12. Open Questions / Assumptions

**Assumptions:**
- Users will allow camera/microphone permissions
- Users have stable internet for calls
- Users understand encryption concepts
- Initially targeting English speakers

**Decisions to Make:**
- Should we support group video calls in MVP? (Currently no)
- Should we allow file sharing? (Currently no)
- What's the maximum group size? (Currently unlimited, but test at 500+)
- Should messages be backed up? (Currently no backup for privacy)
