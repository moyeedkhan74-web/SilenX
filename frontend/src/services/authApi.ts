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
  const maxRetries = 8;
  const baseDelayMs = 1000;

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

      // Rate limited (429), Render cold start (503/502/504) or other transient
      // gateway failures → retry with EXPONENTIAL backoff, honoring Retry-After.
      const retryable =
        resp.status === 429 ||
        resp.status === 503 ||
        resp.status === 502 ||
        resp.status === 504;

      if (retryable && attempt < maxRetries) {
        const retryAfterHeader = resp.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
        const backoffMs = Number.isFinite(retryAfterMs)
          ? Math.min(retryAfterMs, 30_000)
          : baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[AuthAPI] HTTP ${resp.status} — backing off ${Math.round(backoffMs)}ms (attempt ${attempt}/${maxRetries})`);
        if (onStatusUpdate) {
          onStatusUpdate(resp.status === 429 ? 'Server busy, retrying securely...' : 'Connecting securely...');
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      throw new Error(`Backend authentication failed (HTTP ${resp.status})`);
    } catch (err: any) {
      const msg: string = err?.message || '';
      // Known non-transient errors from the backend JSON body — rethrow immediately.
      const isTransient =
        msg.includes('fetch') ||
        /^Backend authentication failed \(HTTP (429|502|503|504)\)$/.test(msg);

      if (msg && !isTransient) {
        throw err;
      }

      console.warn(`[AuthAPI] Attempt ${attempt} failed:`, err?.message || err);
      if (attempt < maxRetries) {
        const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
        if (onStatusUpdate) {
          onStatusUpdate('Connecting securely...');
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Unable to connect to backend server. Please try again.');
}