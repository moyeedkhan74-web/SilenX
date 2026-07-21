import { API_URL } from '../config/webrtc-config';
import type { UserStatus } from '../types';

export interface GoogleAuthResponse {
  user: {
    id: string;
    uid: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    status: UserStatus;
    bio?: string;
  };
}

export async function authenticateWithGoogleBackend(
  idToken: string,
  onStatusUpdate?: (msg: string) => void
): Promise<GoogleAuthResponse> {
  const maxRetries = 8;
  const retryDelayMs = 4000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1 && onStatusUpdate) {
        onStatusUpdate(`Waking up secure backend server (attempt ${attempt}/${maxRetries})…`);
      }

      const resp = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      // Render cold starts return 503, 502, or 504 while container starts up
      if (resp.status === 503 || resp.status === 502 || resp.status === 504) {
        console.warn(`[AuthAPI] Backend returned ${resp.status}. Cold start retry ${attempt}/${maxRetries}...`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
      }

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.message || `Backend authentication failed (HTTP ${resp.status})`);
      }

      return await resp.json();
    } catch (err: any) {
      console.warn(`[AuthAPI] Attempt ${attempt} failed:`, err?.message || err);
      if (attempt < maxRetries && (err?.name === 'TypeError' || err?.message?.includes('fetch') || err?.message?.includes('503'))) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Server is warming up. Please try signing in again in a few seconds.');
}
