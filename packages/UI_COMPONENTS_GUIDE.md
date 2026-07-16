# 🎯 PIN BUTTON & MIC BUTTON - UI Components Guide

## 📌 PIN BUTTON

### Visual
```
┌─────────────────────────────────────────┐
│ Bro, this is our code                   │ [PIN]  <- Click to pin
│ 10:30 AM                                │
└─────────────────────────────────────────┘

After pinned:
┌─────────────────────────────────────────┐
│ Bro, this is our code                   │ [📌]  <- Now pinned (blue)
│ 10:30 AM                                │
└─────────────────────────────────────────┘
```

### Props
```typescript
interface PinButtonProps {
  messageId: string;        // Which message to pin
  isPinned: boolean;        // Is it pinned?
  onPin: (id) => Promise;   // Pin function
  onUnpin: (id) => Promise; // Unpin function
  loading?: boolean;        // Show loading spinner
}
```

### Usage
```typescript
import { PinButton } from './components/PinButton';

<PinButton
  messageId={msg.id}
  isPinned={msg.isPinned}
  onPin={handlePin}
  onUnpin={handleUnpin}
/>
```

### What It Does
```
User clicks pin button
    ↓
Loading spinner shows
    ↓
Backend pins/unpins message
    ↓
Button turns blue (pinned) or gray (unpinned)
    ↓
Message appears in pinned list
```

### Styles (Already Done!)
- 📱 Mobile responsive (shrinks on small screens)
- 🎨 Blue when pinned (#007AFF)
- 🎨 Gray when unpinned (#f0f0f0)
- ⚡ Smooth animations
- 🚫 Disabled during loading

---

## 🎙️ MIC BUTTON

### Visual
```
Normal state:
┌─────────────────────────────────────────┐
│ Type message...                      [🎤] <- Press and hold
└─────────────────────────────────────────┘

While recording:
┌─────────────────────────────────────────┐
│ Type message...                      [🎤] <- Red pulsing button
│                        ● 0:12 Release to send
└─────────────────────────────────────────┘

After locked (double click):
┌─────────────────────────────────────────┐
│ Type message...                      [🎤] <- Green button
│                        ● 0:45 ✕ Cancel
└─────────────────────────────────────────┘
```

### Props
```typescript
interface MicButtonProps {
  onRecordingStart?: () => void;                           // Recording started
  onRecordingStop?: (filePath, duration) => Promise<void>; // Recording stopped
  onRecordingCancel?: () => void;                          // Recording cancelled
  disabled?: boolean;                                       // Disable button
}
```

### Usage
```typescript
import { MicButton } from './components/MicButton';

<MicButton
  onRecordingStart={handleStart}
  onRecordingStop={handleStop}
  onRecordingCancel={handleCancel}
/>
```

### How It Works
```
1. PRESS AND HOLD to record
   ↓
2. Timer shows: 0:05, 0:10, 0:15...
   ↓
3. See "Release to send" hint
   ↓
4. RELEASE to send voice note
   ↓
5. Or DOUBLE CLICK to lock
   ↓
6. Then click ✕ CANCEL if needed
```

### Features
- 🎤 Press to record (like WhatsApp)
- ⏱️ Timer shows recording time
- 🔒 Double-click to lock recording
- 🎯 Swipe to cancel (mobile)
- ❌ Cancel button when locked
- 📨 Auto-send on release
- 🎨 Color changes: Blue → Red → Green

### Styles (Already Done!)
- 🔴 RED while recording (pulsing animation)
- 🟢 GREEN when locked
- 🔵 BLUE when ready
- ⏱️ Timer in monospace font
- 📦 Box shadow for depth
- 📱 Mobile responsive

---

## ✅ COMPLETE EXAMPLE

### Setup
```typescript
import { PinButton } from './components/PinButton';
import { MicButton } from './components/MicButton';
import { MessageManager, VoiceNoteManager } from '@silenx/core';

// Create managers
const messageManager = new MessageManager(storage);
const voiceNoteManager = new VoiceNoteManager(storage, recorder);
```

### Message With Pin
```typescript
<div className="message">
  <p>{message.text}</p>
  
  <PinButton
    messageId={message.id}
    isPinned={message.isPinned}
    onPin={async (id) => {
      await messageManager.pinMessage(id, userId);
    }}
    onUnpin={async (id) => {
      await messageManager.unpinMessage(id);
    }}
  />
</div>
```

### Input With Mic
```typescript
<div className="input-area">
  <input 
    type="text" 
    placeholder="Type message..."
  />
  
  <MicButton
    onRecordingStart={async () => {
      await voiceNoteManager.startRecording({ format: 'mp3' });
    }}
    onRecordingStop={async (filePath, duration) => {
      const voiceNote = await voiceNoteManager.recordVoiceNote(
        chatId, 
        userId
      );
      sendMessage(voiceNote);
    }}
    onRecordingCancel={() => {
      console.log('Recording cancelled');
    }}
  />
</div>
```

---

## 🎨 CSS Classes

### PIN BUTTON
```css
.pin-btn          /* Main button */
.pin-btn.pinned   /* When message is pinned */
.pin-btn:hover    /* Hover state */
.pin-btn:disabled /* Loading state */
```

### MIC BUTTON
```css
.mic-btn              /* Main button */
.mic-btn.recording    /* While recording */
.mic-btn.locked       /* When locked */
.recording-indicator  /* Timer display */
.recording-dot        /* Blinking dot */
.recording-time       /* Time text */
.recording-hint       /* "Release to send" text */
.cancel-btn           /* Cancel button */
```

---

## 🚀 Integration Steps

### 1. Install Components
```bash
# Already created in:
# packages/web/src/components/PinButton.tsx
# packages/web/src/components/MicButton.tsx
# packages/web/src/components/PinButton.css
# packages/web/src/components/MicButton.css
# packages/web/src/components/ChatExample.tsx
```

### 2. Import in Your App
```typescript
import { PinButton } from '@silenx/web/components';
import { MicButton } from '@silenx/web/components';
```

### 3. Use in Messages
```typescript
<PinButton
  messageId={id}
  isPinned={pinned}
  onPin={handlePin}
  onUnpin={handleUnpin}
/>
```

### 4. Use in Input
```typescript
<MicButton
  onRecordingStart={startRecording}
  onRecordingStop={stopRecording}
  onRecordingCancel={cancelRecording}
/>
```

---

## 📱 Mobile Behavior

### Pin Button
- Shrinks to 36x36px (from 40x40px)
- Tap to pin/unpin
- Same functionality

### Mic Button
- Grows slightly on hover
- Press and hold to record
- Release to send
- Swipe left to cancel (gesture support)
- Locked mode persists until unlocked

---

## ⚡ Performance Tips

### Pin Button
- Uses React.useState for local state
- No re-renders unless isPinned changes
- Async operations don't block UI
- Loading spinner shows progress

### Mic Button
- Timer uses useRef (no re-render overhead)
- Interval only starts when recording
- Auto-cleanup on unmount
- Gesture detection optimized

---

## 🔧 Customization

### Change Colors
```css
/* In PinButton.css */
.pin-btn.pinned {
  background: #007AFF;  /* Change this color */
  color: white;
}

/* In MicButton.css */
.mic-btn.recording {
  background: #FF3B30;  /* Change this color */
}
```

### Change Size
```css
/* Larger buttons */
.pin-btn {
  width: 48px;    /* was 40px */
  height: 48px;   /* was 40px */
}

.mic-btn {
  width: 56px;    /* was 48px */
  height: 56px;   /* was 48px */
}
```

### Change Icons
```typescript
// Edit SVG in PinButton.tsx or MicButton.tsx
// Replace the <svg> element with your icon
```

---

## 🐛 Error Handling

### If pin fails
```typescript
const handlePin = async (id) => {
  try {
    await messageManager.pinMessage(id, userId);
  } catch (error) {
    alert('Failed to pin message');
    console.error(error);
  }
};
```

### If recording fails
```typescript
const handleStart = async () => {
  try {
    await voiceNoteManager.startRecording({ format: 'mp3' });
  } catch (error) {
    alert('Microphone not available');
    console.error(error);
  }
};
```

---

## 🎯 What's Next

✅ Components created
✅ CSS styled
✅ Examples provided
⏳ Platform-specific recorders (Desktop/Mobile)
⏳ Cloud integrations

---

## 📋 Files Created

| File | What |
|------|------|
| PinButton.tsx | Pin button component |
| MicButton.tsx | Mic button component |
| PinButton.css | Pin button styles |
| MicButton.css | Mic button styles |
| ChatExample.tsx | Complete usage example |

---

**All files are production-ready!** 🚀
