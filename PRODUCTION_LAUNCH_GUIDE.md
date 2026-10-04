# SilenX Production Launch Guide

This is the exact step-by-step guide to go from code-complete to live.

---

## Step 1: Render Backend Environment Variables

1. Open https://dashboard.render.com/
2. Select your `silenx-backend` service
3. Go to **Environment** tab
4. Add / update these variables:

### Required
- `NODE_ENV` = `production`
- `PORT` = `5000`
- `FRONTEND_URL` = `https://silen-x.vercel.app` (or your exact Vercel URL)
- `MONGO_URI` = your MongoDB Atlas connection string
- `JWT_SECRET` = long random string

### Calls / Media
- `LIVEKIT_URL` = `https://your-project.livekit.cloud`
- `LIVEKIT_API_KEY` = ...
- `LIVEKIT_API_SECRET` = ...
- `IMAGEKIT_PUBLIC_KEY` = ...
- `IMAGEKIT_PRIVATE_KEY` = ...
- `IMAGEKIT_URL_ENDPOINT` = `https://ik.imagekit.io/your-id`
- `B2_ENDPOINT` = `https://s3.us-east-1.backblazeb2.com`
- `B2_REGION` = `us-east-1`
- `B2_KEY_ID` = ...
- `B2_APPLICATION_KEY` = ...
- `B2_BUCKET_NAME` = `silenx-media-uploads`

### Cache / Push
- `UPSTASH_REDIS_REST_URL` = ...
- `UPSTASH_REDIS_REST_TOKEN` = ...
- `VAPID_PUBLIC_KEY` = generate with `npx web-push generate-vapid-keys`
- `VAPID_PRIVATE_KEY` = ...
- `VAPID_SUBJECT` = `mailto:notifications@slienx.app`

5. Click **Save Changes**
6. Render will rebuild and redeploy

---

## Step 2: Vercel Frontend Environment Variables

1. Open https://vercel.com/dashboard
2. Select your `silen-x` project
3. Go to **Settings** → **Environment Variables**
4. Add these for **Production**:

- `VITE_API_URL` = `https://slienx-backend-xxxx.onrender.com` (your Render URL)
- `VITE_SOCKET_URL` = `https://slienx-backend-xxxx.onrender.com` (same)
- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` = same value as Render `VAPID_PUBLIC_KEY`

5. Go to **Deployments**
6. Click the three dots next to the latest deployment → **Redeploy**

---

## Step 3: ImageKit Private Key Rotation

**Why**: The old private key was exposed in git history. Rotating it invalidates the leaked copy.

1. Log into https://imagekit.io/dashboard
2. Go to **Developer** → **API Keys** / **Authentication**
3. Find your current private key
4. Click **Regenerate** or **Create new key**
5. Copy the new `public_I...` and `private_...` values
6. Update Render environment variables:
   - `IMAGEKIT_PUBLIC_KEY` = new public key
   - `IMAGEKIT_PRIVATE_KEY` = new private key
7. Delete the old key from ImageKit dashboard
8. Trigger a new Render deploy to pick up the new values

---

## Step 4: UptimeRobot Monitors (Free Keep-Alive)

### Render
1. Go to https://uptimerobot.com/
2. Add New Monitor → HTTP(s)
3. Friendly Name: `slienx-backend-prod`
4. URL: `https://slienx-backend-xxxx.onrender.com/health`
5. Interval: 5 minutes
6. Create Monitor

### Voroa (if used)
1. Add New Monitor → HTTP(s)
2. Friendly Name: `slienx-voroa-prod`
3. URL: `https://silenx-service.getvoroa.com/health`
4. Interval: 5 minutes
5. Create Monitor

---

## Step 5: End-to-End Verification

After deploy, test these flows:

1. **Media upload**: Send a photo in chat → verify it appears in ImageKit dashboard
2. **Call**: Start a 1-on-1 call → verify LiveKit or P2P fallback works
3. **Push**: Close browser tab → send a message → verify browser push appears
4. **Offline**: Toggle airplane mode → send a message → verify it queues → go online → verify it sends

---

## Rollback

If anything breaks:

1. In Render, go to **Deploys** → select previous green deploy → **Rollback**
2. In Vercel, go to **Deployments** → select previous → **Promote to Production**
3. Old ImageKit key can be restored from ImageKit dashboard key history if needed
