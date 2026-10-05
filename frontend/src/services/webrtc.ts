import { fetchIceServers } from '../config/webrtc-config';

let currentIceServers: RTCIceServer[] | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!currentIceServers) {
    currentIceServers = await fetchIceServers();
  }
  return currentIceServers;
}

export async function createP2pPeerConnection(): Promise<RTCPeerConnection> {
  const iceServers = await getIceServers();
  return new RTCPeerConnection({ iceServers });
}
