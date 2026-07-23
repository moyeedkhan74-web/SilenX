const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.startsWith('10.') ||
   window.location.hostname.endsWith('.local'));

function assertEnvUrl(name: string, value: string | undefined, allowHttpLocalhost = false): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Set it to a valid URL using HTTPS.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Environment variable ${name} is empty. Set it to a valid URL using HTTPS.`);
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('https://')) {
    return trimmed;
  }

  if (allowHttpLocalhost && isLocalhost && lower.startsWith('http://')) {
    return trimmed;
  }

  throw new Error(`Environment variable ${name} must use https://${allowHttpLocalhost ? ' or http://localhost' : ''}. Got: ${trimmed}`);
}

const turnUrlRaw = import.meta.env.VITE_TURN_URL;
const turnUsername = import.meta.env.VITE_TURN_USERNAME;
const turnCredential = import.meta.env.VITE_TURN_PASSWORD;

if (!turnUrlRaw || !turnUsername || !turnCredential) {
  throw new Error('TURN configuration missing. Set VITE_TURN_URL, VITE_TURN_USERNAME, and VITE_TURN_PASSWORD in your environment.');
}

function normalizeTurnUrl(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('VITE_TURN_URL is empty. Provide a valid TURN host in the form turn:host:port or turns:host:port.');
  }

  const urlWithScheme = trimmed.startsWith('turn:') || trimmed.startsWith('turns:')
    ? trimmed
    : `turn:${trimmed}`;

  const urls = [urlWithScheme];
  if (urlWithScheme.startsWith('turn:')) {
    urls.push(urlWithScheme.replace(/^turn:/, 'turns:'));
  } else if (urlWithScheme.startsWith('turns:')) {
    urls.push(urlWithScheme.replace(/^turns:/, 'turn:'));
  }

  return Array.from(new Set(urls));
}

export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: normalizeTurnUrl(turnUrlRaw),
      username: turnUsername,
      credential: turnCredential,
    },
  ],
};

const defaultBackendUrl = isLocalhost ? 'http://localhost:5000' : undefined;
export const API_URL = assertEnvUrl('VITE_API_URL', import.meta.env.VITE_API_URL || defaultBackendUrl, true);
export const SOCKET_URL = assertEnvUrl('VITE_SOCKET_URL', import.meta.env.VITE_SOCKET_URL || defaultBackendUrl, true);

export const normalizeUid = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.toUpperCase().startsWith('SEC_')) {
    return 'SEC_' + raw.slice(4);
  }
  return `SEC_${raw}`;
};
