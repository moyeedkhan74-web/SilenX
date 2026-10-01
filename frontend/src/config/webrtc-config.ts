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

export const VOROA_PRIMARY_URL = 'https://silenx-service.getvoroa.com';
export const RENDER_BACKUP_URL = 'https://silenx.onrender.com';

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const envSocketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

let defaultBackendUrl: string;
if (isCapacitorNative) {
  defaultBackendUrl = envApiUrl || VOROA_PRIMARY_URL;
} else if (isLocalhost) {
  defaultBackendUrl = 'http://localhost:5000';
} else {
  defaultBackendUrl = envApiUrl || VOROA_PRIMARY_URL;
}

let activeBackendUrl: string = defaultBackendUrl;
let _isFailoverActive = false;
export const isFailoverActive = (): boolean => _isFailoverActive;

export const getActiveBackendUrl = (): string => activeBackendUrl;

export const getBackupBackendUrl = (): string => {
  if (isLocalhost) return 'http://localhost:5000';
  return activeBackendUrl.includes('getvoroa.com') ? RENDER_BACKUP_URL : VOROA_PRIMARY_URL;
};

export const switchToBackupBackend = (): string => {
  if (isLocalhost) return activeBackendUrl;
  const newUrl = getBackupBackendUrl();
  if (activeBackendUrl !== newUrl) {
    activeBackendUrl = newUrl;
    _isFailoverActive = true;
    console.warn(`[HA Failover] Active backend switched to backup server: ${activeBackendUrl}`);
  }
  return activeBackendUrl;
};

export const resetToPrimaryBackend = (): string => {
  if (isLocalhost) return activeBackendUrl;
  activeBackendUrl = envApiUrl || VOROA_PRIMARY_URL;
  _isFailoverActive = false;
  console.info(`[HA Failover] Active backend restored to primary server: ${activeBackendUrl}`);
  return activeBackendUrl;
};

export const API_URL: string = defaultBackendUrl;
export const SOCKET_URL: string = envSocketUrl || defaultBackendUrl;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const normalizeUid = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.toUpperCase().startsWith('SEC_')) {
    return 'SEC_' + raw.slice(4);
  }
  return `SEC_${raw}`;
};