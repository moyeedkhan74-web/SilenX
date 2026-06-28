# UID/QR Code Discovery System - Changes Summary

## Overview

The chat app has been updated to use a **privacy-first UID/QR code discovery system** instead of searching by display name or phone numbers.

**Key Concept:** Each user gets a unique ID (UID) when they sign up. Users can:
- View their UID (e.g., "SEC_8f7d6e5c4b3a2910")
- Share their QR code (shows their UID in QR format)
- Download QR code as an image
- Copy their UID to clipboard
- Scan other users' QR codes to add them as contacts
- Manually enter UIDs to add contacts

---

## Changes Made to Each Document

### 📋 1. PRD (Product Requirements)

**What Changed:**
- Removed "Search users by display name" feature
- Added new features:
  - **UID Assignment** - Auto-assign unique UID on signup
  - **QR Code Generation** - Generate QR for each user's UID
  - **QR Display** - Modal showing UID + QR code
  - **Copy UID Button** - One-click copy to clipboard
  - **Download QR Button** - Save QR as PNG image
  - **QR Scanning** - Scan QR codes to add contacts
  - **Manual UID Entry** - Type UID to add contacts

**Updated User Stories:**
- Story 1: Authentication → Now generates UID + QR
- Story 2: Add User via UID/QR → New story for contact discovery
- Story 2b: Share UID/QR → New story for sharing
- Story 3: One-to-One Chat → Messaging (same as before)
- Stories 4-7: Groups, Calls, Encryption (same as before)

**Key Section:**
```
Core Features → Authentication & User Management
- Automatic UID assignment (unique identifier per user)
- QR code generation for UID
- Share UID via QR code (display, copy, download)
```

---

### ⚙️ 2. TRD (Technical Requirements)

**What Changed:**
- Added QR code generation libraries to tech stack
- Updated database schema to include UID field
- Changed API endpoints from search to UID lookup
- Added QR code generation logic

**Frontend Stack Addition:**
```
- QR Code Generation: qrcode.react
- QR Code Scanning: html5-qrcode or jsQR
```

**Backend Stack Addition:**
```
- QR Code Generation: qrcode (npm package)
```

**Database Changes:**
```
users table:
- Added: uid VARCHAR(64) UNIQUE NOT NULL
  Example: "SEC_8f7d6e5c4b3a2910"
- Added index: idx_users_uid
```

**API Endpoint Changes:**

| Old | New | Purpose |
|-----|-----|---------|
| GET /api/users/search?q=name | GET /api/users/by-uid/:uid | Lookup user by UID |
| - | GET /api/users/me/qr | Get user's QR code |
| - | GET /api/users/me/uid | Get user's UID |

---

### 🔄 3. App Flow

**What Changed:**
- Replaced "User Search" flow with "UID/QR Code Share" flow
- Added "Add Contact via UID/QR" flow
- Updated sidebar navigation to show UID/QR features in profile

**New Flows Added:**

1. **Share My UID/QR Code:**
   - User opens profile
   - Sees their UID (copyable)
   - Clicks "Show QR" → Modal opens
   - Shows large QR code (300x300px)
   - Options: Copy UID, Download QR, Close

2. **Add Contact via UID/QR:**
   - User clicks "Add Contact"
   - Two options:
     a) Scan QR Code (opens camera)
     b) Enter UID manually (text input)
   - System looks up user by UID
   - Shows user preview
   - Click "Add Contact" to create conversation

**Navigation Updated:**
- Profile Tab now shows:
  - User's UID (prominently displayed)
  - "Show QR Code" button
  - "Download QR" button

- Contacts Tab now shows:
  - "Add Contact" button (instead of search bar)
  - Existing contacts list

---

### 🎨 4. UI/UX Design Brief

**What Changed:**
- Added detailed designs for UID/QR displays
- Added modal specifications for QR code sharing
- Added add contact modal specifications
- Updated component dimensions and layouts

**New Components Designed:**

1. **UID/QR Code Modal:**
   - Title: "Your Secure ID"
   - QR code (300x300px, centered)
   - UID text (monospace, copyable)
   - [Copy UID] button
   - [Download QR] button

2. **Add Contact Modal:**
   - Two tabs:
     - Tab 1: Scan QR (camera feed)
     - Tab 2: Enter UID (text input)
   - User preview after lookup
   - Error state for invalid UIDs

**Color Scheme for UID/QR:**
- UID Text: #2E5BBA (brand blue, monospace)
- QR Background: #FFFFFF (white)
- QR Pattern: #212121 (dark)
- Buttons: Primary blue or secondary gray

---

### 🗄️ 5. Backend Schema

**What Changed:**
- Added UID column to users table
- Added index for fast UID lookups
- Updated example data to show UID

**Users Table Update:**
```sql
ALTER TABLE users ADD COLUMN uid VARCHAR(64) UNIQUE NOT NULL;
CREATE INDEX idx_users_uid ON users(uid);
```

**Example User Data:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "uid": "SEC_8f7d6e5c4b3a2910",  ← NEW
  "email": "john@example.com",
  "google_id": "118277335344963903896",
  "display_name": "John Doe",
  "avatar_url": "https://...",
  "bio": "Software engineer",
  "status": "online",
  ...
}
```

**UID Generation Logic:**
- Format: "SEC_" + 12 random hex characters
- Examples: "SEC_8f7d6e5c4b3a", "SEC_a1b2c3d4e5f6g7"
- Unique per user (database constraint)
- Generated once during signup, never changes

---

### 🛠️ 6. Implementation Plan

**What Changed:**
- Extended Phase 2 (Authentication) with UID/QR generation
- Added Phase 2.3: UID & QR Code Display
- Added Phase 2.4: Add Contact by UID/QR Scanning
- Removed user search implementation from Phase 3

**Phase 2 Breakdown (Updated):**

1. **Phase 2.1** (Backend Auth)
   - Google OAuth implementation
   - JWT token generation
   - UID generation in `getOrCreateUser`

2. **Phase 2.2** (Frontend Auth)
   - Google login UI
   - Auth store setup
   - Token management

3. **Phase 2.3** (NEW: UID & QR Display)
   - Backend QR code generation endpoints
   - Frontend QR code modal
   - Copy/Download buttons
   - Duration: 3-4 days

4. **Phase 2.4** (NEW: Add Contact by UID/QR)
   - Backend UID lookup endpoints
   - Frontend QR scanner component
   - Manual UID entry component
   - User preview modal
   - Duration: 4-5 days

**Phase 3.1 Updated:**
- Removed: `searchUsers()` function
- Kept: User profile management
- Kept: Encryption key generation

**Libraries Added:**
```
Backend:
- npm install qrcode

Frontend:
- npm install qrcode.react html5-qrcode
```

---

## User Flow Comparison

### Before (Search-Based)
```
1. User A opens app
2. User A types "John" in search
3. System shows matching users
4. User A clicks "Start Chat" with John
5. Conversation created
```

### After (UID/QR-Based)
```
1. User A opens "Add Contact"
2. Option A: Scan John's QR code
   OR
   Option B: Type John's UID (SEC_8f7d6e5c...)
3. System looks up user by UID
4. Shows John's profile preview
5. User A clicks "Add Contact"
6. Conversation created
```

**Advantages:**
✅ More private (no display name search)  
✅ No duplicate names confusion  
✅ Physical QR sharing (email, print, poster)  
✅ UID can be shared in any communication  
✅ Prevents spam/unwanted contact suggestions  
✅ More intentional connections (both must agree)  

---

## Implementation Order

The updated implementation plan flows as:

```
Phase 1: Setup (Database, Docker, CI/CD)
    ↓
Phase 2.1: Backend OAuth
    ↓
Phase 2.2: Frontend Auth + UID Display
    ↓
Phase 2.3: QR Code Generation & Display
    ↓
Phase 2.4: UID/QR Scanning & Contact Discovery
    ↓
Phase 3: User Profiles & Encryption Keys
    ↓
Phase 4: Messaging System
    ↓
Phase 5: Audio/Video Calls
    ↓
Phase 6: Groups
    ↓
Phase 7: Security & Testing
    ↓
Phase 8: Deployment & Launch
```

---

## API Changes Summary

### Removed Endpoints
- ❌ GET /api/users/search?q=name

### New Endpoints
- ✅ GET /api/users/by-uid/:uid (lookup by UID)
- ✅ GET /api/users/me/uid (get my UID)
- ✅ GET /api/users/me/qr (get my QR code)

### Updated Endpoints
- PUT /api/conversations (now accepts recipientUid instead of recipientId)

---

## Frontend Component Changes

### New Components
- `UIDShareModal.tsx` - Display UID/QR modal
- `AddContactScreen.tsx` - Add contact by UID/QR
- `QRScanner.tsx` - QR code scanning component
- `UserPreviewModal.tsx` - User profile preview

### Updated Components
- `ProfilePage.tsx` - Show UID and QR button
- `Sidebar.tsx` - Remove search, add UID display in profile
- `ContactsTab.tsx` - Show add contact button instead of search

### Removed Components
- ❌ UserSearchComponent (no longer needed)

---

## Data Migration

If migrating from old system to UID/QR:

```sql
-- Generate UIDs for existing users
UPDATE users 
SET uid = 'SEC_' || substr(md5(random()::text), 1, 12)
WHERE uid IS NULL;

-- Add unique constraint
ALTER TABLE users ADD CONSTRAINT unique_uid UNIQUE (uid);

-- Create index for fast lookups
CREATE INDEX idx_users_uid ON users(uid);
```

---

## Key Configuration

### UID Format
```
Prefix: "SEC_" (stands for "Secure")
Length: 16 characters total (4 + 12 random)
Characters: Hexadecimal (0-9, a-f)
Example: "SEC_8f7d6e5c4b3a"
```

### QR Code Data
```
Format: Deep link
Example: "securechat://uid/SEC_8f7d6e5c4b3a"
Encoding: URL-encoded
Size: 300x300px for display
Download: PNG format
```

### Security Considerations
- ✅ UID is public (safe to share)
- ✅ No sensitive data in UID
- ✅ UID is permanent per user account
- ✅ QR can be safely shared via any channel
- ✅ UID lookup requires authentication
- ✅ Can't look up users who don't exist

---

## Testing Checklist

### Backend
- [ ] Generate unique UID on signup
- [ ] Generate valid QR code from UID
- [ ] Lookup user by UID (success case)
- [ ] Lookup user by UID (not found case)
- [ ] UID format validation
- [ ] QR code generation quality
- [ ] QR code decoding accuracy

### Frontend
- [ ] Display UID on profile
- [ ] Copy UID to clipboard
- [ ] Show QR code modal
- [ ] Download QR code as PNG
- [ ] Scan QR code with camera
- [ ] Manual UID entry with validation
- [ ] Add contact from QR/UID
- [ ] User preview modal display
- [ ] Create conversation after adding

### End-to-End
- [ ] User A shares their QR
- [ ] User B scans QR
- [ ] Conversation created
- [ ] Users can message each other
- [ ] Read receipts work
- [ ] Calls work after adding via QR

---

## FAQ

**Q: Can I change my UID?**  
A: Not in MVP. UIDs are permanent per account.

**Q: What if I forget my UID?**  
A: It's always visible in your profile. Can also be regenerated in future versions.

**Q: Can I search for users by name anymore?**  
A: No, only by UID for privacy. Discovery is intentional via QR/UID sharing.

**Q: What if someone gets my UID?**  
A: They can only start a conversation with you (same as any messaging app). No spam risk since you must accept connections.

**Q: Can I have multiple UIDs?**  
A: Not in MVP. One UID per account.

**Q: Can other users see my UID?**  
A: Yes, it's visible when they preview your profile after scanning your QR or entering your UID.

---

## Summary

All 6 documents have been updated to reflect the **UID/QR Code Discovery System**:

1. ✅ **PRD** - New features for UID/QR sharing and discovery
2. ✅ **TRD** - QR libraries, API endpoints, database schema
3. ✅ **App Flow** - User journeys for sharing and adding by UID/QR
4. ✅ **UI/UX** - Modal designs for UID/QR displays
5. ✅ **Schema** - UID column and index in users table
6. ✅ **Implementation Plan** - Phases for UID/QR implementation

This is a **complete, production-ready specification** for building with the UID/QR discovery system. 🎉
