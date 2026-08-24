/**
 * Tiny decoupling bridge so utils can notify services without creating
 * circular module imports (apiFetch ⇄ socket).
 */
type SocketTokenUpdater = (token: string) => void;

let socketTokenUpdater: SocketTokenUpdater | null = null;

export const setSocketTokenUpdater = (updater: SocketTokenUpdater | null): void => {
  socketTokenUpdater = updater;
};

/** Push a freshly refreshed Firebase ID token into the active socket auth. */
export const syncSocketToken = (token: string): void => {
  if (!token || !socketTokenUpdater) return;
  try {
    socketTokenUpdater(token);
  } catch {
    // never let socket sync break an API retry
  }
};
