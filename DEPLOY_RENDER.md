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
5. Scroll down and click **Advanced** to add **Environment Variables**:
   - `PORT` = `3000`
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://silen-x.vercel.app` *(Replace with your exact Vercel frontend URL)*
6. Click **Create Web Service**.
7. Once deployed, Render will provide a public URL at the top left of the console (e.g. `https://slienx-backend-xxxx.onrender.com`). **Copy this URL**.

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
