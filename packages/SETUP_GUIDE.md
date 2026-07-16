# SilenX Multi-Platform Setup & Build Guide

## Prerequisites

```bash
# Required
node >= 18.0.0
npm >= 9.0.0 or yarn >= 3.0.0

# Verify installation
node --version
npm --version
```

---

## Project Setup

### 1. Install Dependencies

```bash
# Install all packages
npm install

# OR with yarn
yarn install
```

### 2. Build Core Library

```bash
cd packages/core
npm run build

# Or watch mode (auto-rebuild on changes)
npm run watch
```

This compiles TypeScript to JavaScript:
```
src/
  ├── types.ts
  ├── cache-manager.ts
  ├── media-manager.ts
  ├── backup-engine.ts
  └── index.ts
         ↓
lib/
  ├── types.js
  ├── cache-manager.js
  ├── media-manager.js
  ├── backup-engine.js
  └── index.js
```

### 3. Build Desktop Adapter

```bash
cd packages/desktop
npm run build
```

### 4. Build Web Adapter

```bash
cd packages/web
npm run build
```

---

## Platform-Specific Setup

### Desktop (Electron)

#### Install Dependencies
```bash
cd packages/desktop
npm install better-sqlite3
```

#### In Your Electron App
```typescript
// main.ts (Electron main process)
import { ElectronSQLiteStorage, ElectronMediaDownloader } from '@silenx/desktop';
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

// Initialize storage
const dbPath = path.join(app.getPath('userData'), 'silenx.db');
const db = new Database(dbPath);
const storage = new ElectronSQLiteStorage(dbPath, db);

// Initialize downloader
const downloadsPath = app.getPath('downloads');
const mediaPath = path.join(app.getPath('userData'), 'media');
const downloader = new ElectronMediaDownloader(storage, downloadsPath, mediaPath);

// Export for use in renderer process via IPC
export { storage, downloader };
```

#### Using in Renderer Process
```typescript
// renderer.ts (Electron renderer process)
import { ipcRenderer } from 'electron';

// Add contact via IPC
const addContact = (contact: Contact) => {
  return ipcRenderer.invoke('storage:addContact', contact);
};

// Download media via IPC
const downloadMedia = (url: string, fileName: string, messageId: string) => {
  return ipcRenderer.invoke('media:download', { url, fileName, messageId });
};
```

---

### Web (React)

#### Install Dependencies
```bash
cd packages/web
npm install dexie
```

#### In Your React App
```typescript
// storage.ts
import { DexieStorage, initializeDexie } from '@silenx/web';

// Initialize database
const db = initializeDexie();
export const storage = new DexieStorage(db);
```

#### Using in React Components
```typescript
// contacts.tsx
import { storage } from './storage';
import { Contact } from '@silenx/core';

export function ContactsList({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    // Get contacts from storage
    storage.getAllContacts(userId).then(setContacts);
  }, [userId]);

  const handleAddContact = async (contact: Contact) => {
    await storage.addContact(contact);
    // Re-fetch
    const updated = await storage.getAllContacts(userId);
    setContacts(updated);
  };

  return (
    <div>
      {contacts.map((contact) => (
        <div key={contact.id}>{contact.name}</div>
      ))}
    </div>
  );
}
```

#### Service Worker Setup (Optional - for offline)
```typescript
// public/service-worker.ts
const CACHE_NAME = 'silenx-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/app.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

Register in React:
```typescript
// App.tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }
}, []);
```

---

### Mobile (React Native)

#### Install Dependencies
```bash
npm install react-native-sqlite-storage
npm install react-native-fs

# For iOS
cd ios && pod install && cd ..

# For Android - no additional step needed
```

#### Linking
```bash
# For React Native < 0.60 (auto-linking if >= 0.60)
react-native link react-native-sqlite-storage
```

#### In Your React Native App
```typescript
// storage.ts
import { RNSQLiteStorage } from '@silenx/mobile';

const storage = new RNSQLiteStorage('silenx.db');

export default storage;
```

#### Using in Screens
```typescript
// ContactsScreen.tsx
import { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import storage from './storage';
import { Contact } from '@silenx/core';

export function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const userId = 'current-user';
    const data = await storage.getAllContacts(userId);
    setContacts(data);
  };

  return (
    <View>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{item.name}</Text>}
      />
    </View>
  );
}
```

---

## Common Code Across All Platforms

### Cache Management

```typescript
import { TypedCacheManager } from '@silenx/core';

// Works identically on all platforms
const cache = new TypedCacheManager();

// Cache a contact
cache.setContact(contact);

// Get from cache (fast!)
const cached = cache.getContact(contactId);

// Invalidate when data changes
cache.invalidateContacts(userId);
```

### Media Management

```typescript
import { MediaManager } from '@silenx/core';

// Platform-agnostic (same on all platforms)
const mediaManager = new MediaManager(storage, downloader);

// Download media
const filePath = await mediaManager.downloadMedia(
  'https://example.com/image.jpg',
  'image.jpg',
  messageId,
  (progress) => console.log(`${progress}%`)
);

// Delete media
await mediaManager.deleteMedia(mediaId);

// Check if downloaded
const isDownloaded = await mediaManager.isMediaDownloaded(mediaId);

// Get file path
const path = await mediaManager.getMediaFilePath(mediaId);
```

### Backup & Restore

```typescript
import { BackupEngine } from '@silenx/core';

// Initialize backup engine (same on all platforms)
const backupEngine = new BackupEngine(storage);

// Create backup
const backup = await backupEngine.createBackup({
  includeMedia: true,
  encryption: true,
  compressionLevel: 'default',
  destination: 'local'
});

// Save backup (platform-specific save)
// Desktop: fs.writeFileSync('backup.silenx', backup)
// Web: download(backup)
// Mobile: RNFS.writeFile(path, backup)

// Restore from backup
const data = await backupEngine.restoreBackup(backupFile, password);

// Import data
await storage.importData(data);
```

---

## Database Schema

### Contacts Table
```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT,
  phoneNumber TEXT,
  email TEXT,
  avatar TEXT,
  status TEXT,           -- 'online', 'offline', 'away'
  lastSeen INTEGER,      -- timestamp
  createdAt INTEGER,     -- timestamp
  updatedAt INTEGER,     -- timestamp
  isBlocked BOOLEAN,
  isFavorite BOOLEAN
);
```

### Chats Table
```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  userId TEXT,
  participantIds TEXT,   -- JSON array
  chatName TEXT,
  lastMessage TEXT,
  lastMessageTime INTEGER,
  unreadCount INTEGER,
  isPinned BOOLEAN,
  isMuted BOOLEAN,
  isArchived BOOLEAN,
  createdAt INTEGER,
  updatedAt INTEGER
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chatId TEXT,
  senderId TEXT,
  content TEXT,
  status TEXT,           -- 'sent', 'delivered', 'read'
  timestamp INTEGER,
  editedAt INTEGER,
  isDeleted BOOLEAN,
  deletedAt INTEGER
);
```

### Media Metadata Table
```sql
CREATE TABLE media_metadata (
  id TEXT PRIMARY KEY,
  mediaId TEXT,
  messageId TEXT,
  fileName TEXT,
  filePath TEXT,         -- Local path to file
  fileSize INTEGER,
  mimeType TEXT,
  downloadStatus TEXT,   -- 'pending', 'downloading', 'completed', 'failed'
  downloadProgress INTEGER,
  downloadedAt INTEGER,
  isDeleted BOOLEAN
);
```

---

## Testing

### Unit Tests (Jest)

```bash
# Create test file
npm test --watch

# Example test
// cache-manager.test.ts
import { CacheManager } from '@silenx/core';

describe('CacheManager', () => {
  it('should cache and retrieve items', () => {
    const cache = new CacheManager({ ttl: 1000 });
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('should expire items', async () => {
    const cache = new CacheManager({ ttl: 100 });
    cache.set('key', 'value');
    await new Promise(r => setTimeout(r, 150));
    expect(cache.get('key')).toBeNull();
  });
});
```

### Integration Tests

```bash
# Test across storage adapters
npm run test:integration
```

```typescript
// storage.integration.test.ts
import { ElectronSQLiteStorage } from '@silenx/desktop';
import { DexieStorage } from '@silenx/web';

describe('Storage Adapters', () => {
  const testContact = { /* ... */ };

  it('should store and retrieve contact (Desktop)', async () => {
    const storage = new ElectronSQLiteStorage(dbPath, db);
    await storage.addContact(testContact);
    const retrieved = await storage.getContact(testContact.id);
    expect(retrieved).toEqual(testContact);
  });

  it('should store and retrieve contact (Web)', async () => {
    const storage = new DexieStorage(db);
    await storage.addContact(testContact);
    const retrieved = await storage.getContact(testContact.id);
    expect(retrieved).toEqual(testContact);
  });
});
```

---

## Troubleshooting

### Issue: SQLite database locked
```
Error: database is locked
```

**Solution:**
```typescript
// Close other connections before writing
db.close();
db = new Database(dbPath);
```

### Issue: IndexedDB quota exceeded
```
Error: QuotaExceededError
```

**Solution:**
```typescript
// Clear old data
const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
await storage.cleanup(thirtyDaysAgo);
```

### Issue: Media file not found after restore
```
Error: File path mismatch
```

**Solution:**
```typescript
// Update file paths in backup
const backupData = await restoreBackup(file, password);
backupData.mediaMetadata.forEach((media) => {
  media.filePath = calculateNewPath(media.fileName);
});
```

---

## Performance Tips

### 1. Use Cache Aggressively
```typescript
// BAD - database access on every render
const contacts = await storage.getAllContacts(userId);

// GOOD - use cache
let contacts = cache.getContacts(userId);
if (!contacts) {
  contacts = await storage.getAllContacts(userId);
  cache.setContacts(userId, contacts);
}
```

### 2. Batch Operations
```typescript
// BAD - multiple inserts
for (const contact of contacts) {
  await storage.addContact(contact);
}

// GOOD - batch insert
await db.contacts.bulkAdd(contacts);
```

### 3. Limit Query Results
```typescript
// BAD - load all messages
const messages = await storage.getMessagesForChat(chatId);

// GOOD - load recent first
const messages = await storage.getMessagesForChat(chatId, 50, 0);
```

---

## Deployment Checklist

- [ ] All TypeScript compiled to JavaScript
- [ ] All tests passing
- [ ] No console errors
- [ ] Database migrations tested
- [ ] Backup/restore tested
- [ ] Media download tested
- [ ] Offline mode tested (web)
- [ ] Performance profiled
- [ ] Security reviewed

---

## Next Steps

1. ✅ Install core library
2. ✅ Build core library
3. **Next**: Integrate into your app
4. **Then**: Test with real data
5. **Then**: Add cloud integrations
6. **Then**: Deploy

---

## Support

For issues or questions:
1. Check troubleshooting section
2. Check documentation
3. Review test files for usage examples
4. Check ARCHITECTURE.md for design details

Happy coding! 🚀
