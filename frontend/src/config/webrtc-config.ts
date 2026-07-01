export const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: 'stun:stun1.l.google.com:19302',
    },
    {
      urls: [
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  ],
};

const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.startsWith('10.') ||
   window.location.hostname.endsWith('.local'));

const defaultBackendUrl = isLocalhost ? 'http://localhost:5000' : '';
export const API_URL = import.meta.env.VITE_API_URL || defaultBackendUrl;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultBackendUrl;

export const normalizeUid = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.toUpperCase().startsWith('SEC_')) {
    return 'SEC_' + raw.slice(4);
  }
  return `SEC_${raw}`;
};
