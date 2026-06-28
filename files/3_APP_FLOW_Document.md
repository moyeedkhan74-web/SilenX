# App Flow Document
## Secure Chat App User Journeys & Navigation

---

## 1. Overall App Navigation Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURECHAT APP FLOWS                        │
└─────────────────────────────────────────────────────────────────┘

LOGIN STATE (Unauthenticated)
├── Splash Screen
│   └─→ "Login with Google" Button
│       └─→ Google OAuth Screen
│           ├─→ Success → Dashboard
│           └─→ Cancel → Back to Splash Screen

AUTHENTICATED STATE (Logged In)
├── Dashboard (Main Navigation)
│   ├── Sidebar (Always Visible)
│   │   ├── Chats (Conversations List)
│   │   ├── Contacts (Search & Add)
│   │   ├── Profile
│   │   ├── Settings
│   │   └── Logout
│   │
│   ├── Main Content Area
│   │   ├── Conversation View
│   │   │   ├── Chat Messages
│   │   │   ├── Message Input
│   │   │   ├── Typing Indicator
│   │   │   ├── Call Buttons (Audio/Video)
│   │   │   └── Conversation Info
│   │   │
│   │   └── Contacts View
│   │       └── Start New Chat
│   │
│   ├── Call Screen (Full Screen Overlay)
│   │   ├── Incoming Call
│   │   │   ├── Accept Button
│   │   │   └── Reject Button
│   │   │
│   │   └── Active Call
│   │       ├── Remote Video Feed
│   │       ├── Local Video Feed (PiP)
│   │       ├── Mute Audio Button
│   │       ├── Toggle Video Button
│   │       └── End Call Button
│   │
│   └── Modals & Dialogs
│       ├── Profile Edit Modal
│       ├── Group Creation Modal
│       ├── Confirmation Dialogs
│       └── Error Messages
```

---

## 2. Authentication Flow

### 2.1 New User Flow (Sign Up)

```
START: User opens app
  ↓
[SPLASH SCREEN]
  - App Logo
  - "Login with Google" Button
  - "Privacy-First Messaging" tagline
  ↓
User clicks "Login with Google"
  ↓
[GOOGLE OAUTH SCREEN]
  - Redirects to Google login
  - User enters email & password (on Google)
  - User grants app permissions
  ↓
Google returns authorization code
  ↓
[BACKEND PROCESSING]
  - Backend exchanges code for ID token
  - Backend verifies token
  - Backend checks if user exists
  - Since new user → creates user record
  - Generates encryption key pair (frontend will do this)
  - Returns JWT + Refresh Token
  ↓
[FRONTEND PROCESSING]
  - Frontend receives JWT
  - Frontend generates X25519 key pair locally
  - Frontend sends public key to backend
  - Frontend stores JWT in memory
  - Frontend stores Refresh Token in HTTP-only cookie
  ↓
[PROFILE COMPLETION SCREEN]
  - Shows "Welcome!"
  - Display name: [auto-filled from Google]
  - Profile picture: [auto-filled from Google]
  - Status: [optional, defaults to "Online"]
  - "Complete Profile" Button
  ↓
User clicks "Complete Profile"
  ↓
[DASHBOARD]
  - Navigates to main chat screen
  - Empty state: "No conversations yet"
  - "Start a new chat" button
  ↓
END: User can now chat
```

### 2.2 Returning User Flow (Login)

```
START: User opens app
  ↓
[APP CHECKS]
  - localStorage has JWT? YES
  - Is JWT still valid? YES
  ↓
[DASHBOARD]
  - Direct to main screen
  - Load conversations list
  ↓
[REHYDRATE STATE]
  - Fetch user profile
  - Fetch conversations
  - Connect WebSocket
  ↓
END: User sees chat screen
```

### 2.3 Existing User, Expired Token

```
START: User opens app
  ↓
[APP CHECKS]
  - localStorage has JWT? NO
  - Refresh token cookie exists? YES
  ↓
[BACKEND REFRESH]
  - Send refresh token to /api/auth/refresh
  - Backend validates refresh token
  - Backend issues new JWT
  ↓
[STORE NEW JWT]
  - Save new JWT to memory
  - Proceed to dashboard
  ↓
END: User logged in silently (seamless)
```

### 2.4 Logout Flow

```
User clicks "Logout" in sidebar
  ↓
[CONFIRMATION DIALOG]
  - "Are you sure you want to logout?"
  - Cancel / Confirm buttons
  ↓
User clicks "Confirm"
  ↓
[CLEANUP]
  - Clear JWT from memory
  - Clear refresh token cookie
  - Disconnect WebSocket
  - Clear Redux/Zustand state
  ↓
[REDIRECT]
  - Navigate to splash screen
  ↓
END: User sees login screen
```

---

## 3. Main Dashboard Flow

### 3.1 Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│              DASHBOARD (Web + Mobile)            │
├─────────────┬─────────────────────────────────┤
│             │                                  │
│  SIDEBAR    │       MAIN CONTENT AREA         │
│             │                                  │
│ [Chats]     │                                  │
│ [Contacts]  │  ┌──────────────────────────┐  │
│ [Profile]   │  │    Conversation View     │  │
│ [Settings]  │  │                          │  │
│ [Logout]    │  │ [Messages Display]       │  │
│             │  │ [Message Input]          │  │
│             │  │ [Call Buttons]           │  │
│             │  │ [Attachments (future)]   │  │
│             │  └──────────────────────────┘  │
│             │                                  │
└─────────────┴─────────────────────────────────┘
```

### 3.2 Sidebar Navigation

#### Default State
- **Chats Tab** (Active)
  - Conversation list sorted by recent
  - New conversation button ("+")

- **Contacts Tab**
  - Add Contact button (Scan QR or Enter UID)
  - Existing contacts list
  - Quick action: Tap to open chat or call

- **Profile Tab**
  - User avatar
  - Display name
  - **User's UID** (highlighted, copiable)
  - **Show QR Code button**
  - **Download QR button**
  - Bio
  - Status selector (Online/Away/Offline)
  - Edit profile button

- **Settings Tab**
  - Theme toggle (Dark/Light)
  - Notifications
  - Privacy settings
  - About & Help
  - Logout button

---

## 4. Contact Discovery & Messaging Flow

### 4.1 Share My UID/QR Code

```
User clicks "My Profile" or "Settings"
  ↓
[PROFILE SCREEN]
  - Display user name, avatar
  - Display user's UID (e.g., "SEC_8f7d6e5c4b3a2910")
  - Three Action Buttons:
    ├─ [📋 Copy UID] - Copies to clipboard
    ├─ [📱 Show QR] - Opens QR modal
    └─ [⬇️ Download QR] - Downloads QR image
  ↓
[COPY UID]
  - Click "Copy UID"
  - UID copied to clipboard
  - Toast: "UID copied!"
  - User can share via email, message, etc
  ↓
[SHOW QR CODE - MODAL]
  - Click "Show QR"
  - Modal opens with:
    * Large QR code (centered)
    * UID displayed below QR
    * "Copy UID" button (text)
    * "Download QR" button (blue)
  ↓
[DOWNLOAD QR]
  - Click "Download QR"
  - Browser downloads "my_uid.png"
  - File saved to Downloads folder
  - User can print or share as image
  ↓
END: User can share UID in any way
```

### 4.2 Add Contact via UID/QR

```
User clicks "Add Contact" or "+" in Contacts tab
  ↓
[ADD CONTACT SCREEN]
  Two Options:
  - Option A: [📱 Scan QR Code] button
  - Option B: [🔐 Enter UID] button
  ↓
[OPTION A: SCAN QR CODE]
  - Click "Scan QR Code"
  - Request camera permission
  - Camera opens
  - Point at QR code
  - QR code detected automatically
  - Extract UID from QR data
  ↓
[OPTION B: ENTER UID MANUALLY]
  - Click "Enter UID"
  - Text input appears
  - Placeholder: "SEC_xxxxxxxxxx"
  - User pastes or types UID
  - Press Enter / Tab
  ↓
[LOOKUP USER BY UID]
  - Frontend: GET /api/users/by-uid/:uid
  - Backend queries users table WHERE uid = ?
  - If found: return user profile
  - If not found: show error "UID not found"
  ↓
[USER PROFILE PREVIEW]
  - Display:
    * User's avatar
    * User's display name
    * Online/offline status
    * "Add Contact" button (green)
    * "Cancel" button
  ↓
User clicks "Add Contact"
  ↓
[CREATE CONVERSATION]
  - Frontend: POST /api/conversations
  - Body: { type: 'direct', recipientUid: 'SEC_...' }
  - Backend creates conversation
  - Add both users as members
  - Generate encryption keys reference
  ↓
[REDIRECT TO CHAT]
  - Conversation list updated (shows new contact)
  - Opens conversation view
  - Shows empty chat: "Say hi!"
  - Focus on message input
  ↓
END: Contact added, ready to chat
```

### 4.3 Send Message Flow

```
User types message in input field
  ↓
[TYPING INDICATOR]
  - Emit "typing" event via WebSocket
  - Other user sees "User A is typing..."
  ↓
User clicks "Send" or presses Enter
  ↓
[FRONTEND ENCRYPTION]
  - Get User B's public key (cached or fetch)
  - Encrypt message: "Hello User B!" → encrypted_blob
  - Generate message ID
  ↓
[SEND VIA WEBSOCKET]
  - Emit "send-message" event with encrypted_blob
  - Add message to local state (optimistic update)
  - Show message in chat (pending state)
  ↓
[BACKEND RECEIVES]
  - Validate message
  - Store message in database (encrypted)
  - Emit "receive-message" to User B via WebSocket
  ↓
[USER B RECEIVES]
  - Receives encrypted_blob
  - Decrypts using own private key → "Hello User B!"
  - Shows message in chat
  - Automatically sends read receipt after 1 second
  ↓
[TYPING INDICATOR CLEARED]
  - Stop emitting typing event
  - "User A is typing..." disappears from User B's screen
  ↓
[READ RECEIPT]
  - User B's client sends "read-receipt" event
  - User A receives "message-read" event
  - Checkmark under message changes to double checkmark
  ↓
END: Message delivered and read
```

### 4.4 Edit Message Flow

```
User long-press or right-click on message
  ↓
[CONTEXT MENU]
  - Edit (only own messages)
  - Delete (only own messages)
  - Copy
  - Report (future)
  ↓
User clicks "Edit"
  ↓
[EDIT MODE]
  - Message becomes editable (text input)
  - "Save" and "Cancel" buttons appear
  ↓
User modifies text and clicks "Save"
  ↓
[FRONTEND]
  - Encrypt new message
  - Emit "edit-message" event
  ↓
[BACKEND]
  - Update message in database
  - Set edited_at timestamp
  - Emit "message-edited" to User B
  ↓
[BOTH USERS]
  - Message updated
  - "Edited" label shows under message
  ↓
END: Message updated
```

### 4.5 Delete Message Flow

```
User long-press/right-click on message
  ↓
[CONTEXT MENU]
  - "Delete message"
  ↓
User clicks "Delete"
  ↓
[CONFIRMATION DIALOG]
  - "Delete this message?"
  - "This cannot be undone."
  - Delete / Cancel buttons
  ↓
User clicks "Delete"
  ↓
[FRONTEND]
  - Remove message from local state
  - Emit "delete-message" event with message ID
  ↓
[BACKEND]
  - Soft delete message (set deleted_at timestamp)
  - Emit "message-deleted" to User B
  ↓
[BOTH USERS]
  - Message disappears from chat
  - Or shows "This message was deleted"
  ↓
END: Message deleted
```

### 4.6 Read Receipts & Typing Indicators

#### Read Receipts

```
Message sent to User B
  ↓
User B's message loads in chat
  ↓
[AUTOMATIC]
  - Wait 1 second
  - Emit "read-receipt" event
  ↓
User A receives "message-read" event
  ↓
[VISUAL UPDATE]
  - Single checkmark (✓) → Double checkmark (✓✓)
  - Indicates message read by recipient
```

#### Typing Indicators

```
User A starts typing in input field
  ↓
[1 SECOND DELAY]
  - Emit "typing" event
  ↓
User B receives "typing" event
  ↓
[DISPLAY]
  - Show "User A is typing..." indicator below messages
  - Animated dots: ●●●
  ↓
[WHILE TYPING]
  - Every keystroke emits "typing" (throttled to every 2 seconds)
  ↓
User A stops typing / sends message
  ↓
[EMIT]
  - Emit "typing-stopped" event (or implicit when message sent)
  ↓
User B
  ↓
[CLEAR INDICATOR]
  - "User A is typing..." disappears
  ↓
END: Typing indicator cleared
```

---

## 5. Group Chat Flow

### 5.1 Create Group Chat

```
User clicks "Create Group" button (in Contacts tab)
  ↓
[GROUP CREATION MODAL]
  - Group name input
  - Group avatar picker
  - Member selection (search & add multiple)
  - "Create" button
  ↓
User fills in details:
  - Name: "Project Team"
  - Avatar: [selects image]
  - Members: [selects 5 people]
  ↓
User clicks "Create"
  ↓
[BACKEND]
  - Create conversation (type: "group")
  - Add creator as member
  - Add selected users as members
  - Generate conversation ID
  ↓
[RETURN TO APP]
  - Navigate to new group conversation
  - Show empty chat screen
  ↓
[SEND SYSTEM MESSAGE]
  - "You created the group 'Project Team'"
  ↓
[SYSTEM NOTIFICATION]
  - All members receive notification: "You've been added to 'Project Team'"
  ↓
END: Group created and visible to all members
```

### 5.2 Group Messaging (Same as Direct Messages)
- Works identically to 1-to-1 messaging
- Messages encrypted and sent to all group members
- All encryption/typing/read receipt logic applies

### 5.3 Add Member to Group

```
In group conversation, click group info icon (top right)
  ↓
[GROUP INFO SCREEN]
  - Group name
  - Group avatar
  - Member list
  - "Add Member" button
  ↓
User clicks "Add Member"
  ↓
[ADD MEMBER OPTIONS]
  Two ways to add:
  - Option A: [📱 Scan QR Code] - Scan member's QR
  - Option B: [🔐 Enter UID] - Type member's UID
  ↓
[SCAN QR OR ENTER UID]
  - Same process as adding single contact
  - After UID lookup: User profile shown
  - "Add to Group" button
  ↓
User clicks "Add to Group"
  ↓
[BACKEND]
  - Add user to conversation_members table
  - Set role = 'member'
  - Send group update event
  ↓
[GROUP CHAT]
  - System message: "User X added User Y"
  - All members see this message
  ↓
[NEW MEMBER]
  - Receives notification: "You were added to Group X"
  - Can now see conversation and messages
  ↓
END: New member added to group
```

### 5.4 Remove Member / Leave Group

```
Group admin right-clicks on member name
  ↓
[CONTEXT MENU]
  - Remove from group (admin only)
  ↓
OR

Member clicks "Leave Group" in group info
  ↓
[CONFIRMATION]
  - "Leave this group?"
  - "You won't be able to see new messages."
  ↓
User confirms
  ↓
[BACKEND]
  - Set left_at timestamp in conversation_members
  - Emit group update
  ↓
[GROUP]
  - Removed member sees group in list but grayed out
  - Or conversation disappears from list
  - System message: "User X left the group"
  ↓
END: User removed from group
```

---

## 6. Call Flow

### 6.1 Initiate Audio Call

```
User A clicks audio call button (in conversation)
  ↓
[CALLING STATE]
  - Call screen overlay appears
  - Shows User B's name and avatar
  - Ringing animation
  - "Cancel" button
  ↓
[BACKEND & WEBSOCKET]
  - Frontend: Emit "call-initiate" with call_type: "audio"
  - Backend: Create call record in database
  - Backend: Emit "call-incoming" to User B
  ↓
[USER B]
  - Receives incoming call notification
  - Notification shows User A's name + avatar
  - "Accept" and "Reject" buttons
  - Ringing sound plays
  ↓
Case 1: User B Accepts
  ↓
[CALL SETUP]
  - Both create RTCPeerConnection
  - Exchange SDP offer/answer
  - Exchange ICE candidates
  - Establish P2P connection
  ↓
[AUDIO STREAM]
  - User A's audio streams to User B
  - User B's audio streams to User A
  - Both can hear each other
  - Call duration timer starts
  ↓
[CALL CONTROLS]
  - Mute/Unmute button
  - Speaker button
  - End Call button
  ↓
User clicks "End Call"
  ↓
[CLEANUP]
  - Close RTCPeerConnection
  - Stop audio streams
  - Emit "call-ended" event
  - Show call duration: "3m 45s"
  - Log call in call history
  ↓
END: Call ended

Case 2: User B Rejects
  ↓
[USER A]
  - Receives "call-rejected" event
  - Call screen disappears
  - System message: "User B declined your call"
  ↓
[USER B]
  - Notification dismissed
  - Back to normal chat
  ↓
END: Call rejected
```

### 6.2 Initiate Video Call

```
User A clicks video call button (in conversation)
  ↓
[SAME AS AUDIO CALL FLOW, EXCEPT:]
  - call_type: "video" (not "audio")
  - Both users must allow camera permission
  - Video feed captured from device camera
  ↓
[ACTIVE VIDEO CALL]
  - Large remote video feed (center)
  - Small local video feed (bottom right corner / PiP)
  - Mute/Unmute audio button
  - Toggle camera on/off button
  - End call button
  - Call duration timer
  ↓
[USER A DISABLES VIDEO DURING CALL]
  - Click camera toggle button
  - Camera turns off
  - User B sees "Camera disabled" placeholder
  - But audio continues
  ↓
[USER A MUTES AUDIO DURING CALL]
  - Click mute button
  - Mic turns off
  - User B cannot hear User A
  - But video continues
  ↓
END: Video call (same cleanup as audio)
```

### 6.3 Incoming Call While App is Open

```
User B has app open in chat
  ↓
[NOTIFICATION]
  - Notification banner at top
  - "Incoming call from User A"
  - Accept / Reject buttons
  ↓
User B clicks "Accept"
  ↓
[CALL SETUP]
  - Call screen overlay appears
  - Proceed with call connection
  ↓
END: Call established
```

### 6.4 Incoming Call While App is Closed

```
User B has app closed / minimized
  ↓
[PUSH NOTIFICATION]
  - OS sends push notification
  - "SecureChat: Call from User A"
  ↓
User B taps push notification
  ↓
[APP OPENS]
  - App navigates to call screen
  - Shows incoming call
  - Accept / Reject buttons
  ↓
[SAME AS ABOVE]
```

### 6.5 Missed Call Flow

```
User A calls User B
  ↓
User B doesn't accept (and doesn't reject)
  ↓
[TIMEOUT]
  - After 30 seconds, call auto-expires
  - Call status set to "missed"
  ↓
[USER B]
  - Receives notification: "Missed call from User A"
  - Can click to see call history
  - Can click to call back
  ↓
[CALL HISTORY]
  - Shows missed call
  - Shows missed call timestamp
  - Shows "Call back" button
  ↓
END: Missed call logged
```

---

## 7. Profile & Settings Flow

### 7.1 View & Edit Profile

```
User clicks "Profile" in sidebar
  ↓
[PROFILE SCREEN]
  - User avatar (large)
  - Display name
  - Email address
  - Bio
  - Status (Online/Away/Offline)
  - "Edit Profile" button
  ↓
User clicks "Edit Profile"
  ↓
[EDIT MODAL]
  - Avatar picker
  - Display name input (editable)
  - Bio input (editable)
  - Status selector dropdown
  - "Save" and "Cancel" buttons
  ↓
User makes changes and clicks "Save"
  ↓
[BACKEND]
  - Update user record
  - Return updated user
  ↓
[FRONTEND]
  - Update Redux/Zustand state
  - Show success message: "Profile updated"
  - Modal closes
  ↓
END: Profile updated
```

### 7.2 Settings Screen

```
User clicks "Settings" in sidebar
  ↓
[SETTINGS SCREEN]
  - Theme Toggle (Dark/Light)
  - Notifications Toggle
  - Sound Toggle
  - Privacy Settings
    - "Only friends can message me" (future)
  - About & Help
  - Terms of Service
  - Privacy Policy
  - Version number
  - Logout button
  ↓
User toggles "Dark Mode"
  ↓
[FRONTEND]
  - Apply dark theme to app
  - Save preference to localStorage
  ↓
[VISUAL CHANGE]
  - Entire app changes to dark colors
  ↓
END: Theme changed
```

---

## 8. Empty States & Error States

### 8.1 Empty State: No Conversations

```
[DASHBOARD - FIRST TIME]
  - No conversations yet
  - Large centered icon (chat bubble)
  - Message: "No conversations yet"
  - Subtext: "Search for a user to start chatting"
  - "Start a Chat" button
  ↓
User clicks "Start a Chat"
  ↓
[NAVIGATES TO CONTACTS TAB]
  - Ready to search for users
```

### 8.2 Empty State: No Messages (New Conversation)

```
[CONVERSATION VIEW]
  - Conversation header shows user name
  - Conversation info icon (top right)
  - Empty message area with centered icon
  - Message: "No messages yet. Say hi!"
  - Message input focused
  ↓
User starts typing
  ↓
[MESSAGE INPUT]
  - User can type and send
```

### 8.3 Error State: Message Send Failed

```
User sends message
  ↓
[ENCRYPTION ERROR / NETWORK ERROR]
  - Message shows in chat with red border
  - Message has ⚠️ icon
  - Tooltip: "Failed to send. Tap to retry"
  ↓
User clicks message
  ↓
[RETRY]
  - Frontend retries sending
  - If successful → border goes away, message is normal
  - If still fails → error persists
  ↓
[MANUAL RETRY]
  - User can try again later
```

### 8.4 Error State: Call Connection Failed

```
User initiates call
  ↓
[CONNECTION FAILED]
  - Call screen shows error message
  - "Could not connect to User B"
  - Reason: "Network error" or "User unavailable"
  - "Try Again" button
  ↓
User clicks "Try Again"
  ↓
[RETRY CALL]
  - Call initiates again
```

### 8.5 Error State: No Encryption Key Found

```
User tries to send message
  ↓
[MISSING PUBLIC KEY]
  - Backend issue: User B's public key not found
  - Message doesn't encrypt
  - Error shown: "Recipient's encryption key not found"
  - "Retry" button
  ↓
[BACKEND FIXES ISSUE]
  - User B's public key is generated/restored
  ↓
User clicks "Retry"
  ↓
[MESSAGE SENDS]
  - Message successfully encrypted and sent
```

---

## 9. Mobile-Specific Flows

### 9.1 Mobile Layout (Responsive)

```
MOBILE (≤768px width)

┌─────────────────────────┐
│  TOP BAR                │
│  [☰] Title [⚙️]        │
├─────────────────────────┤
│                         │
│   MAIN CONTENT          │
│   (full width)          │
│                         │
├─────────────────────────┤
│ [Chats] [Contacts]...   │ ← Bottom tab navigation
└─────────────────────────┘
```

- Sidebar collapses into hamburger menu (top left)
- Tabs appear at bottom for easy thumb access
- Fullscreen message view when conversation open
- Back button to return to conversation list

### 9.2 Mobile Conversation View

```
┌─────────────────────────┐
│ [<] User Name     [i]   │ ← Back + Info icon
├─────────────────────────┤
│                         │
│   MESSAGE LIST          │
│   (scrollable)          │
│                         │
├─────────────────────────┤
│ [📎] [Message input]    │ ← Attachment + input
│        [Send ➤]         │
└─────────────────────────┘
```

- Attachment button for future file sharing
- Large send button for touch
- Messages full width
- Bottom input stays sticky while scrolling

### 9.3 Mobile Call Screen

```
┌─────────────────────────┐
│                         │
│   REMOTE VIDEO          │
│   (full screen)         │
│                         │
├─────────────────────────┤
│  [LOCAL VIDEO - corner] │
│                         │
├─────────────────────────┤
│  [🔇] [🎥] [☎️ End]     │ ← Touch controls
└─────────────────────────┘
```

- Remote video fills screen
- Local camera in corner (PiP)
- Large easy-to-tap buttons
- "End call" button red and prominent

---

## 10. State Transitions Summary

```
LOGIN → AUTHENTICATED → DASHBOARD → [CHATS / CONTACTS / PROFILE / SETTINGS]
                            ↓
                    SELECT CONVERSATION
                            ↓
                    CHAT / CALL / GROUP
                            ↓
                        LOGOUT
                            ↓
                        SPLASH
```

---

## 11. Loading States

### 11.1 Initial App Load

```
User opens app
  ↓
[SPLASH SCREEN with spinner]
  - Checking authentication...
  - (Checking JWT validity)
  ↓
If authenticated:
  → Load user data
  → Load conversations list
  → Connect WebSocket
  → Show dashboard (with spinner while loading)
  ↓
If not authenticated:
  → Show login button
```

### 11.2 Conversation Load

```
User clicks conversation from list
  ↓
[CONVERSATION SCREEN with spinner]
  - Show conversation header
  - Show "Loading messages..." spinner
  ↓
Backend returns messages
  ↓
[MESSAGES DISPLAY]
  - Spinner disappears
  - Messages visible
  - Scroll to latest message
```

### 11.3 Search Loading

```
User searches for user
  ↓
[TYPING in search box]
  ↓
[After 300ms debounce]
  - Spinner appears next to search box
  - "Searching..."
  ↓
Backend returns results
  ↓
[RESULTS DISPLAY]
  - Spinner disappears
  - Show matching users
```

---

## 12. Notifications Flow

### 12.1 In-App Notifications

```
Message sent → "Message delivered"
Read receipt → "User B read your message"
Missed call → "You missed a call from User A"
New message → [Notification banner at top]
Typing → "User A is typing..."
```

### 12.2 Push Notifications (Mobile & Desktop PWA)

```
App closed or minimized
  ↓
Receive message / call
  ↓
Push notification shows
  ↓
User taps notification
  ↓
[APP OPENS]
  - Navigate to relevant conversation/call screen
```

---

## 13. Keyboard Shortcuts (Web)

```
Ctrl/Cmd + K  →  Focus search
Ctrl/Cmd + N  →  New conversation
Escape        →  Close modal / End call
Enter         →  Send message
Shift + Enter →  New line in message (future)
```

---

## 14. Accessibility Features

- Keyboard navigation (Tab, Shift+Tab, Arrow keys)
- ARIA labels on all buttons & inputs
- Screen reader support
- High contrast mode support
- Focus indicators visible
- Color not sole indicator (icons + text)
- Alt text on avatars

---

## 15. Connection State Indicators

```
┌─────────────────────────┐
│ Online       ● Green    │
│ Away         ● Yellow   │
│ Offline      ● Gray     │
│ Connecting   ⟳ Spinner  │
│ Error        ⚠️ Red     │
└─────────────────────────┘

Top of app (near user avatar):
  ● Online (green dot)
  
Conversation header:
  • User: "Online" or "Last seen 2 hours ago"
  
WebSocket status:
  • Reconnecting... (with retry attempts shown)
```
