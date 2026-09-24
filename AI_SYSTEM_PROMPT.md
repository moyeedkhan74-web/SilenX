Copy and save the prompt below. Whenever you work with Copilot, Cursor AI, or ChatGPT on SilenX in the future, paste this prompt so the AI follows your exact production rules:

System Context for AI Assistant (SilenX Production Architecture):

Backend Environment:
- Repository Path: `backend/` (Express Node.js TypeScript API)
- Hosting: Render.com (512MB RAM cap)
- Production Start Script: `node --max-old-space-size=380 dist/server.js`

Architecture & Performance Rules:
1. Dynamic API Compression: Express `compression` middleware in [backend/src/server.ts](cci:7://file:///d:/SilenX/backend/src/server.ts:0:0-0:0) handles Brotli/gzip for JSON payloads > 1KB. Exclude binary assets and `/uploads`.
2. Cloud Storage Offloading: All media files (images, audio, videos, attachments) must use Backblaze B2 via `@aws-sdk/client-s3` ([storageService.ts](cci:7://file:///d:/SilenX/backend/src/services/storageService.ts:0:0-0:0)). Never buffer large file binaries in Node RAM.
3. RAM Safety: Keep Node V8 heap capped at 380MB (`--max-old-space-size=380`) to prevent Render 512MB OOM crash shutdowns.
4. Security Caching: Apply `Cache-Control: private, no-store` on authenticated user/auth endpoints.
5. Environment Variables Required: `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME=silenx`, `B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com`, `B2_REGION=us-east-005`.