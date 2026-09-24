# ⚡ SilenX No-Credit-Card Production Architecture & Bandwidth Guide

> **Target Audience:** SilenX Developers, GitHub Copilot, Cursor AI, and LLM Agents.  
> **Status:** 100% Free Tier, No Credit Card Required Architecture.  
> **Objective:** Zero-cost deployment for SilenX (`frontend/` Vite React + `backend/` Express Node.js API + Object Storage) with maximum uptime and zero Render/Koyeb crashes.

---

## 1. 🏗️ SilenX No-Credit-Card Free Infrastructure Stack

```text
[ SilenX User Client ]
   │
   ├─── (1) React/Vite UI ──────────────────► Cloudflare Pages (Free, 0 Egress Fees, No CC)
   │                                           └─► Build Output: frontend/dist
   │
   ├─── (2) JSON REST APIs & WebSockets ────► Koyeb Free (Always-On) OR Render Free
   │                                           └─► MongoDB Atlas (512MB DB)
   │
   └─── (3) Media, APKs & Attachments ──────► Supabase Storage OR Backblaze B2
                                               └─► Direct Upload/Download (0 Bytes through Backend)
```

| Component | Target Hosting | Config / Path | Egress & Limits (No CC Required) |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | **Cloudflare Pages** | `frontend/dist` | **Unlimited Free Bandwidth**, 0 Cost, No CC |
| **Backend API** | **Koyeb Free** *(Recommended)* or **Render Free** | `backend/` | **Koyeb:** Always-on, 0 sleep. **Render:** 100GB/mo free, sleeps after 15m. |
| **Media Storage** | **Supabase Storage** or **Backblaze B2** | Direct Presigned URLs | **Supabase:** 1GB Free Storage + 2GB Egress (No CC). **B2:** 10GB Free Storage + 1GB/day Egress. |
| **Database** | **MongoDB Atlas** | `MONGO_URI` | 512 MB Free Tier |

---

## 2. 🚀 Deployment Configurations

### A. Frontend: Cloudflare Pages Setup
- **Framework Preset:** Vite / None
- **Build Command:** `npm install --prefix frontend && npm run build --prefix frontend`
- **Build Output Directory:** `frontend/dist`
- **Environment Variables:**
  - `VITE_API_URL`: `https://your-backend.koyeb.app` (or `https://silenx-backend.onrender.com`)

### B. Backend: Koyeb / Render Setup

#### Option 1: Koyeb Free Nano (Recommended — Always On, No Sleeping)
- **Deployment Type:** Web Service
- **Build Command:** `cd backend && npm install && npm run build`
- **Run Command:** `node --max-old-space-size=380 backend/dist/server.js`

#### Option 2: Render Free Service
- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node --max-old-space-size=380 dist/server.js`
*(If Root Directory is set to repo root `/`, use: `node --max-old-space-size=380 backend/dist/server.js`)*

---

## 3. 📦 Storage Architecture: Direct Presigned Flow

To ensure Render/Koyeb never crashes from Out-Of-Memory (OOM) errors during media uploads/downloads:

```text
Client ──► Backend API: Request Presigned Upload URL
Client ──► Supabase / B2 Storage: Upload File Directly (Presigned PUT)
Client ◄── Backend API: Save File Metadata & Return URL
Client ──► Supabase / B2 Storage: Download / Stream Media Directly
```

> ⚡ **Zero-Byte Rule:** 0 Bytes of media files pass through the Node.js backend. The Node server only transfers tiny JSON metadata (`< 1KB`).

---

## 4. 🛠️ Express Compression Middleware (`backend/src/server.ts`)

In `backend/src/server.ts`, configure Express `compression` for dynamic API responses:

```typescript
import compression from 'compression';
import { Request, Response } from 'express';

app.use(
  compression({
    threshold: 1024, // Only compress responses >= 1KB
    level: 6,        // Low CPU overhead
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression']) {
        return false;
      }

      const contentType = String(res.getHeader('Content-Type') || '');

      // Exclude binary media & pre-compressed formats
      if (
        req.path.startsWith('/uploads') ||
        /(image|video|audio|zip|pdf|font|octet-stream)/i.test(contentType)
      ) {
        return false;
      }

      return compression.filter(req, res);
    },
  })
);
```

---

## 5. 🎯 Granular Caching & Privacy Rules

| Service | Content Type | `Cache-Control` Header Policy |
| :--- | :--- | :--- |
| **Cloudflare Pages** | Static Vite JS/CSS Bundles | `public, max-age=31536000, immutable` |
| **Supabase / B2** | Public Avatars / Media Attachments | Handled by Storage bucket headers. |
| **Backend API** | Auth, Chat Messages, User APIs | `Cache-Control: private, no-store` |
| **Backend API** | Public Status / Health (`/health`) | `Cache-Control: public, max-age=60` |

---

## 6. 🤖 System Context Prompt for AI Copilot / Cursor

```text
System Context for AI Assistant:
We are deploying SilenX on a 100% Free, No-Credit-Card Stack:
- Frontend: Cloudflare Pages (Build: `npm install --prefix frontend && npm run build --prefix frontend`, Output: `frontend/dist`).
- Backend: Koyeb Free (No sleep) or Render Free (Root: `backend`, Start: `node --max-old-space-size=380 dist/server.js`).
- Storage: Supabase Storage / Backblaze B2 using direct presigned URLs (no media buffered in Node).
- Compression: Express `compression` in `backend/src/server.ts` for JSON >1KB.
- Cache: `private, no-store` on user/auth APIs; static assets cached on Cloudflare Pages.
```

---
*Tailored Specifically for SilenX Codebase Architecture.*
