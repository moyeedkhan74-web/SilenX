/**
 * Utilities for saving and retrieving custom user nicknames locally.
 */

const STORAGE_KEY = 'slienx-contact-nicknames';

export const getCustomNickname = (...ids: (string | undefined | null)[]): string | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    for (const id of ids) {
      if (id && parsed[id] && typeof parsed[id] === 'string' && parsed[id].trim()) {
        return parsed[id].trim();
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const saveCustomNickname = (name: string, ...ids: (string | undefined | null)[]): void => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const trimmed = name.trim();
    for (const id of ids) {
      if (id) {
        if (trimmed) {
          parsed[id] = trimmed;
        } else {
          delete parsed[id];
        }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    // Notify all open tabs/components
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('silenx:nickname-updated', { detail: { name: trimmed } }));
  } catch (err) {
    console.warn('[Nicknames] Failed to save nickname to localStorage:', err);
  }
};
