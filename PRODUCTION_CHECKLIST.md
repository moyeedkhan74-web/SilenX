# SilenX Production Pre-Launch Checklist 🚀

## 1. Cloud Provider Environment Variables

### A. Voroa Primary Backend (`https://silenx-service.getvoroa.com`)
- [ ] `NODE_ENV`: `production`
- [ ] `PORT`: `5000`
- [ ] `MONGO_URI`: `mongodb+srv://...`
- [ ] `JWT_SECRET`: `<your_shared_jwt_secret>`
- [ ] `UPSTASH_REDIS_REST_URL`: `https://...upstash.io`
- [ ] `UPSTASH_REDIS_REST_TOKEN`: `<your_upstash_token>`
- [ ] `IMAGEKIT_PUBLIC_KEY`: `public_IujRu9A06L5SrEXi0OvOaaozWuQ=`
- [ ] `IMAGEKIT_PRIVATE_KEY`: `private_3WVFgKPJXY8uLyJmNN8rezJoYx8=`
- [ ] `IMAGEKIT_URL_ENDPOINT`: `https://ik.imagekit.io/silenx`
- [ ] `FRONTEND_URL`: `https://silen-x.vercel.app`

### B. Render Backup Backend (`https://silenx.onrender.com`)
- [ ] `NODE_ENV`: `production`
- [ ] `PORT`: `5000`
- [ ] `MONGO_URI`: `mongodb+srv://...` (same database as Voroa)
- [ ] `JWT_SECRET`: `<your_shared_jwt_secret>` (same secret as Voroa)
- [ ] `UPSTASH_REDIS_REST_URL`: `https://...upstash.io` (same cache as Voroa)
- [ ] `UPSTASH_REDIS_REST_TOKEN`: `<your_upstash_token>`
- [ ] `IMAGEKIT_PUBLIC_KEY`: `public_IujRu9A06L5SrEXi0OvOaaozWuQ=`
- [ ] `IMAGEKIT_PRIVATE_KEY`: `private_3WVFgKPJXY8uLyJmNN8rezJoYx8=`
- [ ] `IMAGEKIT_URL_ENDPOINT`: `https://ik.imagekit.io/silenx`
- [ ] `FRONTEND_URL`: `https://silen-x.vercel.app`

### C. Vercel Frontend (`https://silen-x.vercel.app`)
- [ ] `VITE_API_URL`: `https://silenx-service.getvoroa.com`
- [ ] `VITE_SOCKET_URL`: `https://silenx-service.getvoroa.com`
- [ ] `VITE_IMAGEKIT_PUBLIC_KEY`: `public_IujRu9A06L5SrEXi0OvOaaozWuQ=`
- [ ] `VITE_IMAGEKIT_URL_ENDPOINT`: `https://ik.imagekit.io/silenx`

---

## 2. UptimeRobot Keep-Alive Monitors
- [ ] **Render Backup Health Monitor**:
  - URL: `https://silenx.onrender.com/health`
  - Interval: `Every 5 minutes`
- [ ] **Voroa Primary Health Monitor**:
  - URL: `https://silenx-service.getvoroa.com/health`
  - Interval: `Every 5 minutes`

---

## 3. End-to-End Functional Verification
- [ ] **Authentication**: Create account, sign in, verify JWT token persistence.
- [ ] **Real-time Messaging**: Send text messages over WebSockets across 2 accounts.
- [ ] **E2EE Encryption**: Verify payload encryption (SLX2 header) in DB/network logs.
- [ ] **Media Uploads**: Attach image/audio, verify ImageKit CDN URL format (`https://ik.imagekit.io/silenx/...`).
- [ ] **Failover Test**: Temporarily block Voroa, verify client auto-switches REST & Socket to `https://silenx.onrender.com`.
- [ ] **Call Quality**: Initiate WebRTC audio/video call using LiveKit SDK.

---

## 4. Automated Maintenance Loops
- [ ] **30-Day Message Pruning**: Daily cron job running on backends.
- [ ] **Redis Session TTL**: Auto-expire after 300s of inactivity.
- [ ] **Node Memory Guard**: `--max-old-space-size=380` configured on both backends.
