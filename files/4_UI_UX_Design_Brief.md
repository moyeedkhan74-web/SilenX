# UI/UX Design Brief
## Secure Chat App - Visual Design & Experience Guidelines

---

## 1. Design Philosophy

**Core Principles:**
1. **Privacy-First Design** - Encryption badges, security indicators visible everywhere
2. **Minimalist & Clean** - No clutter, focus on messaging
3. **Modern & Trustworthy** - Professional look, not flashy
4. **Accessible** - Works for everyone, high contrast, clear typography
5. **Fast & Responsive** - Smooth animations, zero janky experiences

**Design Mood:**
- Clean and professional
- Trustworthy (security-focused)
- Modern (contemporary aesthetics)
- Calm (not overstimulating)
- Efficient (purpose-driven)

---

## 2. Design Style & Inspiration

**Primary Inspiration:**
- **Telegram** - Clean, minimal, fast
- **iMessage** - Conversational, friendly, intuitive
- **Signal** - Privacy-focused, professional
- **Discord** - Organized, dark mode first

**Design Approach:**
- Flat design with subtle shadows (neumorphism lite)
- Rounded corners for friendliness (12-16px border radius)
- Bold typography hierarchy
- Generous whitespace
- Icons over text where possible

---

## 3. Color Palette

### Primary Colors

```
┌─────────────────────────────────────────┐
│        PRIMARY COLOR PALETTE            │
└─────────────────────────────────────────┘

PRIMARY (Brand Blue)
├─ Light   #4A90E2
├─ Main    #2E5BBA (for buttons, links)
├─ Dark    #1E3A8A
└─ Darker  #0F2151

SECONDARY (Accent Green - for encryption/trust)
├─ Light   #4ECDC4
├─ Main    #2B9D8F
└─ Dark    #1B5D52

TERTIARY (Action Orange - for calls)
├─ Light   #FFB84D
├─ Main    #FF9800
└─ Dark    #E68900

SUCCESS (Green - for successful actions)
├─ Light   #81C784
├─ Main    #4CAF50
└─ Dark    #388E3C

DANGER (Red - for warnings/delete)
├─ Light   #EF5350
├─ Main    #F44336
└─ Dark    #D32F2F

WARNING (Amber - for alerts)
├─ Light   #FFB74D
├─ Main    #FFC107
└─ Dark    #F57F17

NEUTRAL (Grays)
├─ White       #FFFFFF
├─ Light Gray  #F5F5F5
├─ Medium Gray #EEEEEE
├─ Gray        #BDBDBD
├─ Dark Gray   #757575
└─ Charcoal    #424242
```

### Dark Mode Colors

```
DARK MODE (Default for privacy-conscious users)

Background Primary:  #121212
Background Secondary: #1E1E1E
Background Tertiary:  #2C2C2C
Text Primary:         #FFFFFF (100%)
Text Secondary:       #B3B3B3 (70%)
Text Tertiary:        #808080 (50%)
Border:               #373737

Card Background:      #1E1E1E
Input Background:     #2C2C2C
```

### Light Mode Colors

```
LIGHT MODE (for accessibility)

Background Primary:   #FFFFFF
Background Secondary: #F5F5F5
Background Tertiary:  #EEEEEE
Text Primary:         #212121 (100%)
Text Secondary:       #656565 (70%)
Text Tertiary:        #999999 (50%)
Border:               #E0E0E0

Card Background:      #FFFFFF
Input Background:     #F9F9F9
```

### Color Usage

| Element | Color | Usage |
|---------|-------|-------|
| Primary Buttons | #2E5BBA | Call-to-action, send messages |
| Secondary Buttons | #BDBDBD | Less important actions |
| Encryption Badge | #4ECDC4 | Indicates E2E encryption |
| Links | #2E5BBA | Underlined or colored text |
| Success Messages | #4CAF50 | "Message sent", "Profile updated" |
| Error Messages | #F44336 | "Failed to send", "Error" |
| Typing Indicator | #4A90E2 | Animated dots |
| Read Receipts | #4ECDC4 | Double checkmark (read) |
| Online Status | #4CAF50 | Green dot indicator |
| Away Status | #FFC107 | Yellow dot indicator |
| Offline Status | #BDBDBD | Gray dot indicator |

---

## 4. Typography

### Font Families

**Primary Font (All text):**
```
Font Stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif

Why: System fonts load instantly (no network request), look native on each platform
```

**Fallback Fonts:**
```
1. -apple-system (iOS/macOS)
2. BlinkMacSystemFont (macOS Chrome)
3. Segoe UI (Windows)
4. Roboto (Android, Google ecosystem)
5. Helvetica Neue (older systems)
6. Arial (universal fallback)
```

### Font Sizing & Scale

```
┌──────────────────────────────────────────┐
│         TYPOGRAPHY SCALE                 │
├──────────────────────────────────────────┤

Display       32px (700)  - Page title
Headline 1    28px (600)  - Main headers
Headline 2    24px (600)  - Section headers
Subtitle 1    20px (500)  - Subheadings
Subtitle 2    16px (500)  - Secondary headlines
Body 1        16px (400)  - Main body text, messages
Body 2        14px (400)  - Secondary text
Caption       12px (400)  - Helper text, timestamps
Overline      12px (600)  - Labels, badges
Button        14px (600)  - Button text
Code          12px (400)  - Monospace (Courier New)

Line Height:
- Display/Headline: 1.2
- Subtitle/Body:    1.5
- Caption:          1.4
```

### Font Weight Usage

```
300 - Light (rarely used)
400 - Regular (body text, default)
500 - Medium (secondary headlines, labels)
600 - Semibold (buttons, important text)
700 - Bold (main headlines, emphasis)
```

### Examples

```
App Title:           "SecureChat" - 28px / 600 / #2E5BBA
Page Header:         "Conversations" - 24px / 600 / #212121
Conversation Name:   "John Doe" - 16px / 600 / #212121
Message Text:        "Hey, how are you?" - 16px / 400 / #212121
Timestamp:           "2:34 PM" - 12px / 400 / #999999 (gray)
Button:              "Send Message" - 14px / 600 / #FFFFFF (white on blue)
Input Placeholder:   "Type a message..." - 14px / 400 / #BDBDBD (light gray)
```

---

## 5. Component Style Guide

### Buttons

#### Primary Button
```
Style:     Solid filled
Background: #2E5BBA (dark blue)
Text:       #FFFFFF (white, 600 weight)
Padding:    12px 24px (height: 44px minimum for mobile)
Border:     None
Border Radius: 8px
Shadow:     0 2px 8px rgba(46, 91, 186, 0.2)
Hover:      Background #1E3A8A (darker blue)
Active:     Background #0F2151 (even darker)
Disabled:   Background #BDBDBD, Text #757575, Cursor not-allowed
```

#### Secondary Button
```
Style:      Outlined
Background:  Transparent
Border:      2px solid #2E5BBA
Text:        #2E5BBA (600 weight)
Padding:     12px 24px
Border Radius: 8px
Hover:       Background #F5F5F5 (light gray)
Active:      Background #EEEEEE
Disabled:    Border #BDBDBD, Text #BDBDBD
```

#### Ghost Button (Light)
```
Style:      No background
Background: Transparent
Text:       #2E5BBA (500 weight)
Padding:    8px 16px
Border:     None
Hover:      Background #F5F5F5
Disabled:   Text #BDBDBD
```

#### Icon Button
```
Style:      Circular or square
Size:       44px × 44px (mobile touch target)
Icon:       24px icon centered
Background: Transparent by default
Hover:      Background #F5F5F5 (light gray)
Active:     Background #EEEEEE
Color:      #212121 (dark text) or #FFFFFF (light on dark)
```

#### Call Button (Special)
```
Primary (Audio Call):
Background: #FF9800 (orange)
Text:       #FFFFFF
Size:       44px × 44px circle
Icon:       Phone icon (24px)
Hover:      #E68900 (darker orange)

End Call:
Background: #F44336 (red)
Text:       #FFFFFF
Size:       60px × 60px circle
Icon:       Phone with slash
Hover:      #D32F2F (darker red)
```

### Input Fields

#### Text Input / Textarea

```
Style:       Outlined border
Background:  #F9F9F9 (light gray on light mode)
              #2C2C2C (dark on dark mode)
Border:      1px solid #E0E0E0 (light mode)
              1px solid #373737 (dark mode)
Border Radius: 8px
Padding:     12px 16px
Height:      44px (minimum for mobile)
Text:        #212121 (dark text)
Placeholder: #BDBDBD (light gray)

Focus State:
Border:      2px solid #2E5BBA (blue highlight)
Shadow:      0 0 0 4px rgba(46, 91, 186, 0.1)
Outline:     None

Error State:
Border:      2px solid #F44336 (red)
Error Text:  12px / #F44336 / below input
```

#### Search Input

```
Background: #EEEEEE (light gray) on white
Placeholder: "Search users..." - #BDBDBD
Icon:       Search icon (left side)
Clear Icon: X button (right side, on hover/focus)
Padding:    8px 12px left, 8px 40px right (for icon)
```

#### Message Input

```
Background:  #FFFFFF (white on light) / #2C2C2C (dark)
Border:      1px solid #E0E0E0
Border Radius: 24px (pill shape)
Padding:     12px 16px
Min Height:  44px
Max Height:  120px (with scroll)
Placeholder: "Type a message..."
Right Icon:  Send button
Left Icon:   Emoji/Attachment (future)
Resize:      None (auto-grow)

Focus:
Shadow:      0 2px 8px rgba(46, 91, 186, 0.15)
Border:      1px solid #2E5BBA
```

### Cards & Containers

#### Message Bubble (Sent)

```
Background:  #2E5BBA (blue)
Text:        #FFFFFF (white)
Border Radius: 16px (with sharp corner on bottom-right)
Padding:     12px 16px
Max Width:   70% of screen
Shadow:      0 1px 3px rgba(0, 0, 0, 0.12)
Timestamp:   12px / gray / below bubble
Read Receipt: Double checkmark icon (gray) next to timestamp

Hover:       Slightly darker blue #1E3A8A
```

#### Message Bubble (Received)

```
Background:  #EEEEEE (light gray)
Text:        #212121 (dark gray)
Border Radius: 16px (with sharp corner on bottom-left)
Padding:     12px 16px
Max Width:   70% of screen
Shadow:      0 1px 3px rgba(0, 0, 0, 0.08)
Timestamp:   12px / gray / below bubble
```

#### Conversation Card (in list)

```
Background:  #FFFFFF (white) / #1E1E1E (dark)
Padding:     12px 16px
Border Bottom: 1px solid #EEEEEE / #2C2C2C
Border Radius: 0
Height:      ~64px (minimum)

Layout:
├─ Left: Avatar (40px circle)
├─ Center: Name (16px/600) + Last message preview (14px/400)
└─ Right: Timestamp (12px/gray)

Hover:      Background #F5F5F5 / #2C2C2C (darker)
Active:     Background #EEEEEE / #373737 (even darker)
Selected:   Left border 4px solid #2E5BBA

Unread Badge:
├─ Blue circle (8px)
├─ Position: Top-right of avatar
└─ Unread count inside (12px white text)
```

#### Group Avatar

```
Size:        40px (conversations list)
             80px (group info)
             120px (group creation modal)
Border Radius: 12px (rounded square, not circle)
Background:  Gradient color based on group name hash
Icon:        Group people icon (center)
Fallback:    First 2 letters of group name
```

### Modals & Dialogs

#### Modal Structure

```
┌──────────────────────────────────┐
│  Title              [✕] Close    │
├──────────────────────────────────┤
│                                  │
│  Content Area                    │
│  (scrollable if needed)          │
│                                  │
├──────────────────────────────────┤
│  [Cancel]  [Action Button]       │
└──────────────────────────────────┘

Backdrop:      rgba(0, 0, 0, 0.5) (semi-transparent black)
Modal Width:   90% on mobile, max 500px on desktop
Border Radius: 16px
Shadow:        0 8px 32px rgba(0, 0, 0, 0.2)
Animation:     Fade in + scale (0.95 → 1.0) over 200ms
Close Icon:    24px, top-right corner, clickable
```

#### UID/QR Code Modal

```
Trigger: Click "Show QR" on profile or "My UID"
Title: "Your Secure ID"

Layout (Vertical):
┌──────────────────────────────────┐
│  Your Secure ID        [✕] Close │
├──────────────────────────────────┤
│                                  │
│  [QR Code Image - 300x300px]    │
│  (centered, light gray background)
│                                  │
│  SEC_8f7d6e5c4b3a2910            │
│  (monospace, centered, copyable) │
│                                  │
│  [Copy UID] [Download QR]        │
└──────────────────────────────────┘

QR Code:
├─ Size: 300x300px (or responsive)
├─ Background: #FFFFFF (white)
├─ Pattern: #212121 (dark)
├─ Quiet zone: 20px white border
└─ Data encoded: "securechat://uid/SEC_..."

UID Display:
├─ Font: Monospace (Courier New)
├─ Size: 16px
├─ Weight: 600 (bold)
├─ Color: #2E5BBA (blue)
├─ Selectable: Yes
└─ Copyable: Yes

Buttons:
├─ [📋 Copy UID]
│  ├─ Style: Secondary button
│  ├─ Onclick: Copy to clipboard
│  ├─ Toast: "UID copied!"
│  └─ Icon: 📋
│
└─ [⬇️ Download QR]
   ├─ Style: Primary button (blue)
   ├─ Onclick: Download as PNG
   ├─ Filename: "my_uid.png"
   └─ Icon: ⬇️
```

#### Add Contact Modal

```
Trigger: Click "Add Contact" or "+" button in Contacts
Title: "Add Contact"

Layout (Two Tabs):
┌──────────────────────────────────┐
│  Add Contact          [✕] Close  │
├──────────────────────────────────┤
│  [📱 Scan QR] [🔐 Enter UID]     │ ← Tabs
├──────────────────────────────────┤
│                                  │
│  Tab Content Area                │
│                                  │
└──────────────────────────────────┘

Tab 1: Scan QR
├─ Camera feed (centered)
├─ Height: 400px
├─ Border: 2px solid #2E5BBA
├─ Border Radius: 12px
├─ Loading state: Spinner
└─ On scan success: Show user profile preview

Tab 2: Enter UID
├─ Text input field
│  ├─ Placeholder: "SEC_xxxxxxxxxx"
│  ├─ Font: Monospace
│  ├─ Size: 16px
│  ├─ Height: 44px
│  └─ Validation: Real-time check
├─ Help text: "16-character code from user's profile"
└─ Submit button: [Add Contact]

User Preview (appears after UID lookup):
┌──────────────────────────────────┐
│  User Found                      │
├──────────────────────────────────┤
│                                  │
│       [Avatar - 80px]            │
│                                  │
│     Display Name                 │
│     ● Online  / Last seen 2h ago │
│                                  │
│  [Add Contact]  [Cancel]         │
└──────────────────────────────────┘

Error State:
├─ Background: #FFF3E0 (light orange)
├─ Border: 2px solid #FF9800 (warning)
├─ Text: "UID not found" or "Invalid format"
├─ Color: #E65100 (dark orange)
└─ Icon: ⚠️
```

#### Toast Notification

```
Style:       Minimal, appears at top-center
Background:  #212121 (dark) / varies by type
Text:        #FFFFFF (white)
Padding:     12px 16px
Border Radius: 8px
Shadow:      0 4px 12px rgba(0, 0, 0, 0.15)
Animation:   Slide down from top, fade out
Duration:    3-5 seconds (auto-dismiss)

Type: Success (green)
├─ Icon: ✓ checkmark
├─ Text: "Message sent" / "Profile updated"
└─ Background: #4CAF50

Type: Error (red)
├─ Icon: ✕ X
├─ Text: "Failed to send" / "Error"
└─ Background: #F44336

Type: Info (blue)
├─ Icon: ℹ info
├─ Text: "User is typing..."
└─ Background: #2E5BBA

Type: Warning (orange)
├─ Icon: ⚠ warning
├─ Text: "Connection lost"
└─ Background: #FF9800
```

### Avatar & User Indicators

#### User Avatar

```
Size (various):
├─ 32px  - in message thread, small lists
├─ 40px  - conversation list
├─ 48px  - chat header
├─ 80px  - profile modal
└─ 120px - full profile page

Style:
├─ Border Radius: 50% (circle)
├─ Border: None
├─ Fallback: First letter of name, colored background
└─ Image: Cover (crop to fill)

Online Indicator (green dot):
├─ Size: 12px circle
├─ Position: Bottom-right corner
├─ Background: #4CAF50 (green) / #FFC107 (yellow) / #BDBDBD (gray)
└─ Border: 2px white border
```

---

## 6. Layout & Spacing

### Spacing Scale (8px base unit)

```
┌────────────────────────────────┐
│      SPACING SCALE (8px)       │
├────────────────────────────────┤

0px   - No space
4px   - xs (minimal gap)
8px   - sm (small gap)
12px  - md (medium gap)
16px  - lg (large gap)
24px  - xl (extra large)
32px  - xxl (huge gap)
48px  - 3xl (massive)
64px  - 4xl (section gap)

Common Usage:
├─ Padding inside buttons: 12px 24px
├─ Padding inside cards: 16px
├─ Gap between list items: 0 (borders instead)
├─ Gap between sections: 24px
├─ Gap between components: 12-16px
└─ Margins on page: 16px (mobile), 24px (desktop)
```

### Grid & Layout

#### Web Desktop Layout

```
┌─────────────────────────────────────────────────┐
│              HEADER (Navigation)                │
├─────────────┬─────────────────────────────────┤
│             │                                  │
│  SIDEBAR    │        MAIN CONTENT AREA        │
│  (260px)    │        (flex, 1fr)              │
│             │                                  │
│             │  ┌────────────────────────────┐ │
│             │  │  Conversation Area         │ │
│             │  │  (chat messages)           │ │
│             │  └────────────────────────────┘ │
│             │  ┌────────────────────────────┐ │
│             │  │  Message Input Area        │ │
│             │  └────────────────────────────┘ │
│             │                                  │
└─────────────┴─────────────────────────────────┘
```

#### Mobile Layout

```
┌─────────────────────────────────┐
│  [☰] Title        [⚙️]          │ (Header - 56px)
├─────────────────────────────────┤
│                                  │
│   MAIN CONTENT (Full Width)     │
│   (Messages / Contacts / etc)   │
│                                  │
├─────────────────────────────────┤
│  [Chats] [Contacts] [Settings]  │ (Bottom Nav - 56px)
└─────────────────────────────────┘

Sidebar:
├─ Collapses into hamburger menu (top-left)
├─ Slide-out drawer overlay when opened
└─ Full width minus 16px on each side
```

### Responsive Breakpoints

```
Mobile:        0px - 480px   (iPhone 5 - iPhone 11)
Tablet Small:  481px - 768px (iPad Small)
Tablet Large:  769px - 1024px (iPad Large)
Desktop:       1025px+       (Desktop & larger)

Media Query Examples:
├─ @media (max-width: 480px)  { /* mobile styles */ }
├─ @media (min-width: 481px) and (max-width: 768px) { /* tablet */ }
└─ @media (min-width: 1025px) { /* desktop */ }
```

---

## 7. Visual Patterns

### Encryption Badge

```
Where: Every conversation name (header & list)
Style:
├─ Icon: 🔒 lock
├─ Label: "Encrypted" or just 🔒
├─ Color: #4ECDC4 (teal - trust color)
├─ Size: 16px icon + 12px text
├─ Tooltip: "This chat is end-to-end encrypted"
└─ Position: Right of conversation name

Example: "John Doe 🔒 Encrypted"
```

### Read Receipts

```
Single Checkmark (✓):
├─ Gray color (#BDBDBD)
├─ Meaning: "Message sent to server"
├─ Position: Right of message timestamp

Double Checkmark (✓✓):
├─ Teal color (#4ECDC4)
├─ Meaning: "Message read by recipient"
├─ Position: Right of message timestamp
```

### Typing Indicator

```
Style:   "User A is typing" + animated dots
Animation: ● ● ● → fading dot animation
Duration: 500ms per dot (staggered)
Color:    #4A90E2 (blue)
Size:     14px text + 8px dots
Position: Below last message, left-aligned
Disappears when:
├─ User sends message
├─ User stops typing (2-3 second delay)
└─ After 5 minutes (timeout)
```

### Online Status Indicators

```
In Conversation Header:
├─ Green dot (8px) + "Online" text
├─ Yellow dot (8px) + "Away" text
└─ Gray dot (8px) + "Last seen 2h ago" text

In Conversation List:
├─ Small green dot (top-right of avatar)
└─ Only shown for online users

In User Profile:
├─ Large indicator
├─ Green dot + "Online"
└─ Or "Last seen [timestamp]"
```

### Empty States

```
Illustration:
├─ Soft colors (not harsh)
├─ 200x200px (or 300x300px on desktop)
├─ Consistent art style
└─ Not overly cute (professional)

Heading:
├─ 20px / 600 weight
├─ Primary color (#2E5BBA)
└─ "No conversations yet"

Subtext:
├─ 16px / 400 weight
├─ Secondary color (#757575)
└─ "Search for a user to start chatting"

CTA Button:
├─ Primary blue button
└─ "Start a Chat"
```

### Error States

```
Input Error:
├─ Red border: 2px solid #F44336
├─ Error message: 12px / #F44336 / below input
└─ Icon: ⚠️ warning icon

Message Error:
├─ Red border around message bubble
├─ ⚠️ icon overlay on message
├─ Tooltip: "Failed to send. Tap to retry"
└─ On hover: "Retry" link appears

Network Error Banner:
├─ Red background: #F44336
├─ White text
├─ Icon: ⚠️
├─ Message: "No internet connection"
├─ Position: Top of screen, sticky
└─ Auto-dismiss when connection restored
```

### Loading States

```
Spinner:
├─ Style: Circular progress ring
├─ Color: #2E5BBA (primary blue)
├─ Size: 24px for small, 40px for large
├─ Animation: 1 second rotation
└─ Speed: Linear, continuous

Skeleton Loader:
├─ Shape: Rounded rectangle (matches content)
├─ Color: #EEEEEE (light gray)
├─ Animation: Shimmer effect (subtle)
└─ Used for: Conversation list, messages, user list

Progress Bar:
├─ Height: 4px
├─ Color: #2E5BBA
├─ Position: Top of screen or upload area
├─ Animation: Smooth width increase
└─ Duration: Varies by action
```

---

## 8. Animations & Transitions

### Timing Functions

```
CSS Easing Functions:
├─ ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94)  (most common)
├─ ease-in-out: cubic-bezier(0.42, 0, 0.58, 1)      (for modals)
├─ ease-in: cubic-bezier(0.42, 0, 1, 1)            (rarely used)
└─ linear: (constant speed, for spinners)

Standard Durations:
├─ Fast:    100-200ms (hover, icons)
├─ Normal:  300-400ms (transitions, fades)
├─ Slow:    500-800ms (page transitions)
└─ Extra:   1000ms+ (long introductions)
```

### Common Animations

#### Message Slide In
```
Animation: slideInFromBottom
Duration:  300ms
Easing:    ease-out
From:      translateY(20px) + opacity(0)
To:        translateY(0) + opacity(1)
```

#### Button Hover
```
Animation: background change + scale
Duration:  200ms
Easing:    ease-out
Transform: scale(1.02) on hover
```

#### Modal Appearance
```
Animation: fade + scale
Duration:  300ms
Easing:    cubic-bezier(0.34, 1.56, 0.64, 1)
From:      opacity(0) + scale(0.95)
To:        opacity(1) + scale(1)
```

#### Typing Indicator
```
Animation: dot fade in-out
Duration:  1.4s
Loop:      infinite
Each Dot:  Staggered delay (0ms, 300ms, 600ms)
From:      opacity(0.4)
To:        opacity(1)
```

#### Page Transition
```
Animation: fade
Duration:  300ms
Direction: Fade out old → Fade in new
```

---

## 9. Dark Mode

### Dark Mode Strategy

**Implementation:**
- Default to dark mode (privacy-conscious users prefer it)
- Toggle in settings to light mode
- Respect system preference (media query)
- Store user preference in localStorage

**CSS Variable Usage:**
```css
/* Define colors as CSS variables */
:root {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F5;
  --text-primary: #212121;
  --color-blue: #2E5BBA;
}

[data-theme="dark"] {
  --bg-primary: #121212;
  --bg-secondary: #1E1E1E;
  --text-primary: #FFFFFF;
  --color-blue: #4A90E2;
}

/* Usage in components */
.card {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

**Dark Mode Adjustments:**
- Darken images (95% opacity overlay)
- Reduce shadows (harder to see on dark)
- Increase text contrast
- Adjust badge colors for visibility

---

## 10. Accessibility (A11y)

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Text on background: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- UI components: 3:1 minimum

**Example:**
```
✓ White (#FFFFFF) on blue (#2E5BBA): 8.59:1 (excellent)
✓ Dark (#212121) on light gray (#F5F5F5): 12.6:1 (excellent)
✗ Light gray (#BDBDBD) on white: 2.1:1 (fail)
```

**Keyboard Navigation:**
- All interactive elements: Tab-able
- Visible focus indicator (blue outline)
- Focus order: Logical (left-to-right, top-to-bottom)
- No keyboard trap

**Screen Reader:**
- ARIA labels on icon-only buttons
- Form labels associated with inputs
- List semantics for conversations
- Landmark regions (nav, main, aside)

**Visual Accessibility:**
- Color not sole indicator (use icons/text too)
- Text size: Minimum 14px
- Line height: 1.5+ for body text
- Avoid blinking/flashing (seizure risk)

---

## 11. Mobile-Specific Design

### Touch Targets

```
Minimum button size:   44px × 44px (iOS) / 48px × 48px (Android)
Minimum spacing:       8px between touch targets
Thumb-friendly zones:  Bottom 50% of screen easiest to reach
Reachability:          Top of screen hard to tap (consider moving)
```

### Mobile Optimizations

```
Message Bubbles:
├─ Slightly larger padding (16px vs 12px)
├─ Larger fonts (16px body text for readability)
└─ Wider bubbles (60% screen width instead of 70%)

Bottom Navigation:
├─ Sticky tab bar at bottom (not top)
├─ Large touch targets (56px height)
├─ Icons + labels for clarity
└─ 5 tabs maximum

Modals:
├─ Full-screen on mobile (easier to interact)
├─ Slide up from bottom (iOS style)
├─ Safe area insets (notch compatibility)
└─ Close button at top
```

### Notch Compatibility

```
/* Tailwind: Adjust for notch */
padding-top: max(16px, env(safe-area-inset-top));
padding-bottom: max(16px, env(safe-area-inset-bottom));
padding-left: max(16px, env(safe-area-inset-left));
padding-right: max(16px, env(safe-area-inset-right));
```

---

## 12. Visual Consistency

### Icon System

**Icon Source:** Feather Icons or Material Design Icons (24px)

**Icons Used:**
```
Navigation:
├─ Home / Chat: 💬 message-circle
├─ Contacts: 👥 users
├─ Profile: 👤 user
└─ Settings: ⚙️ settings

Actions:
├─ Send: ➤ send / 📤 share
├─ Attach: 📎 paperclip (future)
├─ Search: 🔍 search
├─ Edit: ✏️ edit
├─ Delete: 🗑️ trash
├─ More: ⋮ more-vertical
└─ Close: ✕ x

Communication:
├─ Audio call: 📞 phone
├─ Video call: 📹 video
├─ Mute: 🔇 volume-mute
├─ Unmute: 🔊 volume-2
└─ Typing: ✦ typing (custom)

Status:
├─ Online: ● (solid green)
├─ Away: ● (solid yellow)
├─ Offline: ● (solid gray)
├─ Encrypted: 🔒 lock
├─ Verified: ✓ check (future)
└─ Error: ⚠️ alert-circle
```

**Icon Styling:**
- Size: 24px (standard)
- Weight: 2px stroke
- Color: Inherit from text color (usually)
- Alignment: Vertically centered

### Image & Media

**Avatar Images:**
- Square images: Crop to fill (object-fit: cover)
- Allow user to upload or use Google image
- Placeholder: First letter on colored background

**Message Images:**
- Future feature (not MVP)
- Max width: 100% of message bubble
- Border radius: 8px
- Aspect ratio: Preserve original

---

## 13. Design Tokens (CSS Variables)

### Implementation Example

```css
/* Colors */
--color-primary: #2E5BBA;
--color-primary-dark: #1E3A8A;
--color-secondary: #4ECDC4;
--color-success: #4CAF50;
--color-error: #F44336;
--color-warning: #FFC107;

--color-text-primary: #212121;
--color-text-secondary: #757575;
--color-bg-primary: #FFFFFF;
--color-bg-secondary: #F5F5F5;

/* Typography */
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
--font-size-sm: 12px;
--font-size-md: 14px;
--font-size-lg: 16px;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-bold: 600;

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;

/* Borders */
--border-radius-sm: 8px;
--border-radius-md: 12px;
--border-radius-lg: 16px;
--border-radius-full: 50%;

/* Shadows */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.2);

/* Transitions */
--transition-fast: 200ms ease-out;
--transition-normal: 300ms ease-out;
--transition-slow: 500ms ease-out;
```

---

## 14. Visual Hierarchy

### Content Priority

```
1. Message Content (primary focus)
   └─ Large, clear, easy to read

2. User Names & Avatars
   └─ Who sent the message?

3. Timestamps & Status
   └─ When was it sent? Read?

4. UI Controls (buttons, icons)
   └─ Always available but not distracting

5. Metadata (connection status, etc)
   └─ Least important, subtle styling
```

### Size & Prominence

```
Large (≥20px):
├─ User names
├─ Conversation titles
└─ Primary CTAs (buttons)

Medium (16-18px):
├─ Message body text
├─ Secondary labels
└─ Input text

Small (12-14px):
├─ Timestamps
├─ Helper text
├─ Badges
└─ Status indicators

Tiny (10-12px):
├─ Captions
├─ Code/monospace text
└─ Metadata
```

---

## 15. Open Design Questions

**Decisions to Make:**
1. Should profile pictures be circles or rounded squares?
   - Recommended: Circles (users expect this in chat apps)

2. Should message timestamps always show or only on hover?
   - Recommended: On hover (cleaner interface, timestamps still accessible)

3. Should online status be always visible?
   - Recommended: Only for active conversation header (less visual clutter)

4. Should dark mode be default or follow system preference?
   - Recommended: Default to dark mode (privacy-conscious users)

5. Should notifications have sounds?
   - Recommended: Optional toggle in settings

6. How many previous messages to load initially?
   - Recommended: Load last 20 messages, paginate backwards

7. Should deleted messages show placeholder or disappear?
   - Recommended: Show "This message was deleted" placeholder (context)

---

## 16. Testing & Validation

**Design Testing:**
- ✓ Test on iPhone 12 (375px width)
- ✓ Test on iPad Pro (1024px width)
- ✓ Test on desktop (1440px width)
- ✓ Test dark mode on all screens
- ✓ Test with screen reader (VoiceOver/NVDA)
- ✓ Test keyboard navigation (Tab, Enter)
- ✓ Test on 4G network (latency, loading states)
- ✓ Test on slow devices (animations performance)

---

## 17. Design Deliverables Checklist

For AI code generation, ensure:
- ✅ All colors defined as CSS variables
- ✅ Typography scale clearly defined
- ✅ Component dimensions specified (padding, margins)
- ✅ Animation timings provided
- ✅ Responsive breakpoints set
- ✅ Dark mode CSS defined
- ✅ Accessibility requirements listed
- ✅ Mobile design optimizations noted
- ✅ Icon references provided
- ✅ Spacing scale consistent (8px)

This design brief is comprehensive enough for an AI to build the UI without additional design specs.
