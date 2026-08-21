import { useAuthStore } from '../store/authStore';
import { auth } from '../config/firebase';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token = useAuthStore.getState().token;

  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(false);
      useAuthStore.getState().setToken(token);
    } catch (e) {
      console.warn('[apiFetch] Silent token update failed:', e);
    }
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && auth.currentUser) {
    console.info('[apiFetch] 401 Unauthorized encountered. Force-refreshing token...');
    try {
      const freshToken = await auth.currentUser.getIdToken(true);
      useAuthStore.getState().setToken(freshToken);
      headers.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(input, { ...init, headers });
    } catch (refreshError) {
      console.error('[apiFetch] Token force-refresh retry failed:', refreshError);
    }
  }

  return response;
}