# Implementation Plan
## Secure Chat App - Step-by-Step Build Sequence

---

## Overview

**Total Estimated Duration:** 8-11 weeks  
**Team Size:** 1-2 full-stack developers (or use AI coding tools)  
**Build Approach:** Phase-based, with deliverables after each phase  
**Testing:** Continuous throughout, not end-of-project

---

## Phase 1: Project Setup & Infrastructure (Week 1)
**Duration:** 4-5 days  
**Deliverables:** Working dev environment, deployed infrastructure

### 1.1 Backend Setup

**Objective:** Set up Node.js backend with TypeScript, database, authentication

**Tasks:**

```
1. Create GitHub repository
   - Initialize with .gitignore, README
   - Create main and develop branches
   - Set up branch protection rules

2. Set up Node.js project structure
   - npm init -y
   - Install dependencies:
     * express (web framework)
     * typescript (type safety)
     * dotenv (environment vars)
     * pg (PostgreSQL driver)
     * socket.io (real-time)
     * jsonwebtoken (JWT auth)
     * bcrypt (password hashing)
     * cors (CORS support)
     * helmet (security headers)
     * morgan (logging)
     * winston (structured logging)
   - Create tsconfig.json with strict mode
   - Set up build pipeline (tsc, nodemon)

3. Create project folder structure
   backend/
   ├── src/
   │   ├── controllers/
   │   ├── services/
   │   ├── models/
   │   ├── routes/
   │   ├── middleware/
   │   ├── crypto/
   │   ├── websocket/
   │   ├── types/
   │   ├── config/
   │   ├── utils/
   │   └── server.ts
   ├── tests/
   ├── .env.example
   ├── .env (local development)
   ├── tsconfig.json
   ├── package.json
   └── README.md

4. Set up PostgreSQL database
   - Create database: createdb securechat
   - Install pgAdmin for management (optional)
   - Create connection pool configuration
   - Test connection from Node.js

5. Create environment variables (.env)
   ENVIRONMENT=development
   PORT=5000
   NODE_ENV=development
   
   DATABASE_URL=postgresql://user:password@localhost:5432/securechat
   
   GOOGLE_CLIENT_ID=xxx
   GOOGLE_CLIENT_SECRET=xxx
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
   
   JWT_SECRET=your_super_secret_key_here
   JWT_EXPIRY=15m
   REFRESH_TOKEN_EXPIRY=7d
   
   FRONTEND_URL=http://localhost:3000
   
   LOG_LEVEL=debug

6. Set up logging system
   - Configure Winston for structured logs
   - Log to console in development
   - Set up log rotation for production
   - Create loggers for different modules
```

**Deliverable:** Backend repository with working dev environment

### 1.2 Frontend Setup

**Objective:** Set up React frontend with TypeScript and build tools

**Tasks:**

```
1. Create frontend with Vite
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install

2. Install essential dependencies
   - react-router-dom (routing)
   - zustand or redux-toolkit (state management)
   - axios (HTTP client)
   - tailwindcss (styling)
   - @tailwindcss/forms (form components)
   - tweetnacl or libsodium.js (encryption)
   - socket.io-client (real-time)
   - react-hook-form (form handling)
   - zod (validation)
   - vitest (testing)
   - @testing-library/react (testing utils)

3. Set up Tailwind CSS
   - npx tailwindcss init -p
   - Configure tailwind.config.js with custom colors
   - Create global.css with Tailwind directives

4. Create project folder structure
   frontend/
   ├── src/
   │   ├── components/
   │   │   ├── Auth/
   │   │   ├── Chat/
   │   │   ├── Contacts/
   │   │   ├── Call/
   │   │   ├── Profile/
   │   │   └── common/
   │   ├── pages/
   │   │   ├── LoginPage.tsx
   │   │   ├── DashboardPage.tsx
   │   │   ├── ProfilePage.tsx
   │   │   └── SettingsPage.tsx
   │   ├── services/
   │   │   ├── api.ts
   │   │   ├── auth.ts
   │   │   └── encryption.ts
   │   ├── crypto/
   │   │   └── encryption.ts
   │   ├── store/
   │   │   ├── authStore.ts
   │   │   └── chatStore.ts
   │   ├── hooks/
   │   ├── utils/
   │   ├── types/
   │   ├── styles/
   │   ├── App.tsx
   │   └── main.tsx
   ├── public/
   ├── vite.config.ts
   ├── tsconfig.json
   ├── tailwind.config.js
   ├── package.json
   └── README.md

5. Set up environment variables (.env)
   VITE_API_URL=http://localhost:5000
   VITE_SOCKET_URL=http://localhost:5000

6. Create .env.example for documentation
```

**Deliverable:** Frontend repository with dev setup

### 1.3 Database Schema Creation

**Objective:** Create PostgreSQL database structure

**Tasks:**

```
1. Create database migration files
   Create migrations/ folder
   
   Migrations to create (in order):
   - 001_create_users_table.sql
   - 002_create_encryption_keys_table.sql
   - 003_create_conversations_table.sql
   - 004_create_conversation_members_table.sql
   - 005_create_messages_table.sql
   - 006_create_message_reads_table.sql
   - 007_create_calls_table.sql
   - 008_create_sessions_table.sql

2. Run migrations
   psql securechat < migrations/001_create_users_table.sql
   psql securechat < migrations/002_create_encryption_keys_table.sql
   ... (run all migrations in order)

3. Verify schema
   List tables: \dt
   Describe table: \d users
   List indexes: \di

4. Create seed data (optional, for testing)
   - Create test users
   - Create test conversations
   - Create test messages
```

**Deliverable:** PostgreSQL database with all tables and indexes

### 1.4 Docker Setup (Optional but Recommended)

**Objective:** Containerize backend and database for easy development

**Tasks:**

```
1. Create Dockerfile for backend
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   EXPOSE 5000
   CMD ["npm", "start"]

2. Create docker-compose.yml
   version: '3.8'
   services:
     db:
       image: postgres:15
       environment:
         POSTGRES_USER: securechat
         POSTGRES_PASSWORD: securepassword
         POSTGRES_DB: securechat
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
         - ./migrations:/docker-entrypoint-initdb.d
     
     backend:
       build: ./backend
       ports:
         - "5000:5000"
       depends_on:
         - db
       environment:
         DATABASE_URL: postgresql://...
       volumes:
         - ./backend:/app

   volumes:
     postgres_data:

3. Start containers
   docker-compose up

4. Access services
   Backend: http://localhost:5000
   Database: localhost:5432
   PgAdmin: http://localhost:5050 (if added)
```

**Deliverable:** Docker setup for local development

### 1.5 CI/CD Setup (GitHub Actions)

**Objective:** Automated testing and deployment

**Tasks:**

```
1. Create .github/workflows/test.yml
   - Run on every push to main/develop
   - Run tests
   - Check TypeScript compilation
   - Lint code (ESLint)
   - Run database migrations (test)

2. Create .github/workflows/deploy.yml
   - On push to main branch
   - Build Docker image
   - Push to Docker registry (or deploy to cloud)
   - Run migrations on production database
   - Health check

3. Create .github/workflows/lint.yml
   - On every pull request
   - Run prettier (code formatting)
   - Run eslint (code quality)
   - Report results in PR
```

**Deliverable:** Automated CI/CD pipeline

---

## Phase 2: Authentication (Week 1-2)
**Duration:** 5-6 days  
**Deliverables:** Google OAuth login, JWT tokens, session management

### 2.1 Backend Authentication

**Objective:** Implement Google OAuth and JWT token generation

**Tasks:**

```
1. Install OAuth dependencies
   npm install google-auth-library passport passport-google-oauth20

2. Create Google OAuth service (src/services/googleAuth.ts)
   - Function: verifyGoogleToken(token)
     * Verify token with Google
     * Extract user info (email, name, picture)
     * Return verified user data
   
   - Function: getOrCreateUser(googleData)
     * Check if user exists in database
     * If exists: return user
     * If not: 
       - Create new user with profile
       - **Generate unique UID** (see step 2a below)
       - Return user with UID

2a. Create UID & QR code service (src/services/uidService.ts)
   - Function: generateUID()
     * Create unique ID: "SEC_" + random 16 chars (hex)
     * Example: "SEC_8f7d6e5c4b3a2910"
     * Verify UID not already in database
     * Return UID
   
   - Function: generateQRCode(uid)
     * Input: User's UID (e.g., "SEC_8f7d6e5c...")
     * Generate QR code image (PNG)
     * Data in QR: "securechat://uid/SEC_..." (deep link format)
     * Return: QR code image buffer or data URL
     * Libraries: qrcode (npm install qrcode)
   
   - Function: getQRCodeAsImage(uid)
     * Generate QR and return as PNG image
     * Used for download endpoint
   
   - Function: getQRCodeAsDataURL(uid)
     * Generate QR and return as data URL
     * Used for displaying in UI

3. Create JWT service (src/services/jwt.ts)
   - Function: generateAccessToken(userId)
     * Create JWT valid for 15 minutes
     * Include userId in payload
   
   - Function: generateRefreshToken(userId)
     * Create JWT valid for 7 days
     * Store token in sessions table
   
   - Function: verifyAccessToken(token)
     * Verify token signature
     * Check expiry
     * Extract userId
   
   - Function: verifyRefreshToken(token)
     * Verify token signature
     * Check in database (not revoked)
     * Extract userId

4. Create auth controller (src/controllers/authController.ts)
   - POST /api/auth/google
     * Receive Google ID token
     * Verify token
     * Get or create user
     * Generate JWT tokens
     * Set refresh token in HTTP-only cookie
     * Return access token + user data
   
   - POST /api/auth/refresh
     * Extract refresh token from cookie
     * Verify token
     * Generate new access token
     * Optionally rotate refresh token
     * Return new access token
   
   - POST /api/auth/logout
     * Extract refresh token
     * Mark session as expired
     * Clear cookie
     * Return success

5. Create auth routes (src/routes/auth.ts)
   POST /api/auth/google
   POST /api/auth/refresh
   POST /api/auth/logout

6. Create authentication middleware (src/middleware/auth.ts)
   - Function: verifyAccessToken(req, res, next)
     * Extract token from Authorization header
     * Verify token
     * Attach userId to req.user
     * Call next()
     * If invalid: return 401 Unauthorized

7. Set up CORS properly
   cors({
     origin: process.env.FRONTEND_URL,
     credentials: true,  // Allow cookies
     methods: ['GET', 'POST', 'PUT', 'DELETE'],
     allowedHeaders: ['Content-Type', 'Authorization']
   })

8. Set secure cookie options
   res.cookie('refreshToken', token, {
     httpOnly: true,      // Not accessible via JS
     secure: true,        // Only HTTPS in production
     sameSite: 'strict',  // CSRF protection
     maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
   })
```

**Testing:**
```
1. Test Google OAuth flow
   POST /api/auth/google
   {
     "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAifQ..."
   }
   
   Expected response:
   {
     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "550e8400-e29b-41d4-a716-446655440000",
       "email": "john@example.com",
       "displayName": "John Doe",
       "avatarUrl": "https://..."
     }
   }

2. Test token refresh
   POST /api/auth/refresh
   Cookie: refreshToken=...
   
   Expected: New accessToken in response

3. Test logout
   POST /api/auth/logout
   Cookie: refreshToken=...
   
   Expected: Cookie cleared, session marked expired
```

**Deliverable:** Google OAuth + JWT authentication system

### 2.2 Frontend Authentication

**Objective:** Implement Google OAuth login UI and token management

**Tasks:**

```
1. Create Google Sign-In component (src/components/Auth/GoogleSignInButton.tsx)
   - Render "Login with Google" button
   - Use @react-oauth/google library
   - Handle successful login:
     * Send idToken to backend
     * Receive accessToken
     * Store accessToken in memory (Zustand)
     * Store refreshToken in httpOnly cookie (backend does this)
     * Redirect to dashboard
   
   - Handle login error:
     * Show error message

2. Create Splash/Login page (src/pages/LoginPage.tsx)
   - Display app logo
   - Display app tagline
   - Display Google Sign-In button
   - Show loading spinner while authenticating
   - Show error messages

3. Create auth store (src/store/authStore.ts)
   Using Zustand:
   - State:
     * user: User | null
     * accessToken: string | null
     * isAuthenticated: boolean
     * isLoading: boolean
     * error: string | null
   
   - Actions:
     * setUser(user)
     * setAccessToken(token)
     * logout()
     * loadUserFromToken()  // On app load

4. Create API client (src/services/api.ts)
   - axios instance with:
     * Base URL: process.env.VITE_API_URL
     * Default headers: { Authorization: `Bearer ${accessToken}` }
     * Interceptor: If 401, call /api/auth/refresh
   
   - Functions:
     * loginWithGoogle(idToken)
     * refreshAccessToken()
     * logout()

5. Create ProtectedRoute component (src/components/ProtectedRoute.tsx)
   - Check if user is authenticated
   - If not: redirect to login
   - If yes: render component

6. Create App routing (src/App.tsx)
   - Route /login → LoginPage
   - Route / → ProtectedRoute(Dashboard)
   - Route /profile → ProtectedRoute(ProfilePage)
   - Route /settings → ProtectedRoute(SettingsPage)

7. Add app initialization (src/hooks/useAppInit.ts)
   - On app load:
     * Check if accessToken exists in memory
     * If not: check if refreshToken exists (cookie)
     * If refreshToken exists: call refresh endpoint
     * Load user data
     * Update auth store

8. Create logout functionality
   - Clear accessToken from memory
   - Clear all local state
   - Disconnect WebSocket
   - Call /api/auth/logout
   - Redirect to login page
```

**Testing:**
```
1. Test login flow
   - Open app
   - Click "Login with Google"
   - Complete OAuth flow
   - Verify user is logged in
   - Verify dashboard loads

2. Test token refresh
   - Login
   - Wait for access token to expire (or manually clear)
   - Make API request
   - Verify automatic token refresh works

3. Test logout
   - Login
   - Click logout
   - Verify redirected to login page
   - Verify accessToken cleared

4. Test page refresh
   - Login
   - Close browser tab
   - Reopen app
   - Verify still logged in (using refresh token)

5. Test protected routes
   - Try accessing /dashboard without logging in
   - Verify redirected to /login
```

**Deliverable:** Complete authentication flow (frontend + backend)

### 2.3 UID & QR Code Display

**Objective:** Display user's UID and QR code for sharing

**Backend Tasks:**

```
1. Install QR code library
   npm install qrcode

2. Create QR code endpoints (src/controllers/qrController.ts)
   - GET /api/users/me/qr
     * Auth required
     * Return QR code as PNG image
     * Content-Type: image/png
     * Can pass ?format=png|svg|data-url query param
   
   - GET /api/users/me/uid
     * Auth required
     * Return just the UID: { uid: "SEC_..." }

3. Add routes (src/routes/qr.ts)
   GET /api/users/me/qr
   GET /api/users/me/uid

4. Backend returns in auth response
   - When user logs in, include UID in user object:
     {
       "user": {
         "id": "...",
         "uid": "SEC_8f7d6e5c...",
         "email": "...",
         "displayName": "...",
         ...
       }
     }
```

**Frontend Tasks:**

```
1. Create UID/QR Share Modal (src/components/Profile/UIDShareModal.tsx)
   - Display in centered modal
   - Layout:
     * Title: "Your Secure ID"
     * Large QR code (300x300px)
     * UID below QR: "SEC_8f7d6e5c4b3a2910"
     * Three buttons:
       - [📋 Copy UID] - Copy to clipboard
       - [⬇️ Download QR] - Download PNG
       - [❌ Close]
   
   - Implementation:
     * Use 'qrcode.react' library
     * QR contains: "securechat://uid/SEC_..."
     * Copy button uses navigator.clipboard
     * Download uses canvas.toBlob()

2. Add UID display to profile page (src/pages/ProfilePage.tsx)
   - In profile view, show:
     * User's UID (copyable text field)
     * "Show QR Code" button → opens modal
     * QR code icon (🔗) next to UID
   
   - Copy UID button:
     * onclick: navigator.clipboard.writeText(uid)
     * Show toast: "UID copied to clipboard!"

3. Add to auth store (src/store/authStore.ts)
   - Add state: uid: string | null
   - Add action: setUID(uid)

4. Update auth response handler
   - Extract UID from login response
   - Store in auth store
   - Display on profile page
```

**Testing:**
```
1. Test UID generation
   - User signs up
   - Verify UID assigned
   - Verify UID unique
   - Verify UID format: SEC_xxxxx

2. Test QR code generation
   - Request /api/users/me/qr
   - Verify PNG image returned
   - Verify QR decodable
   - Verify contains "securechat://uid/..."

3. Test UID display in UI
   - Open profile
   - See UID displayed
   - Click copy → UID in clipboard
   - Click "Show QR" → Modal opens
   - Download QR → File downloaded

4. Test QR scanning (in next phase)
   - Scan user's QR
   - Extract UID
   - Look up user by UID
```

**Deliverable:** UID/QR code sharing functionality

### 2.4 Add Contact by UID/QR Scanning

**Objective:** Allow users to add contacts by scanning QR codes or entering UIDs

**Backend Tasks:**

```
1. Create user lookup service (src/services/userService.ts)
   - Function: getUserByUID(uid)
     * Query users table WHERE uid = ?
     * Return user profile (public data only)
     * Exclude deleted users
     * If not found: throw NotFoundError

2. Create contact controller (src/controllers/contactController.ts)
   - GET /api/users/by-uid/:uid
     * Auth required (any logged-in user)
     * Lookup user by UID
     * Return: { id, uid, displayName, avatarUrl, status }
     * If not found: return 404 error

3. Add route (src/routes/contacts.ts)
   GET /api/users/by-uid/:uid

4. Conversation creation with UID
   - Update POST /api/conversations endpoint
   - Accept: { type: 'direct', recipientUid: 'SEC_...' }
   - Backend lookups recipient by UID
   - Verify recipient exists
   - Create conversation between both users
```

**Frontend Tasks:**

```
1. Create add contact component (src/components/Contacts/AddContactScreen.tsx)
   - Two buttons at top:
     * [📱 Scan QR] - Opens camera
     * [🔐 Enter UID] - Shows input field
   
   - Layout:
     * Tab 1: QR Scanner
       - Use html5-qrcode library
       - Request camera permission
       - Show camera feed
       - Automatically detect QR codes
       - Extract data from QR
       - Parse UID from "securechat://uid/SEC_..."
     
     * Tab 2: Manual UID Entry
       - Text input: "SEC_xxxxxxxxxx"
       - Placeholder: "Enter 16-character UID"
       - Validation: Must start with SEC_
       - Submit button

2. Install QR scanning library
   npm install html5-qrcode

3. Create UID lookup service (src/services/contactService.ts)
   - Function: getUserByUID(uid)
     * GET /api/users/by-uid/:uid
     * Return user profile
     * Handle 404 error
   
   - Function: addContact(uid)
     * Lookup user by UID
     * Create conversation
     * POST /api/conversations
     * Return conversation ID

4. Create user preview modal (src/components/Contacts/UserPreviewModal.tsx)
   - After UID/QR scanned or entered:
     * Show user's profile
     * Avatar (large)
     * Display name
     * Status (online/offline)
     * [Add Contact] button (green)
     * [Cancel] button

5. Update contacts store (src/store/contactStore.ts)
   - Add action: addContactByUID(uid)
   - Show loading while fetching
   - Handle errors (UID not found)
   - Show success/error toast

6. Update conversation creation
   - POST /api/conversations with UID
   - Verify backend creates with recipientUid
   - Redirect to new conversation
```

**Testing:**
```
1. Test UID lookup
   - Call GET /api/users/by-uid/SEC_...
   - Verify returns user profile
   - Verify not found returns 404

2. Test QR scanning
   - Display user's QR code
   - Open scanner in another window
   - Scan QR code
   - Verify QR data extracted
   - Verify UID parsed correctly

3. Test manual UID entry
   - Open add contact
   - Click "Enter UID"
   - Type UID (e.g., SEC_8f7d6e5c4b3a2910)
   - Click "Add"
   - Verify user found and displayed

4. Test add contact flow
   - Scan or enter UID
   - User preview shown
   - Click "Add Contact"
   - Verify conversation created
   - Verify can send message

5. Test error cases
   - Invalid UID format
   - UID doesn't exist
   - Own UID (can't add self)
   - Already a contact
```

**Deliverable:** UID/QR contact discovery system

## Phase 3: User Profiles & Encryption Keys (Week 2)
**Duration:** 4-5 days  
**Deliverables:** User profiles, encryption key generation, key retrieval

### 3.1 User Profile Management

**Objective:** Allow users to view and edit profiles

**Backend Tasks:**

```
1. Create user service (src/services/userService.ts)
   - Function: getUserProfile(userId)
     * Query users table
     * Return user data (excluding sensitive fields)
   
   - Function: updateUserProfile(userId, updates)
     * Validate input (display_name, bio, status, avatar_url)
     * Update users table
     * Return updated user

2. Create user controller (src/controllers/userController.ts)
   - GET /api/users/me
     * Auth required
     * Return current user profile
   
   - PUT /api/users/me
     * Auth required
     * Validate request body
     * Call updateUserProfile
     * Return updated user
   
   - GET /api/users/:id
     * Auth required
     * Return public profile of other user

3. Create user routes (src/routes/users.ts)
   GET /api/users/me
   PUT /api/users/me
   GET /api/users/:id

4. Input validation (src/utils/validation.ts)
   - displayNameSchema: min 1, max 255
   - bioSchema: optional, max 500
   - statusSchema: enum('online', 'away', 'offline')
```

**Frontend Tasks:**

```
1. Create user profile page (src/pages/ProfilePage.tsx)
   - Display:
     * Avatar (large)
     * Display name
     * Email (read-only)
     * Bio
     * Status selector
   - Edit mode:
     * Avatar picker
     * Display name input
     * Bio textarea
     * Status dropdown
   - Buttons:
     * Edit Profile
     * Save
     * Cancel

2. Create edit profile modal (src/components/Profile/EditProfileModal.tsx)
   - Form with:
     * Avatar upload (or URL input)
     * Display name input (required)
     * Bio textarea (optional)
     * Status dropdown
   - Submit:
     * Validate input
     * Call API
     * Show success/error message
     * Update auth store

3. Create user search component (src/components/Contacts/UserSearch.tsx)
   - Input field with debounced search
   - Display search results as list
   - Show "Start Chat" button for each user
   - Handle click → navigate to conversation

4. Create user card component (src/components/common/UserCard.tsx)
   - Show:
     * Avatar
     * Display name
     * Online status (green dot)
     * Last seen timestamp
   - Reusable across app

5. Create profile store updates (src/store/authStore.ts)
   - Add actions:
     * updateProfile(updates)
     * setStatus(status)
```

**Testing:**
```
1. Test GET /api/users/me
   - Login
   - Request current user profile
   - Verify returns correct data

2. Test PUT /api/users/me
   - Update display name
   - Verify updated in database
   - Verify UI reflects changes

3. Test user search
   - Search for user by name
   - Verify returns matching users
   - Verify search is case-insensitive

4. Test profile page
   - View profile
   - Edit profile
   - Save changes
   - Refresh page
   - Verify changes persisted
```

**Deliverable:** Complete user profile management

### 3.2 Encryption Key Generation & Management

**Objective:** Generate X25519 keys, store public key, manage private key

**Backend Tasks:**

```
1. Create encryption service (src/services/encryptionService.ts)
   Note: Private key generation happens on CLIENT only
   
   - Function: storePublicKey(userId, publicKeyBase64)
     * Validate base64 format
     * Check key not already in database
     * Calculate SHA256 fingerprint
     * Insert into user_encryption_keys table
     * Return key record

2. Create encryption controller (src/controllers/encryptionController.ts)
   - POST /api/users/me/encryption-key
     * Auth required
     * Body: { publicKey: "base64_string" }
     * Call storePublicKey
     * Return success
   
   - GET /api/users/:userId/public-key
     * Auth required (any authenticated user)
     * Return public key of specified user
     * Include key_id for future reference
   
   - GET /api/users/me/encryption-key
     * Auth required
     * Return current user's stored public key info

3. Create encryption routes (src/routes/encryption.ts)
   POST /api/users/me/encryption-key
   GET /api/users/:userId/public-key
   GET /api/users/me/encryption-key
```

**Frontend Tasks:**

```
1. Create encryption initialization (src/crypto/keyManagement.ts)
   Using TweetNaCl.js:
   
   - Function: generateKeyPair()
     * const keyPair = nacl.box.keyPair()
     * Returns { publicKey: Uint8Array, privateKey: Uint8Array }
   
   - Function: uploadPublicKey(publicKey)
     * Convert Uint8Array to base64
     * POST to /api/users/me/encryption-key
     * Store public key on backend
   
   - Function: storePrivateKeyLocally(privateKey)
     * Convert Uint8Array to base64
     * Store in localStorage (or IndexedDB)
     * KEY: "privateKey_userId"
     * NOTE: Never send to server!
   
   - Function: getStoredPrivateKey(userId)
     * Retrieve from localStorage
     * Convert base64 to Uint8Array
     * Return for encryption/decryption
   
   - Function: retrievePublicKey(userId)
     * Check cache first
     * If not cached: GET /api/users/:userId/public-key
     * Cache result
     * Return Uint8Array

2. Create encryption hook (src/hooks/useEncryption.ts)
   - useEffect on app init:
     * Check if privateKey stored locally
     * If not: generate new key pair
     * Upload public key to backend
     * Store private key locally
   
   - Export functions:
     * encryptMessage(plaintext, recipientPublicKey)
     * decryptMessage(encryptedMessage, nonce)

3. Create key generation UI (during onboarding)
   - After profile setup:
     * Show "Setting up encryption..."
     * Call useEncryption hook
     * Generate keys
     * Show success message
     * Continue to dashboard

4. Add encryption setup to auth store
   - Track: hasEncryptionKey: boolean
   - Track: privateKey: string | null
   - Action: initializeEncryption()
```

**Testing:**
```
1. Test key generation
   - Call generateKeyPair()
   - Verify returns { publicKey, privateKey }
   - Verify keys are valid X25519 keys

2. Test public key upload
   - Generate key pair
   - Upload public key
   - Verify stored in database
   - Verify fingerprint calculated

3. Test public key retrieval
   - Upload public key
   - Retrieve it via API
   - Verify matches uploaded key

4. Test private key storage
   - Generate key pair
   - Store private key locally
   - Refresh page
   - Verify private key still available

5. Test encryption/decryption
   - Generate two key pairs (User A & B)
   - User A encrypts message with User B's public key
   - User B decrypts with own private key
   - Verify plaintext matches
```

**Deliverable:** E2E encryption key generation and management

---

## Phase 4: Messaging System (Week 3-4)
**Duration:** 6-8 days  
**Deliverables:** Message sending/receiving, encryption, UI

### 4.1 Message Model & Storage

**Backend Tasks:**

```
1. Create conversation service (src/services/conversationService.ts)
   - Function: createDirectConversation(userId1, userId2)
     * Check if conversation exists
     * If yes: return existing
     * If no: create new conversation (type='direct')
     * Add both users as members
     * Return conversation
   
   - Function: getOrCreateDirectConversation(userId, otherUserId)
     * Wrapper around createDirectConversation
     * Used for finding existing conversations
   
   - Function: getUserConversations(userId, limit=20)
     * Get all conversations user is member of
     * Join with messages table to get last message
     * Join with users table to get member names
     * Order by updated_at DESC
     * Return with last message preview
   
   - Function: getConversationById(conversationId, userId)
     * Verify userId is member of conversation
     * Return conversation details
     * Include member list
     * Include last 20 messages

2. Create message service (src/services/messageService.ts)
   - Function: createMessage(conversationId, senderId, encryptedContent, nonce)
     * Validate inputs
     * Verify sender is member of conversation
     * Get next sequence number
     * Insert into messages table
     * Emit WebSocket event to conversation members
     * Return message record
   
   - Function: getConversationMessages(conversationId, limit=20, before=null)
     * Pagination: load 20 messages before timestamp
     * For each message: include sender info
     * Order by created_at DESC
     * Return messages
   
   - Function: deleteMessage(messageId, userId)
     * Verify userId is sender of message
     * Set content_type = 'deleted'
     * Set deleted_at = CURRENT_TIMESTAMP
     * Emit WebSocket event
   
   - Function: editMessage(messageId, userId, newEncryptedContent)
     * Verify userId is sender
     * Update encrypted_content
     * Set edited_at = CURRENT_TIMESTAMP
     * Emit WebSocket event

3. Create conversation controller (src/controllers/conversationController.ts)
   - GET /api/conversations
     * Auth required
     * Return user's conversations list
   
   - POST /api/conversations
     * Auth required
     * Body: { type: 'direct', participantId: uuid }
     * Call getOrCreateDirectConversation
     * Return conversation
   
   - GET /api/conversations/:id
     * Auth required
     * Return conversation details + last 20 messages
   
   - GET /api/conversations/:id/messages?before=timestamp&limit=20
     * Auth required
     * Load more messages (pagination)

4. Create message controller (src/controllers/messageController.ts)
   - This is handled via WebSocket (see phase 4.2)
   - But create HTTP endpoints for testing:
   - POST /api/messages (for testing)
   - DELETE /api/messages/:id
   - PUT /api/messages/:id

5. Database optimization
   - Create indexes for fast queries
   - Test query performance with EXPLAIN ANALYZE
```

**Frontend Tasks:**

```
1. Create conversation store (src/store/conversationStore.ts)
   Using Zustand:
   - State:
     * conversations: Conversation[]
     * currentConversation: Conversation | null
     * messages: Message[]
     * isLoading: boolean
     * hasMore: boolean
   
   - Actions:
     * setConversations(conversations)
     * setCurrentConversation(conversation)
     * addMessage(message)
     * removeMessage(messageId)
     * setMessages(messages)
     * addMessages(messages)  // For pagination
     * clearMessages()

2. Create conversation service (src/services/conversationService.ts)
   - Function: getConversations()
     * GET /api/conversations
     * Return list of conversations
   
   - Function: getOrCreateDirectConversation(participantId)
     * POST /api/conversations
     * Body: { type: 'direct', participantId }
     * Return conversation
   
   - Function: getConversationMessages(conversationId, before=null)
     * GET /api/conversations/:id/messages?before=...&limit=20
     * Return messages
   
   - Function: loadMoreMessages(conversationId, oldestMessageTimestamp)
     * Fetch messages before timestamp
     * Append to messages list

3. Create conversation list component (src/components/Chat/ConversationList.tsx)
   - Display list of conversations
   - Show:
     * Avatar of other user (or group)
     * Name
     * Last message preview
     * Timestamp of last message
     * Unread badge (if applicable)
   - Click to open conversation
   - Search conversations
   - Skeleton loaders while loading

4. Create conversation view component (src/components/Chat/ConversationView.tsx)
   - Display:
     * Conversation header (name, online status, encryption badge)
     * Messages list
     * Message input
   - Features:
     * Load messages on mount
     * Scroll to latest message
     * Infinite scroll (load more on scroll up)
     * Loading indicators

5. Create message bubble component (src/components/Chat/MessageBubble.tsx)
   - Display message in bubble style
   - Show:
     * Avatar (if group)
     * Message content
     * Timestamp
     * Sender name (if group)
     * Read receipt (checkmark icon)
     * Edit timestamp if edited
   - Actions (on long press/right click):
     * Edit (if own message)
     * Delete (if own message)
     * Copy
     * React (future)

6. Create message list component (src/components/Chat/MessageList.tsx)
   - Render list of messages
   - Handle pagination (infinite scroll up)
   - Auto-scroll to latest message
   - Show loading spinner at top (loading more)
   - Skeleton loaders for messages
   - Separation by date ("Today", "Yesterday", etc)

7. Create message input component (src/components/Chat/MessageInput.tsx)
   - Textarea input
   - Grows as user types (auto-expand)
   - Send button
   - Emoji picker (future)
   - Attachment button (future)
   - Disable when not authenticated
   - Show errors if send fails
```

**Testing:**
```
1. Test create conversation
   - User A searches for User B
   - Click "Start Chat"
   - Verify conversation created
   - Verify both are members

2. Test send message
   - User A types message
   - Click send
   - Verify message encrypted
   - Verify message stored in database (encrypted)
   - Verify message appears in User A's chat
   - Verify message appears in User B's chat (decrypted)

3. Test load messages
   - Open conversation
   - Load last 20 messages
   - Scroll up
   - Load more messages
   - Verify pagination works

4. Test edit message
   - Send message
   - Edit message
   - Verify edited_at updated
   - Verify "Edited" label shows

5. Test delete message
   - Send message
   - Delete message
   - Verify message disappears (or shows "deleted")
   - Verify deleted_at set

6. Test encryption
   - Send message
   - Verify stored as encrypted blob
   - Attempt to read directly from DB
   - Verify unreadable (encrypted)
```

**Deliverable:** Complete messaging system (backend + frontend)

### 4.2 Real-Time Messaging (WebSocket)

**Backend Tasks:**

```
1. Set up Socket.io server (src/websocket/socketServer.ts)
   - Initialize socket.io with Express
   - Configure CORS
   - Set up socket middleware for auth:
     * Verify JWT token
     * Attach userId to socket
     * Reject if not authenticated

2. Create message socket handlers (src/websocket/handlers/messageHandlers.ts)
   - Event: 'join-conversation'
     * Verify user is member of conversation
     * socket.join(`conversation:${conversationId}`)
     * Emit to room: 'user-joined' (notification)
   
   - Event: 'send-message'
     * Body: { conversationId, encryptedContent, nonce, contentType }
     * Encrypt validation (check key exists)
     * Save to database
     * Emit to room: 'receive-message' with full message
     * Emit to sender: 'message-delivered' (confirmation)
   
   - Event: 'typing'
     * Body: { conversationId }
     * Emit to room: 'user-typing' (exclude sender)
   
   - Event: 'typing-stopped'
     * Body: { conversationId }
     * Emit to room: 'user-stopped-typing'
   
   - Event: 'read-receipt'
     * Body: { messageId, conversationId }
     * Record in message_reads table
     * Emit to room: 'message-read' { messageId, readByCount }
   
   - Event: 'edit-message'
     * Body: { messageId, newEncryptedContent, conversationId }
     * Verify user is sender
     * Update database
     * Emit to room: 'message-edited'
   
   - Event: 'delete-message'
     * Body: { messageId, conversationId }
     * Verify user is sender
     * Soft delete in database
     * Emit to room: 'message-deleted'

3. Create call socket handlers (src/websocket/handlers/callHandlers.ts)
   - See Phase 5 for details

4. Create status socket handlers (src/websocket/handlers/statusHandlers.ts)
   - Event: 'user-status-changed'
     * Body: { status: 'online'|'away'|'offline' }
     * Update users table
     * Emit to all sockets: 'user-status-changed'

5. Set up socket authentication middleware
   - Verify JWT token on connection
   - Extract userId from token
   - Attach to socket object
   - Disconnect if not authenticated

6. Handle disconnections
   - On disconnect:
     * Remove user from rooms
     * Emit 'user-offline' to subscribed rooms
     * Clean up socket resources
```

**Frontend Tasks:**

```
1. Create socket service (src/services/socketService.ts)
   - Initialize Socket.io client
   - Connect on app load
   - Add token to connection
   - Expose socket instance for use in components

2. Create message socket hooks (src/hooks/useMessageSocket.ts)
   - useEffect to join conversation:
     * Emit 'join-conversation' with conversationId
     * Listen for 'receive-message'
     * Add to messages store
     * Listen for 'message-read'
     * Update message read status
     * Cleanup: leave room on unmount
   
   - Function: sendMessage(content)
     * Encrypt content
     * Emit 'send-message'
     * Add to messages optimistically
     * Listen for 'message-delivered' confirmation
   
   - Function: editMessage(messageId, newContent)
     * Encrypt new content
     * Emit 'edit-message'
   
   - Function: deleteMessage(messageId)
     * Emit 'delete-message'

3. Create typing indicator hook (src/hooks/useTypingIndicator.ts)
   - Track which users are typing
   - debounce typing events (emit every 2 seconds)
   - Track typing timeout (clear after 3 seconds of inactivity)
   - Emit 'typing' and 'typing-stopped' events

4. Create read receipt hook (src/hooks/useReadReceipts.ts)
   - Automatically send read receipt 1 second after message appears
   - Emit 'read-receipt' with messageId
   - Listen for 'message-read' from others
   - Update message in UI

5. Update message input component
   - On user types:
     * Call useTypingIndicator.startTyping()
     * Show "User X is typing..." in other user's chat
   
   - On send:
     * Call useMessageSocket.sendMessage()
     * Add message optimistically
     * Wait for delivery confirmation
     * Show sent status

6. Update message list component
   - Listen for incoming messages via socket
   - Auto-add to message list
   - Auto-scroll to latest
   - Handle message edits (update in place)
   - Handle message deletes (remove or show "deleted")

7. Create real-time status indicator
   - Track user online/offline status via socket
   - Show green dot if online
   - Show timestamp if offline
   - Update in real-time
```

**Testing:**
```
1. Test WebSocket connection
   - Open app
   - Open DevTools → Network → WS
   - Verify socket connection established
   - Check token in query params

2. Test join conversation
   - Open conversation
   - Emit 'join-conversation'
   - Verify 'user-joined' event received

3. Test send message
   - Type message
   - Click send
   - Verify 'send-message' event emitted
   - Verify 'receive-message' event received
   - Verify message appears in chat

4. Test typing indicator
   - User A starts typing
   - Verify 'typing' event emitted
   - User B receives 'user-typing' event
   - User B sees "User A is typing..."
   - User A stops typing
   - Verify 'typing-stopped' event
   - Typing indicator disappears

5. Test read receipts
   - User A sends message
   - User B opens conversation
   - Verify 'read-receipt' event sent after 1 second
   - User A sees double checkmark
   - Verify message_reads record created

6. Open multiple windows/tabs
   - Send message in one tab
   - Verify message appears in other tabs
   - Verify real-time sync working
```

**Deliverable:** Real-time messaging via WebSocket

---

## Phase 5: Audio & Video Calls (Week 4-5)
**Duration:** 6-8 days  
**Deliverables:** Call initiation, WebRTC setup, call UI

### 5.1 Call Initiation & Signaling

**Backend Tasks:**

```
1. Create call service (src/services/callService.ts)
   - Function: initializeCall(conversationId, initiatorId, receiverId, callType)
     * Validate conversation exists
     * Validate both users are members (direct) or initiator is member (group)
     * Create call record (status='pending')
     * Return call ID
   
   - Function: acceptCall(callId, userId)
     * Verify call exists and userId is receiver
     * Update call: status='accepted', started_at=NOW()
     * Return call record
   
   - Function: rejectCall(callId, userId)
     * Verify call exists and userId is receiver
     * Update call: status='rejected', ended_at=NOW()
     * Return call record
   
   - Function: endCall(callId, userId)
     * Verify userId is initiator or receiver
     * Update call: status='ended', ended_at=NOW()
     * Calculate duration_seconds
     * Return call record
   
   - Function: getCallHistory(conversationId, limit=20)
     * Return recent calls in conversation
     * Order by created_at DESC

2. Create call controller (src/controllers/callController.ts)
   - POST /api/conversations/:conversationId/calls
     * Auth required
     * Body: { receiverId, callType: 'audio'|'video' }
     * Call initializeCall
     * Return call with ID
   
   - PUT /api/calls/:callId/accept
     * Auth required
     * Call acceptCall
   
   - PUT /api/calls/:callId/reject
     * Auth required
     * Call rejectCall
   
   - PUT /api/calls/:callId/end
     * Auth required
     * Call endCall
   
   - GET /api/conversations/:conversationId/call-history
     * Auth required
     * Return call history

3. Create call socket handlers (src/websocket/handlers/callHandlers.ts)
   - Event: 'call-initiate'
     * Body: { conversationId, receiverId, callType }
     * Create call record
     * Emit to receiver: 'call-incoming' { callId, initiatorId, callType, initiatorName }
   
   - Event: 'call-accept'
     * Body: { callId }
     * Update call: status='accepted'
     * Emit to initiator: 'call-accepted' { callId }
     * Both exchange WebRTC SDP offer/answer (see below)
   
   - Event: 'call-reject'
     * Body: { callId }
     * Update call: status='rejected'
     * Emit to initiator: 'call-rejected'
   
   - Event: 'ice-candidate'
     * Body: { callId, iceCandidate }
     * Forward to other participant
   
   - Event: 'sdp-offer'
     * Body: { callId, offer }
     * Forward to other participant (receiver)
   
   - Event: 'sdp-answer'
     * Body: { callId, answer }
     * Forward to other participant (initiator)
   
   - Event: 'call-end'
     * Body: { callId }
     * End call and emit to other participant
     * Update database with end time
```

**Frontend Tasks:**

```
1. Create call store (src/store/callStore.ts)
   Using Zustand:
   - State:
     * activeCall: Call | null
     * incomingCall: Call | null
     * callStatus: 'idle'|'initiating'|'ringing'|'connected'|'ending'
     * localStream: MediaStream | null
     * remoteStream: MediaStream | null
   
   - Actions:
     * setActiveCall(call)
     * setIncomingCall(call)
     * setCallStatus(status)
     * setLocalStream(stream)
     * setRemoteStream(stream)
     * clearCall()

2. Create WebRTC service (src/services/webrtcService.ts)
   - Function: getUserMedia(audio=true, video=false)
     * Request permission
     * Get MediaStream from device
     * Return stream
   
   - Function: createPeerConnection(turnServers=[])
     * Create RTCPeerConnection
     * Add TURN server configuration
     * Set up event listeners:
       - onicecandidate → emit 'ice-candidate'
       - ontrack → set remote stream
     * Return peerConnection
   
   - Function: createOffer(peerConnection)
     * const offer = await peerConnection.createOffer()
     * await peerConnection.setLocalDescription(offer)
     * Return offer
   
   - Function: createAnswer(peerConnection, offer)
     * await peerConnection.setRemoteDescription(offer)
     * const answer = await peerConnection.createAnswer()
     * await peerConnection.setLocalDescription(answer)
     * Return answer
   
   - Function: handleRemoteAnswer(peerConnection, answer)
     * await peerConnection.setRemoteDescription(answer)
   
   - Function: addIceCandidate(peerConnection, candidate)
     * await peerConnection.addIceCandidate(candidate)
   
   - Function: closePeerConnection(peerConnection)
     * Stop all tracks
     * Close connection

3. Create call socket hook (src/hooks/useCallSocket.ts)
   - Listen for 'call-incoming'
     * Add call to incomingCall store
     * Show notification
     * Play ringtone (audio)
   
   - Listen for 'call-accepted'
     * Update call status
     * Begin WebRTC handshake
   
   - Listen for 'call-rejected'
     * Clear call
     * Show message "Call rejected"
   
   - Listen for 'sdp-offer'
     * Call webrtcService.createAnswer
     * Emit 'sdp-answer'
   
   - Listen for 'sdp-answer'
     * Call webrtcService.handleRemoteAnswer
   
   - Listen for 'ice-candidate'
     * Call webrtcService.addIceCandidate

4. Create call hook (src/hooks/useCall.ts)
   - Function: initiateCall(conversationId, receiverId, callType)
     * Get user media
     * Emit 'call-initiate' via socket
     * Set callStatus to 'initiating'
     * Create SDP offer
     * Emit 'sdp-offer' when accepted
   
   - Function: acceptCall(callId)
     * Get user media
     * Emit 'call-accept' via socket
     * Set callStatus to 'connected'
   
   - Function: rejectCall(callId)
     * Emit 'call-reject' via socket
   
   - Function: endCall(callId)
     * Close peer connection
     * Stop media streams
     * Emit 'call-end' via socket
     * Clear call store

5. Create incoming call notification (src/components/Call/IncomingCallNotification.tsx)
   - Display:
     * Caller's name and avatar
     * "Incoming call..." text
     * Call type icon (audio/video)
   - Buttons:
     * [Accept] (green, large)
     * [Reject] (red, large)
   - Floating overlay on top of current view
   - Play ringtone (audio)

6. Create call screen component (src/components/Call/CallScreen.tsx)
   - Display during active call
   - Layout:
     * Large: Remote video/audio (with name)
     * Small: Local video in corner (PiP)
     * Bottom: Control buttons
   - Controls:
     * Mute/Unmute audio button
     * Toggle video button
     * End call button (red)
   - Show:
     * Call duration timer
     * Connection status
     * Network quality indicator
   - Full screen on mobile
   - Overlay on desktop

7. Create call button in conversation (src/components/Chat/CallButtons.tsx)
   - Two buttons in conversation header:
     * [📞 Audio Call] button
     * [📹 Video Call] button
   - Click → initiate call
   - Disabled if already in call
   - Disabled if recipient offline

8. Update conversation view
   - Add call buttons
   - Show incoming call notification
   - When call active: show call screen overlay
   - When call ends: return to chat
```

**Testing:**
```
1. Test call initiation
   - User A clicks "Audio Call"
   - Verify 'call-initiate' event sent
   - Verify call record created
   - Verify User B receives 'call-incoming'

2. Test call acceptance
   - User B clicks accept
   - Verify 'call-accept' event sent
   - Verify call status updated to 'accepted'
   - Verify 'call-accepted' sent to User A

3. Test WebRTC handshake
   - Both users get media
   - SDP offer/answer exchanged
   - ICE candidates exchanged
   - Peer connection established
   - Verify 'connection established' logged

4. Test audio call
   - Both users get audio stream
   - User A can hear User B
   - User B can hear User A
   - Audio quality acceptable

5. Test video call
   - Both users get video stream
   - User A can see User B
   - User B can see User A
   - Video quality acceptable
   - Both can toggle video on/off

6. Test call end
   - During call: User A clicks "End Call"
   - Verify 'call-end' event sent
   - Verify User B's call ends
   - Verify duration calculated
   - Verify call logged in history

7. Test call rejection
   - User B rejects incoming call
   - Verify 'call-reject' event
   - Verify User A sees "Call rejected"

8. Test call timeout
   - User A calls User B
   - User B doesn't respond for 30 seconds
   - Verify call auto-expires
   - Verify call marked as 'missed'
   - Verify notification sent
```

**Deliverable:** Complete audio & video calling system

---

## Phase 6: Groups & Advanced Features (Week 5-6)
**Duration:** 4-5 days  
**Deliverables:** Group chat creation, member management, group info

### 6.1 Group Chat

**Backend Tasks:**

```
1. Create group service (src/services/groupService.ts)
   - Function: createGroup(creatorId, name, avatarUrl, memberIds)
     * Validate inputs
     * Create conversation (type='group')
     * Add creator as admin
     * Add other members
     * Emit system message "Group created"
     * Return group conversation
   
   - Function: addMemberToGroup(conversationId, userId, newMemberId, adderRole)
     * Verify adderRole is 'admin'
     * Verify newMemberId not already member
     * Add as 'member' role
     * Emit system message "User X added User Y"
   
   - Function: removeMemberFromGroup(conversationId, userId, removedUserId, removerRole)
     * Verify removerRole is 'admin'
     * Soft-delete from conversation_members
     * Emit system message "User X removed User Y"
   
   - Function: leaveGroup(conversationId, userId)
     * Set left_at in conversation_members
     * Emit system message "User X left group"
   
   - Function: updateGroupInfo(conversationId, userId, updates)
     * Verify userId is admin
     * Update name, avatar, description
     * Emit system message "Group name changed to X"

2. Update conversation controller
   - POST /api/groups
     * Auth required
     * Body: { name, avatarUrl, memberIds }
     * Call createGroup
     * Return group conversation
   
   - PUT /api/groups/:conversationId
     * Auth required
     * Body: { name, avatarUrl, description }
     * Call updateGroupInfo
   
   - POST /api/groups/:conversationId/members
     * Auth required
     * Body: { userId }
     * Call addMemberToGroup
   
   - DELETE /api/groups/:conversationId/members/:userId
     * Auth required
     * Call removeMemberFromGroup or leaveGroup

3. Create system messages
   - When group created: "You created the group 'Project Team'"
   - When member added: "User A added User B"
   - When member removed: "User C removed User D"
   - When member left: "User E left the group"
   - Store as content_type='system' in messages table
```

**Frontend Tasks:**

```
1. Create group creation modal (src/components/Chat/CreateGroupModal.tsx)
   - Form fields:
     * Group name (required, max 255)
     * Group avatar (optional image upload or URL)
     * Member selection (search + multiselect)
   - Buttons:
     * [Create Group]
     * [Cancel]
   - Validation:
     * Group name required
     * At least 2 members

2. Create group info view (src/components/Chat/GroupInfoView.tsx)
   - Display:
     * Group avatar (large)
     * Group name
     * Group description
     * Member list
     * Admin label (only show if user is admin)
   - Actions (if admin):
     * Edit group info button
     * Add member button
     * Remove member button (per member)
   - Actions (all users):
     * Leave group button
   - Expand/collapse to see all members

3. Create edit group info modal (src/components/Chat/EditGroupInfoModal.tsx)
   - Same fields as creation
   - Pre-filled with current data
   - Only for admins
   - Submit updates to backend

4. Create add member modal (src/components/Chat/AddMemberModal.tsx)
   - Search for users not in group
   - Multi-select
   - [Add to Group] button
   - Shows existing members grayed out

5. Update message bubble for system messages
   - Show centered text style
   - Gray background
   - "System message" styling
   - Examples: "User joined the group", "Group name changed"

6. Update conversation header
   - For groups: show group name + member count
   - Click on header → show group info
   - Encryption badge still shows

7. Update conversation list
   - For groups: show group avatar + name
   - Show member count in list item
```

**Testing:**
```
1. Test create group
   - User A clicks "Create Group"
   - Fills in name, members
   - Clicks create
   - Verify group created
   - Verify both users are members
   - Verify system message

2. Test add member
   - User A (admin) opens group info
   - Clicks "Add Member"
   - Selects User C
   - Clicks "Add"
   - Verify User C added to group
   - Verify system message
   - Verify User C sees group in list

3. Test remove member
   - User A (admin) opens group info
   - Clicks remove next to User B
   - Verify User B removed
   - Verify system message
   - Verify User B no longer sees group

4. Test leave group
   - User B opens group info
   - Clicks "Leave Group"
   - Confirm
   - Verify User B removed
   - Verify group no longer appears in list

5. Test group messages
   - Send message in group
   - Verify all members see message
   - Verify read receipts work for all members
```

**Deliverable:** Group chat functionality

---

## Phase 7: Testing, Security, & Polish (Week 6-7)
**Duration:** 4-5 days  
**Deliverables:** Unit tests, security audit, performance optimization, bug fixes

### 7.1 Security Hardening

```
1. Security headers
   - Implement in Express middleware:
     * Helmet.js for all headers
     * HSTS (Strict-Transport-Security)
     * CSP (Content-Security-Policy)
     * X-Frame-Options: DENY
     * X-Content-Type-Options: nosniff

2. Rate limiting
   - Rate limit auth endpoints
   - Rate limit message endpoints
   - Rate limit search endpoints

3. SQL injection prevention
   - Audit all database queries
   - Verify parameterized queries used

4. XSS prevention
   - Validate all user inputs
   - Escape outputs
   - Use CSP headers

5. CSRF protection
   - SameSite cookies
   - CSRF tokens (if needed)

6. Dependency scanning
   - npm audit
   - Fix vulnerabilities
   - Set up automated scanning (GitHub Security)

7. Encryption audit
   - Verify AES-256 or ChaCha20 used
   - Verify keys never stored on server
   - Verify nonces are random
   - Verify message authentication

8. Authentication audit
   - Verify JWT tokens validated
   - Verify refresh token rotation
   - Verify sessions managed properly
   - Verify logout clears all sessions

9. API security audit
   - Verify all endpoints check auth
   - Verify authorization checks (user only sees own data)
   - Verify no sensitive data in logs
   - Verify no sensitive data in errors
```

### 7.2 Testing

```
1. Unit tests
   - Test encryption functions
   - Test JWT generation/verification
   - Test user service functions
   - Test message service functions
   - Target: 80%+ coverage

2. Integration tests
   - Test auth flow end-to-end
   - Test message sending end-to-end
   - Test group creation end-to-end
   - Test call flow (without actual WebRTC)
   - Run against test database

3. E2E tests
   - User logs in
   - User searches and starts chat
   - User sends message
   - Other user receives message
   - Both see read receipt
   - User makes call
   - Call connects
   - Call ends and logged

4. Performance tests
   - Load test: 1000 concurrent users
   - Message send latency < 2 seconds
   - API response time < 500ms
   - WebSocket throughput acceptable

5. Browser compatibility
   - Test on Chrome, Firefox, Safari, Edge
   - Test on mobile browsers
   - Test PWA install

6. Device testing
   - Test on iPhone
   - Test on Android
   - Test on iPad
   - Test on desktop browsers
```

### 7.3 Bug Fixes & Optimizations

```
1. Performance optimization
   - Database query optimization
   - Index analysis and creation
   - Redis caching for public keys
   - Lazy loading of messages
   - Image optimization/CDN
   - Code splitting in frontend

2. User experience improvements
   - Better error messages
   - Loading states everywhere
   - Offline message queueing (future)
   - Better animations
   - Accessibility improvements

3. Bug fixes
   - Fix any issues found in testing
   - Fix mobile UI issues
   - Fix WebSocket disconnection handling
   - Fix encryption edge cases

4. Documentation
   - API documentation (Swagger/OpenAPI)
   - Developer setup guide
   - Architecture documentation
   - Deployment guide
```

**Deliverable:** Secure, tested, optimized application

---

## Phase 8: Deployment & Launch (Week 7-8)
**Duration:** 3-4 days  
**Deliverables:** Production deployment, monitoring, launch

### 8.1 Deployment Preparation

```
1. Environment setup
   - Create production database
   - Create production environment variables
   - Set up secrets management (AWS Secrets Manager, etc)
   - Configure logging in production
   - Set up error tracking (Sentry)
   - Set up analytics (optional)

2. Database migration
   - Create production database
   - Run all migrations
   - Verify schema
   - Set up backups

3. Build & deployment
   - Build Docker images
   - Push to Docker registry
   - Deploy to AWS/GCP/DigitalOcean
   - Set up health checks
   - Configure auto-scaling

4. DNS & SSL
   - Point domain to server
   - Generate SSL certificate (Let's Encrypt)
   - Configure HTTPS
   - Set HSTS header

5. Monitoring setup
   - CPU, memory, disk monitoring
   - Database connection monitoring
   - API latency monitoring
   - Error rate monitoring
   - WebSocket connection monitoring
   - Set up alerts

6. Backup strategy
   - Daily database backups
   - Backup storage (separate location)
   - Test restore process
   - Document recovery procedures

7. Load balancing
   - Set up load balancer
   - Multiple backend instances
   - Session persistence
   - Sticky sessions for WebSocket

8. Testing in production
   - Smoke tests
   - Load tests
   - Security scan
   - Performance test
   - User acceptance testing

9. Documentation
   - Deployment guide
   - Runbook for common issues
   - Incident response plan
   - Scaling guide
```

### 8.2 Post-Launch

```
1. Monitoring
   - Watch error rates
   - Monitor performance
   - Check user feedback
   - Monitor server resources

2. First week support
   - Watch for bugs
   - Fix critical issues immediately
   - Communicate with users about issues
   - Gather feedback

3. Optimization
   - Optimize based on production data
   - Fix any discovered issues
   - Improve performance where needed
   - Adjust capacity as needed

4. Feature requests
   - Collect feature requests from users
   - Prioritize for Version 2
   - Plan roadmap
```

**Deliverable:** Production-ready, deployed application

---

## Phase 9: Version 2 Features (Future)
**Duration:** Future sprints

```
Features for Version 2:
- Message search
- File sharing
- Voice messages
- Stickers & GIFs
- Message reactions
- Group video calls (requires SFU)
- Message forwarding
- User verification badges
- Advanced privacy settings
- End-to-end encryption verification (safety numbers)
- Message drafts auto-save
- Pin important messages
- Message archive
- Custom themes
- Dark mode system preference
- Notifications customization
- Do Not Disturb mode
- Status messages
- 2FA authentication
- Biometric login
- Message scheduling (future)
- Call recording (optional, privacy consideration)
```

---

## Summary Timeline

```
Week 1:    Phase 1 (Setup) + Phase 2 (Auth)
Week 2:    Phase 2 (Auth) + Phase 3 (Profiles & Encryption)
Week 3:    Phase 4 (Messaging)
Week 4:    Phase 4 (Messaging) + Phase 5 (Calls)
Week 5:    Phase 5 (Calls) + Phase 6 (Groups)
Week 6:    Phase 6 (Groups) + Phase 7 (Testing & Security)
Week 7:    Phase 7 (Testing & Security) + Phase 8 (Deployment)
Week 8:    Phase 8 (Deployment & Launch)

Weeks 9+:  Bug fixes, monitoring, optimization, v2 planning
```

---

## Key Success Metrics

**Code Quality:**
- TypeScript strict mode enabled
- ESLint + Prettier configured
- 70%+ test coverage
- No critical security issues

**Performance:**
- Message latency < 2 seconds
- API response < 500ms
- Page load < 3 seconds
- Call connection < 5 seconds

**User Experience:**
- Intuitive navigation
- No JavaScript errors in console
- All features working on mobile
- Accessible (WCAG 2.1 AA)

**Security:**
- All data encrypted end-to-end
- HTTPS everywhere
- No hardcoded secrets
- Regular security audits

**Reliability:**
- 99.9% uptime
- Zero data loss
- Automatic backups
- Graceful error handling

---

## Build Approach for AI Coding Tools

**Recommended prompt for AI:**

```
"I want to build a secure chat app with end-to-end encryption.
I have 6 detailed documents:
1. PRD - What features to build
2. TRD - How to build technically
3. App Flow - User journeys
4. UI/UX Brief - Design specifications
5. Backend Schema - Database design
6. Implementation Plan - Build sequence

Please:
1. Read all documents carefully
2. Don't start coding yet
3. Summarize what you understand
4. Identify any missing details
5. Create a build plan

After I confirm, we'll build phase by phase."
```

---

## Helpful Tips

1. **Start small:** Build Phase 1 first, get it working, then move to Phase 2
2. **Test continuously:** Don't wait until end to test
3. **Ask for feedback:** Show working features to get feedback early
4. **Document as you go:** Document code, decisions, setup
5. **Use version control:** Commit often with clear messages
6. **Monitor costs:** Cloud services can get expensive, monitor usage
7. **Security first:** Don't cut corners on security
8. **Users matter:** Keep user experience smooth and intuitive
9. **Iterate:** Build MVP, get users, iterate based on feedback
10. **Celebrate wins:** Each phase completion is a win!

---

This implementation plan is detailed enough for an AI coding agent to understand the build sequence and create a complete application following this roadmap.
