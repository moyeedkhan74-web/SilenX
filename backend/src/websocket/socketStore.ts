export const userSockets: Map<string, string> = new Map();

// Socket.IO server handle so REST routes can emit real-time events too.
import type { Server as IoServer } from 'socket.io';
let ioInstance: IoServer | null = null;

export function setIoServer(io: IoServer): void {
  ioInstance = io;
}

export function getIoServer(): IoServer | null {
  return ioInstance;
}

export function setUserSocket(userId: string, socketId: string) {
  userSockets.set(userId, socketId);
}

export function removeSocketById(socketId: string) {
  for (const [userId, sId] of userSockets) {
    if (sId === socketId) {
      userSockets.delete(userId);
      break;
    }
  }
}

export function getSocketIdForUser(userId: string) {
  return userSockets.get(userId) || null;
}
