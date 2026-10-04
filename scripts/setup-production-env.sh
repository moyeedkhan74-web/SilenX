#!/usr/bin/env bash
set -euo pipefail

echo "=== SilenX Production Environment Setup Helper ==="
echo ""
echo "This script prints the exact env vars to paste into Render and Vercel."
echo "It does NOT modify any remote dashboards."
echo ""

cat <<'EOF'
## Render Backend Environment Variables

Paste these into Render Dashboard → silenx-backend → Environment:

Required:
- NODE_ENV=production
- PORT=5000
- FRONTEND_URL=https://silen-x.vercel.app
- MONGO_URI= mongodb+srv://... (your MongoDB Atlas string)
- JWT_SECRET= (long random string)

Calls/Media:
- LIVEKIT_URL= https://your-project.livekit.cloud
- LIVEKIT_API_KEY= ...
- LIVEKIT_API_SECRET= ...
- IMAGEKIT_PUBLIC_KEY= ...
- IMAGEKIT_PRIVATE_KEY= ...
- IMAGEKIT_URL_ENDPOINT= https://ik.imagekit.io/your-id
- B2_ENDPOINT= https://s3.us-east-1.backblazeb2.com
- B2_REGION= us-east-1
- B2_KEY_ID= ...
- B2_APPLICATION_KEY= ...
- B2_BUCKET_NAME= silenx-media-uploads

Cache/Push:
- UPSTASH_REDIS_REST_URL= ...
- UPSTASH_REDIS_REST_TOKEN= ...
- VAPID_PUBLIC_KEY= ...
- VAPID_PRIVATE_KEY= ...
- VAPID_SUBJECT= mailto:notifications@slienx.app

EOF

echo ""
echo "## Vercel Frontend Environment Variables"
echo ""
echo "Paste these into Vercel Dashboard → silen-x → Settings → Environment Variables:"
echo ""
echo "- VITE_API_URL= https://slienx-backend-xxxx.onrender.com"
echo "- VITE_SOCKET_URL= https://slienx-backend-xxxx.onrender.com"
echo "- VITE_WEB_PUSH_VAPID_PUBLIC_KEY= ..."
echo ""

cat <<'EOF'
## ImageKit Key Rotation

1. Log into https://imagekit.io/dashboard
2. Go to Developer → API Keys / Authentication
3. Click "Regenerate" or create a new private key
4. Update the new values in Render dashboard:
   - IMAGEKIT_PUBLIC_KEY
   - IMAGEKIT_PRIVATE_KEY
5. Delete the old key from ImageKit dashboard

Note: The old private key was in this repo's git history. Rotating it on ImageKit's side invalidates the leaked copy.

EOF

echo ""
echo "Done. Follow the steps above in each dashboard, then run: npm run build"
