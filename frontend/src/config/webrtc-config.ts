const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalhost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  hostname.endsWith('.local');

// Capacitor native apps run inside a WebView with origin "capacitor://localhost"
// which is NOT localhost from a networking standpoint — it can reach the internet.
const isCapacitorNative = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:' ||
   (window as any).Capacitor?.isNativePlatform?.() === true);

// ─── TURN configuration ──────────────────────────────────────────────────────
// Set VITE_TURN_URL, VITE_TURN_USERNAME, and VITE_TURN_PASSWORD in your
// Vercel / hosting environment to enable TURN relay (required for mobile
// callers behind carrier-grade NAT).
// Without TURN, calls can still work on the same local network or when both
// peers have a public IP, but will fail in most real-world mobile scenarios.
const turnUrlRaw: string | undefined = import.meta.env.VITE_TURN_URL;
const turnUsername: string | undefined = import.meta.env.VITE_TURN_USERNAME;
const turnCredential: string | undefined = import.meta.env.VITE_TURN_PASSWORD;

const hasTurnConfig = !!(turnUrlRaw && turnUsername && turnCredential);

if (!hasTurnConfig) {
  if (isLocalhost) {
    console.info(
      '[WebRTC] No TURN server configured. Running in STUN-only mode (fine for local dev).'
    );
  } else {
    console.warn(
      '[WebRTC] ⚠️  No TURN server configured in production!\n' +
        'Set VITE_TURN_URL, VITE_TURN_USERNAME, and VITE_TURN_PASSWORD in your environment.\n' +
        'Calls may fail for mobile users on cellular networks.'
    );
  }
}

function normalizeTurnUrl(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  // Strip any existing scheme so we can rebuild cleanly
  const stripped = trimmed
    .replace(/^turns?:/, '')
    .replace(/\?transport=\w+$/, '');

  // Build the base host:port (default to 3478 if no port given)
  const base = stripped.includes(':') ? stripped : `${stripped}:3478`;

  return Array.from(new Set([
    `turn:${base}?transport=udp`,   // UDP (fastest, used first)
    `turn:${base}?transport=tcp`,   // TCP (fallback through firewalls)
    `turns:${base}?transport=tcp`,  // TLS TCP (works through strict firewalls)
  ]));
}

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

if (hasTurnConfig) {
  iceServers.push({
    urls: normalizeTurnUrl(turnUrlRaw!),
    username: turnUsername!,
    credential: turnCredential!,
  });
} else {
  // If no proprietary TURN configuration is found in env, fall back to Metered.ca's free Open Relay service
  // to ensure remote and cellular WebRTC calls (behind symmetric NAT) connect reliably.
  console.info('[WebRTC] Using Metered Open Relay STUN/TURN fallback servers for NAT traversal.');
  iceServers.push({
    urls: [
      'stun:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:80?transport=udp',
      'turn:openrelay.metered.ca:80?transport=tcp',
      'turn:openrelay.metered.ca:443',
      'turns:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  });
}

export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers,
  iceCandidatePoolSize: 10,
};

// ─── Backend URLs ─────────────────────────────────────────────────────────────
// On localhost: default to http://localhost:5000
// On Capacitor native (Android/iOS): MUST use full https:// backend URL — the
//   WebView cannot reach the same-origin backend, its origin is capacitor://localhost.
// In production web: use VITE_API_URL or same-origin fallback (works with Vercel rewrites).

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const envSocketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

let defaultBackendUrl: string;
if (isLocalhost) {
  defaultBackendUrl = 'http://localhost:5000';
} else if (isCapacitorNative) {
  // On native Android/iOS, fall back to local LAN IP if VITE_API_URL is not configured
  defaultBackendUrl = envApiUrl || 'http://192.168.1.46:5000';
} else {
  // Web browser production — same-origin or Vercel rewrite
  defaultBackendUrl = '';
}

export const API_URL: string = envApiUrl || defaultBackendUrl;
export const SOCKET_URL: string = envSocketUrl || envApiUrl || defaultBackendUrl;

if (!isLocalhost && !API_URL) {
  console.warn('[Config] VITE_API_URL is not set. API calls may fail in production.');
}
if (!isLocalhost && !SOCKET_URL) {
  console.warn('[Config] VITE_SOCKET_URL is not set. Socket connections may fail in production.');
}

// Export flag so other modules can check if running natively
export { isCapacitorNative };

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const normalizeUid = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.toUpperCase().startsWith('SEC_')) {
    return 'SEC_' + raw.slice(4);
  }
  return `SEC_${raw}`;
};
