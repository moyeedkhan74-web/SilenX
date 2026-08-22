const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const protocol = typeof window !== 'undefined' ? window.location.protocol : '';

// Capacitor native apps run inside a WebView on Android/iOS
// where hostname is "localhost" but the protocol is NOT "http://localhost"
// from a networking standpoint — it can reach the internet.
export const isCapacitorNative = typeof window !== 'undefined' &&
  (protocol === 'capacitor:' ||
   protocol === 'ionic:' ||
   (hostname === 'localhost' && (window as any).Capacitor !== undefined) ||
   (window as any).Capacitor?.isNativePlatform?.() === true);

const isLocalhost = !isCapacitorNative && (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  hostname.endsWith('.local')
);

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const envSocketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

const FALLBACK_PRODUCTION_URL = 'https://silenx.onrender.com';

let defaultBackendUrl: string;
if (isCapacitorNative) {
  defaultBackendUrl = envApiUrl || FALLBACK_PRODUCTION_URL;
} else if (isLocalhost) {
  defaultBackendUrl = 'http://localhost:5000';
} else {
  defaultBackendUrl = envApiUrl || FALLBACK_PRODUCTION_URL;
}

export const API_URL: string = defaultBackendUrl;
export const SOCKET_URL: string = envSocketUrl || defaultBackendUrl;

if (!isLocalhost && !API_URL) {
   console.warn('[Config] VITE_API_URL is not set. API calls may fail in production.');
}
if (!isLocalhost && !SOCKET_URL) {
   console.warn('[Config] VITE_SOCKET_URL is not set. Socket connections may fail in production.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const normalizeUid = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.toUpperCase().startsWith('SEC_')) {
    return 'SEC_' + raw.slice(4);
  }
  return `SEC_${raw}`;
};