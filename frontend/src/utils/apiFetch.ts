import { useAuthStore } from '../store/authStore';
import { auth } from '../config/firebase';
import { syncSocketToken } from './tokenSync';
import { getActiveBackendUrl, switchToBackupBackend, VOROA_PRIMARY_URL } from '../config/webrtc-config';

function resolveRequestUrl(input: RequestInfo | URL, targetBackend: string): RequestInfo | URL {
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const urlObj = new URL(input);
      const activeObj = new URL(targetBackend);
      urlObj.protocol = activeObj.protocol;
      urlObj.host = activeObj.host;
      return urlObj.toString();
    }
  }
  return input;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token = useAuthStore.getState().token;

  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(false);
      useAuthStore.getState().setToken(token);
      syncSocketToken(token);
    } catch (e) {
      console.warn('[apiFetch] Silent token update failed:', e);
    }
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const currentBackend = getActiveBackendUrl();
  const requestUrl = resolveRequestUrl(input, currentBackend);

  let response: Response;
  let primaryError: any = null;

  try {
    response = await fetch(requestUrl, { ...init, headers });
  } catch (netErr) {
    primaryError = netErr;
    response = new Response(null, { status: 503, statusText: 'Service Unavailable' });
  }

  // Handle 401 Unauthorized token refresh
  if (response.status === 401 && auth.currentUser) {
    console.info('[apiFetch] 401 Unauthorized encountered. Force-refreshing token...');
    try {
      const freshToken = await auth.currentUser.getIdToken(true);
      useAuthStore.getState().setToken(freshToken);
      syncSocketToken(freshToken);
      headers.set('Authorization', `Bearer ${freshToken}`);
      try {
        response = await fetch(requestUrl, { ...init, headers });
      } catch (retryErr) {
        primaryError = retryErr;
      }
    } catch (refreshError) {
      console.error('[apiFetch] Token force-refresh retry failed:', refreshError);
    }
  }

  // Failover Trigger: 5xx server errors, 429 rate limit/quota, or network errors
  const isFailoverNeeded = primaryError || response.status >= 500 || response.status === 429;
  if (isFailoverNeeded && currentBackend === VOROA_PRIMARY_URL) {
    const backupBackend = switchToBackupBackend();
    const backupRequestUrl = resolveRequestUrl(input, backupBackend);
    console.warn(`[apiFetch] Primary backend request failed (status ${response.status}). Retrying with HA Backup: ${backupBackend}`);
    try {
      response = await fetch(backupRequestUrl, { ...init, headers });
    } catch (backupErr) {
      console.error('[apiFetch] Backup backend fetch also failed:', backupErr);
    }
  }

  return response;
}