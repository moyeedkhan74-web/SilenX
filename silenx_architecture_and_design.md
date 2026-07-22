# SilenX Architecture & Design Overview

This document provides a brief overview of the structure and UI design of the **SilenX** web application. You can use this as a reference guide when making changes to the codebase.

## 🏗️ Technical Stack

- **Frontend:** React (TypeScript), Vite, Zustand (State Management), Socket.io-client
- **Backend:** Node.js, Express, Socket.io (for real-time messaging), Firebase Admin (for authentication)
- **Styling:** Vanilla CSS with custom CSS variables (Design Tokens)

## 📁 Folder Structure

### Frontend (`/frontend/src`)
- **`/components`**: Reusable UI components.
  - `ChatView.tsx`: Main chat interface, message rendering, input area.
  - `MessageInputBar.tsx`: The bottom bar for typing, recording voice notes, and sending attachments.
  - `Sidebar.tsx`, `ConversationList.tsx`: Navigation and chat lists.
- **`/store`**: Zustand stores for global state.
  - `chatStore.ts`: Manages conversations, messages, and real-time updates.
  - `authStore.ts`: Manages user authentication state and tokens.
- **`/services`**: External API and Socket connections.
  - `socket.ts`: Manages the WebSocket connection for real-time messaging.
- **`/pages`**: Top-level page views (e.g., `LoginPage.tsx`).

### Backend (`/backend/src`)
- **`/routes`**: Express REST API endpoints (`auth.ts`, `conversations.ts`).
- **`/websocket`**: Real-time Socket.io handlers (`handlers.ts`).
- **`/store`**: In-memory or database simulation logic (`db.ts`).
- **`server.ts`**: The main entry point for the backend server.

## 🎨 UI Design System & Aesthetics

SilenX uses a modern, premium design system featuring a sleek dark mode, glassmorphism elements, and vibrant accent colors. All design tokens are defined in `frontend/src/App.css`.

### Color Palette (Design Tokens)
- **Primary Accent:** Teal (`#0D9488`), changes to `#14B8A6` in dark mode.
- **Backgrounds:** 
  - Light mode: `#FAFAF9` (Main), `#FFFFFF` (Panels)
  - Dark mode: `#0F172A` (Main), `#131C2E` (Panels)
- **Text Colors:**
  - Light mode: `#1E293B` (Primary), `#64748B` (Secondary)
  - Dark mode: `#F1F5F9` (Primary), `#94A3B8` (Secondary)
- **Feedback Colors:**
  - Success: `#22C55E`
  - Error: `#EF4444`
  - Warning: `#F59E0B`

### Typography & Layout
- **Font:** Inter (or system sans-serif fallbacks).
- **Border Radius:** Uses soft, rounded corners (`8px`, `12px`, `16px`, up to fully rounded `9999px` for pills/avatars).
- **Shadows & Glassmorphism:** Heavy use of soft drop-shadows and semi-transparent backgrounds with backdrop filters for overlay elements.

## ⚙️ How to Make Changes

1. **Changing Styles:** Look for the corresponding `.css` file next to a component (e.g., `ChatView.css` for `ChatView.tsx`). To change global colors or themes, modify the CSS variables in `App.css`.
2. **Adding Components:** Create a new `.tsx` file in `frontend/src/components` and import it into `ChatView.tsx` or `App.tsx`.
3. **Modifying Real-Time Logic:** Update `backend/src/websocket/handlers.ts` for the server, and `frontend/src/services/socket.ts` for the client. Ensure `chatStore.ts` reflects any state updates.
