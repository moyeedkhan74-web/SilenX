import { API_URL } from '../config/webrtc-config';
import type { UserStatus } from '../types';

export interface GoogleAuthResponse {
  user: {
    id: string;
    uid: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    status: UserStatus;
    lastSeen?: string;
    bio?: string;
    showOnlineStatus?: boolean;
  };
}

export async function authenticateWithGoogleBackend(
  idToken: string,
  onStatusUpdate?: (msg: string) => void
): Promise<GoogleAuthResponse> {
  const maxRetries = 5;
  const retryDelayMs = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      // Try reading response JSON first
      const bodyText = await resp.text();
      let body: any = {};
      try {
        body = JSON.parse(bodyText);
      } catch {
        // Response is non-JSON (e.g. Render HTML gateway 503 cold start page)
      }

      if (resp.ok) {
        return body as GoogleAuthResponse;
      }

      // If backend returned a JSON error message (e.g. missing credentials or invalid token), DO NOT RETRY
      if (body && body.message) {
        throw new Error(body.message);
      }

      // If status is 503/502/504 and body was HTML (Render proxy cold start page), retry
      if (resp.status === 503 || resp.status === 502 || resp.status === 504) {
        if (attempt < maxRetries) {
          if (onStatusUpdate) {
            onStatusUpdate('Connecting securely...');
          }
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
      }

      throw new Error(`Backend authentication failed (HTTP ${resp.status})`);
    } catch (err: any) {
      // If it's a known error message from JSON response, rethrow immediately
      if (err.message && !err.message.includes('fetch') && !err.message.includes('HTTP 503')) {
        throw err;
      }

      console.warn(`[AuthAPI] Attempt ${attempt} failed:`, err?.message || err);
      if (attempt < maxRetries) {
        if (onStatusUpdate) {
          onStatusUpdate('Connecting securely...');
        }
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Unable to connect to backend server. Please try again.');
}