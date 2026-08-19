import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setInitialized: (value: boolean) => void;
}

const safeStorageEngine = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name) || sessionStorage.getItem(name);
    } catch {
      return sessionStorage.getItem(name);
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.message?.includes('exceeded the quota')) {
        console.warn('[AuthStore] Storage quota exceeded. Cleaning non-auth cache...');
        try {
          Object.keys(localStorage).forEach((k) => {
            if (!k.startsWith('silenx-auth-storage') && !k.startsWith('firebase:authUser')) {
              localStorage.removeItem(k);
            }
          });
          localStorage.setItem(name, value);
          return;
        } catch {
          // If localStorage is still full, use sessionStorage fallback
        }
      }
      try {
        sessionStorage.setItem(name, value);
      } catch {
        // Fallback gracefully in restricted environments
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {}
    try {
      sessionStorage.removeItem(name);
    } catch {}
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      initialized: false,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      login: (user, token) => set({ user, token, isAuthenticated: true, initialized: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      setInitialized: (value) => set({ initialized: value }),
    }),
    {
      name: 'silenx-auth-storage',
      storage: createJSONStorage(() => safeStorageEngine),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
