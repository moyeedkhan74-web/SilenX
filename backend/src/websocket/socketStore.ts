export const userSockets: Map<string, string> = new Map();

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
