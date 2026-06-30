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

const defaultBackendUrl = import.meta.env.DEV ? 'http://localhost:5000' : '';
export const API_URL = import.meta.env.VITE_API_URL || defaultBackendUrl;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultBackendUrl;

export const normalizeUid = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  return raw.startsWith('SEC_') ? raw : `SEC_${raw}`;
};
