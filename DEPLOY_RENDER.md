# Deploying SlienX Backend on Render & Frontend on Vercel

Follow these steps to deploy your backend wrapper on Render (completely free and always-active using our keep-alive workaround) and integrate it with your Vercel frontend.

---

## Step 1: Push Current Changes to GitHub

Before deploying, make sure your GitHub repository has the updated `backend/Dockerfile` and config files:

1. Open a terminal in the project root (`d:\slienX`) and commit/push your changes:
    ```bash
    git add backend/Dockerfile backend/.env.example frontend/src/config/webrtc-config.ts
    git commit -m "Configure production Dockerfile and api fallback"
    git push origin main
    ```

---

## Step 2: Deploy the Backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com/) and log in with your GitHub account.
2. Click **New +** at the top right and select **Web Service**.
3. Under **Connect a repository**, select your `SilenX` repository.
4. Configure the service settings:
   - **Name**: `slienx-backend`
   - **Region**: Choose the one closest to you (e.g., Singapore, Oregon)
   - **Branch**: `main`
   - **Root Directory**: `backend` *(CRITICAL: This tells Render to only install and run inside the `/backend` directory)*
   - **Runtime**: `Docker` *(Render will automatically locate and use `/backend/Dockerfile`)*
   - **Instance Type**: Select **Free**
5. Scroll down and click **Advanced** to add **Environment Variables**.
6. Add the following environment variables:

### Required
   - `PORT` = `3000`
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://silen-x.vercel.app` *(Replace with your exact Vercel frontend URL)*
   - `MONGO_URI` = `mongodb+srv://...` *(Your MongoDB Atlas connection string)*
   - `JWT_SECRET` = `...` *(Long random string)*

### Calls / Media
   - `LIVEKIT_URL` = `https://your-project.livekit.cloud`
   - `LIVEKIT_API_KEY` = `...`
   - `LIVEKIT_API_SECRET` = `...`
   - `IMAGEKIT_PUBLIC_KEY` = `...`
   - `IMAGEKIT_PRIVATE_KEY` = `...`
   - `IMAGEKIT_URL_ENDPOINT` = `https://ik.imagekit.io/your-id`
   - `B2_ENDPOINT` = `https://s3.us-east-1.backblazeb2.com`
   - `B2_REGION` = `us-east-1`
   - `B2_KEY_ID` = `...`
   - `B2_APPLICATION_KEY` = `...`
   - `B2_BUCKET_NAME` = `silenx-media-uploads`

### Cache / Push
   - `UPSTASH_REDIS_REST_URL` = `https://...upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` = `...`
   - `VAPID_PUBLIC_KEY` = `...`
   - `VAPID_PRIVATE_KEY` = `...`
   - `VAPID_SUBJECT` = `mailto:notifications@slienx.app`

7. Click **Create Web Service**.
8. Once deployed, Render will provide a public URL at the top left of the console (e.g. `https://slienx-backend-xxxx.onrender.com`). **Copy this URL**.

---

## Step 3: Link Vercel to Your New Backend

1. Open your Vercel dashboard and go to your **silen-x** project.
2. Navigate to **Settings** → **Environment Variables**.
3. Add (or edit) the following environment variables:
   - `VITE_API_URL` = `https://slienx-backend-xxxx.onrender.com` *(Use your exact Render URL from Step 2)*
   - `VITE_SOCKET_URL` = `https://slienx-backend-xxxx.onrender.com` *(Same Render URL)*
4. Go to **Deployments**, click the three dots (`...`) next to your last deployment, and click **Redeploy** to apply the new environment variables.

---

## Step 4: Prevent Render Cold Starts (Free Kept-Alive Upgrade)

Render's free tier spins down (sleeps) if it doesn't receive any web requests for 15 minutes. To keep it always active and responsive:

1. Go to **[UptimeRobot](https://uptimerobot.com/)** and sign up for a free account (no credit card needed).
2. Click **Add New Monitor**.
3. Configure the monitor:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `slienx-backend-prod`
   - **URL (or IP)**: `https://slienx-backend-xxxx.onrender.com/health` *(Replace with your Render URL + `/health`)*
   - **Monitoring Interval**: `Every 5 minutes`
4. Click **Create Monitor**.

UptimeRobot will ping your backend every 5 minutes, preventing the container from sleeping, offering instant connections for your real-time chats!

---

## Step 5: Add UptimeRobot Monitor for Voroa

If you also run the Voroa backend wrapper, add a second monitor:

1. In UptimeRobot, click **Add New Monitor**.
2. Configure:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `slienx-voroa-prod`
   - **URL (or IP)**: `https://silenx-service.getvoroa.com/health`
   - **Monitoring Interval**: `Every 5 minutes`
3. Click **Create Monitor**.

---

## Step 6: Production Launch Checklist

- [ ] `MONGO_URI` points to MongoDB Atlas
- [ ] `JWT_SECRET` is set to a long random string
- [ ] `IMAGEKIT_*` env vars are set on Render
- [ ] `B2_*` env vars are set on Render
- [ ] `UPSTASH_REDIS_*` env vars are set on Render
- [ ] `LIVEKIT_*` env vars are set on Render
- [ ] `VAPID_*` keys are generated and set on Render + Vercel
- [ ] Vercel `VITE_API_URL` and `VITE_SOCKET_URL` point to Render
- [ ] UptimeRobot monitors are active for Render and Voroa
- [ ] End-to-end media upload test passes
- [ ] End-to-end call test passes

---

## Notes

- Media upload path: frontend -> backend -> ImageKit (primary) -> Backblaze B2/S3 (fallback) -> local disk (last resort)
- Redis is optional; if not configured, cache features degrade gracefully
- LiveKit is optional; if not configured, 1-on-1 calls fall back to P2P WebRTC, and group calls are unavailable
