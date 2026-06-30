const B2_API_URL = import.meta.env.VITE_B2_API_URL || '';
const B2_KEY_ID = import.meta.env.VITE_B2_KEY_ID || '';
const B2_APP_KEY = import.meta.env.VITE_B2_APP_KEY || '';
const B2_BUCKET_ID = import.meta.env.VITE_B2_BUCKET_ID || '';
const B2_BUCKET_NAME = import.meta.env.VITE_B2_BUCKET_NAME || '';

export interface BackblazeUploadResult {
  fileName: string;
  url: string;
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
  if (!B2_API_URL || !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID) {
    throw new Error('Backblaze storage is not configured');
  }

  const { uploadUrl, authToken } = await b2Authorize();
  const fileName = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backblaze upload failed: ${errorText}`);
  }

  await response.json();
  const publicUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${fileName}`;

  return {
    fileName,
    url: publicUrl,
  };
}
