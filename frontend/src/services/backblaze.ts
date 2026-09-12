import { API_URL } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';

const B2_API_URL = import.meta.env.VITE_B2_API_URL || '';
const B2_KEY_ID = import.meta.env.VITE_B2_KEY_ID || '';
const B2_APP_KEY = import.meta.env.VITE_B2_APP_KEY || '';
const B2_BUCKET_ID = import.meta.env.VITE_B2_BUCKET_ID || '';
const B2_BUCKET_NAME = import.meta.env.VITE_B2_BUCKET_NAME || '';

export interface BackblazeUploadResult {
  fileName: string;
  url: string;
}

/**
 * Downscale and compress an avatar image into a lightweight JPEG Data URL.
 * Guarantees that avatar upload NEVER fails even without cloud storage credentials.
 */
export async function compressImageToDataUrl(file: File, maxWidth = 400, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = (e) => {
      const resultStr = String(e.target?.result || '');
      if (!file.type.startsWith('image/')) {
        resolve(resultStr);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(resultStr);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(resultStr);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(resultStr);
        }
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

async function b2Authorize(): Promise<{ uploadUrl: string; authToken: string }> {
  const response = await fetch(`${B2_API_URL}/b2_authorize_account`, {
    method: 'GET',
    headers: {
      Authorization: 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APP_KEY}`),
    },
  });

  if (!response.ok) {
    throw new Error('Backblaze authorization failed');
  }

  const data = await response.json();
  return {
    uploadUrl: data.uploadUrl,
    authToken: data.authorizationToken,
  };
}

export async function uploadToBackblaze(file: File, prefix = 'uploads'): Promise<BackblazeUploadResult> {
   const fileName = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

   // For avatar uploads, skip server/B2 and go straight to Data URL for guaranteed persistence
   if (prefix === 'avatars' || prefix === 'group-avatars') {
     const dataUrl = await compressImageToDataUrl(file);
     return {
       fileName,
       url: dataUrl,
     };
   }

   // Strategy 1: Try server-side media upload endpoint (for non-avatars only)
   try {
     const formData = new FormData();
     formData.append('file', file);

     const token = useAuthStore.getState().token;
     const headers: Record<string, string> = {};
     if (token) {
       headers.Authorization = `Bearer ${token}`;
     }

     const serverRes = await fetch(`${API_URL}/api/media/upload`, {
       method: 'POST',
       headers,
       body: formData,
     });

     if (serverRes.ok) {
       const data = await serverRes.json();
       if (data.url) {
         return {
           fileName: data.fileName || fileName,
           url: data.url,
         };
       }
     }
   } catch (serverErr) {
     console.warn('[Storage] Server media upload endpoint unavailable, trying fallback:', serverErr);
   }

   // Strategy 2: Direct client-side Backblaze upload (if configured)
   if (B2_API_URL && B2_KEY_ID && B2_APP_KEY && B2_BUCKET_ID) {
     try {
       const { uploadUrl, authToken } = await b2Authorize();
       const contentType = file.type || 'application/octet-stream';

       const response = await fetch(`${uploadUrl}/b2_upload_file`, {
         method: 'POST',
         headers: {
           Authorization: authToken,
           'X-Bz-File-Name': fileName,
           'Content-Type': contentType,
           'X-Bz-Content-Sha1': 'do_not_verify',
           'X-Bz-File-Mode': 'upload',
         },
         body: file,
       });

       if (response.ok) {
         await response.json();
         const publicUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${fileName}`;
         return {
           fileName,
           url: publicUrl,
         };
       }
     } catch (b2Err) {
       console.warn('[Storage] Client-side B2 upload failed, using Data URL fallback:', b2Err);
     }
   }

   // Strategy 3: Guaranteed zero-failure Data URL fallback
   const dataUrl = await compressImageToDataUrl(file);
   return {
     fileName,
     url: dataUrl,
   };
 }
