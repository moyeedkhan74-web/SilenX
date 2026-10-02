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

/**
 * Whether the user's browser tab is actually being looked at.
 * Clients report this via the `client-visibility` event, so a hidden or
 * minimized tab can still receive OS-level Web Push notifications.
 * Unknown users default to visible to avoid duplicate notifications.
 */
const userVisibility: Map<string, boolean> = new Map();

export function setUserVisibility(userId: string, visible: boolean) {
  userVisibility.set(userId, visible);
}

export function clearUserVisibility(userId: string) {
  userVisibility.delete(userId);
}

export function isUserVisible(userId: string): boolean {
  return userVisibility.get(userId) !== false;
}

/**
 * True when the user is offline OR their connected tab is in the background,
 * i.e. an OS notification is warranted instead of (or in addition to) a
 * real-time socket event.
 */
export function shouldNotifyViaPush(userId: string): boolean {
  if (!getSocketIdForUser(userId)) return true;
  return !isUserVisible(userId);
}
