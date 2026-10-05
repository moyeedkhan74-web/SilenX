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

/**
 * Normalizes TURN URLs from the backend to ensure they have proper
 * transport parameters and protocol prefixes.
 * 
 * The backend returns TURN URLs like "turn:global.turn.twilio.com:3478?transport=udp"
 * We need to ensure all transports (UDP, TCP, TLS) are available.
 */
export function normalizeTurnUrl(url: string): string[] {
  const normalized: string[] = [];
  
  // Parse the base URL (e.g., "turn:host:port" or "turns:host:port")
  const match = url.match(/^(turns?):\/\/([^?]+)(?:\?(.*))?$/);
  if (!match) return [url];
  
  const [, , host, query] = match;
  const params = new URLSearchParams(query || '');
  const transport = params.get('transport');
  
  // If no transport specified, return all three
  if (!transport) {
    normalized.push(`turn:${host}?transport=udp`);
    normalized.push(`turn:${host}?transport=tcp`);
    normalized.push(`turns:${host}?transport=tcp`);
  } else if (transport === 'udp') {
    normalized.push(`turn:${host}?transport=udp`);
  } else if (transport === 'tcp') {
    normalized.push(`turn:${host}?transport=tcp`);
    normalized.push(`turns:${host}?transport=tcp`);
  } else {
    normalized.push(url);
  }
  
  return normalized;
}

/**
 * Fetches ICE servers from the backend with 45-second cache TTL.
 * Returns STUN + TURN servers for WebRTC connections.
 */
let _iceServersCache: RTCIceServer[] | null = null;
let _iceServersCacheTime = 0;
const ICE_SERVERS_CACHE_TTL_MS = 45_000;

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (_iceServersCache && now - _iceServersCacheTime < ICE_SERVERS_CACHE_TTL_MS) {
    return _iceServersCache;
  }
  
  try {
    const baseUrl = getActiveBackendUrl();
    const response = await fetch(`${baseUrl}/api/webrtc/ice-servers`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ICE servers: ${response.status}`);
    }
    
    const servers: RTCIceServer[] = await response.json();
    
    // Normalize TURN URLs to ensure all transports are available
    const normalized: RTCIceServer[] = [];
    for (const server of servers) {
      if (server.urls) {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        const normalizedUrls: string[] = [];
        for (const url of urls) {
          normalizedUrls.push(...normalizeTurnUrl(url));
        }
        normalized.push({ ...server, urls: normalizedUrls });
      } else {
        normalized.push(server);
      }
    }
    
    _iceServersCache = normalized;
    _iceServersCacheTime = now;
    return normalized;
  } catch (error) {
    console.warn('[WebRTC] Failed to fetch ICE servers, using fallback:', error);
    // Return fallback STUN servers
    const fallback: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    _iceServersCache = fallback;
    _iceServersCacheTime = now;
    return fallback;
  }
}

/**
 * Clears the ICE servers cache, forcing a fresh fetch on next call.
 */
export function clearIceServersCache(): void {
  _iceServersCache = null;
  _iceServersCacheTime = 0;
}