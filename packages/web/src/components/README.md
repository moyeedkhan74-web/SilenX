# 🎯 SilenX UI Components

Production-ready React UI components for messaging app with pinning and voice notes.

## 📦 Components

### PinButton
Pin/unpin messages like WhatsApp & Telegram.

It also supports a WhatsApp-style pin overlay on photo messages, giving a native thumbnail preview with pin, reply, forward, and share actions.

**Props:**
- `messageId: string` - Message ID to pin
- `isPinned: boolean` - Is message pinned?
- `onPin: (id) => Promise<void>` - Pin handler
- `onUnpin: (id) => Promise<void>` - Unpin handler
- `loading?: boolean` - Show loading state

**Usage:**
```tsx
import { PinButton } from '@silenx/web/components';

<PinButton
  messageId={msg.id}
  isPinned={msg.isPinned}
  onPin={handlePin}
  onUnpin={handleUnpin}
/>
```

### MicButton
Record voice notes like WhatsApp & Telegram.

**Props:**
- `onRecordingStart?: () => void` - Start recording
- `onRecordingStop?: (path, duration) => Promise<void>` - Stop recording
- `onRecordingCancel?: () => void` - Cancel recording
- `disabled?: boolean` - Disable button

**Usage:**
```tsx
import { MicButton } from '@silenx/web/components';

<MicButton
  onRecordingStart={handleStart}
  onRecordingStop={handleStop}
  onRecordingCancel={handleCancel}
/>
```

## 🎨 Styling

All components come with complete styling:
- **PinButton**: Gray/Blue, smooth animations, responsive
- **MicButton**: Blue/Red/Green, pulse animation, responsive

CSS files are automatically imported.

## 📚 Examples

See `ChatExample.tsx` for complete working example with:
- Message list with pin buttons
- Chat input with mic button
- Full integration with managers

## 🚀 Quick Start

```tsx
import { PinButton, MicButton } from '@silenx/web/components';

export function Chat() {
  return (
    <div>
      {/* Message with pin */}
      <div>
        <p>Message text</p>
        <PinButton {...props} />
      </div>

      {/* Input with mic */}
      <input type="text" placeholder="Type..." />
      <MicButton {...props} />
    </div>
  );
}
```

## 📖 Documentation

- **START_HERE.md** - Quick overview
- **PIN_MIC_BUTTON_QUICK_REF.md** - Copy-paste examples
- **UI_COMPONENTS_GUIDE.md** - Detailed guide
- **PIN_MIC_VISUAL_SUMMARY.md** - Visual examples

## ✨ Features

✅ Pin/unpin messages
✅ Record voice notes  
✅ Beautiful animations
✅ Mobile responsive
✅ Type-safe TypeScript
✅ Error handling
✅ Production-ready

## 🔧 Customization

### Change Colors
Edit `.css` files to change colors and animations.

### Change Size
Adjust `width` and `height` in CSS files.

### Change Icons
Replace SVG elements in component files.

## 📱 Responsive

Both components are fully responsive:
- Desktop: Full size buttons
- Mobile: Optimized smaller size

## 🧪 Testing

Components are production-ready and tested.

## 📞 Support

Check documentation files for detailed guides and examples.

---

**Production-ready UI components for your messaging app!** 🚀
