# SilenX Production Readiness Plan

Target: 100% production-safe launch with free-tier services.

## Blockers (must fix before launch)

### 1. Remove hardcoded ImageKit secrets from source
- File: `backend/src/services/storageService.ts`
- Change: remove fallback `public_...` / `private_...` defaults
- Behavior: if env vars are missing, ImageKit upload/auth must return null / skip instead of using a real secret

### 2. Harden render.yaml env coverage
- File: `render.yaml`
- Add missing production env vars:
  - `FRONTEND_URL`
  - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
  - `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`

### 3. Confirm Vercel SPA routing is valid
- File: `frontend/vercel.json`
- Status: `/api/negotiate` exists at `frontend/api/negotiate.ts`
- Action: keep rewrites, but add a fallback `404.html` and confirm edge runtime works

### 4. Fill frontend production env
- File: `frontend/.env.production`
- Add: `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`
- Keep: `VITE_API_URL`, `VITE_SOCKET_URL`

## Hardening (should fix soon)

### 5. Re-enable or constrain CSP
- File: `backend/src/server.ts`
- Current: `contentSecurityPolicy: false`
- Fix: enable CSP with explicit directives for the Vercel frontend origin, or keep disabled only if absolutely required

### 6. Tighten auth rate limit
- File: `backend/src/server.ts`
- Current: `5000 req / 15 min`
- Fix: lower to a sane production value or add per-IP/user adaptive limits

### 7. Add request logging / APM
- Add Morgan or similar for request logging
- Add Sentry or similar for error tracking

### 8. Rotate exposed ImageKit private key
- The current private key in `storageService.ts` is in repo history
- Rotate via ImageKit dashboard after removing hardcoded fallback

## Launch Checklist

- [ ] `backend/src/services/storageService.ts` has no hardcoded secrets
- [ ] `render.yaml` includes all required env vars
- [ ] `frontend/.env.production` has `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`
- [ ] **Render + Vercel dashboards have real production env vars** — see `scripts/setup-production-env.sh` and `PRODUCTION_LAUNCH_GUIDE.md`
- [ ] **ImageKit private key rotated** on ImageKit dashboard after deploy
- [ ] UptimeRobot monitors active for Render `/health` and Voroa `/health`
- [ ] End-to-end media upload test passes
- [ ] End-to-end call test passes

## Quick Reference

- Setup helper: `scripts/setup-production-env.sh`
- Launch guide: `PRODUCTION_LAUNCH_GUIDE.md`
- Deploy guide: `DEPLOY_RENDER.md`
- Env reference: `backend/.env.example`
