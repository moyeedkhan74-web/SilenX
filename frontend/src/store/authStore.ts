import { create } from 'zustand';
import type { User } from '../types';

const normalizeUserForPrototype = (user: User): User => ({
  ...user,
  id: 'self',
  uid: user.uid || `SEC_${user.email || 'user'}`,
  email: user.email || '',
  displayName: user.displayName || 'Secure User',
  avatarUrl: user.avatarUrl ?? null,
  status: user.status || 'online',
  bio: user.bio || 'Signed in with SlienX',
});

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  initialized: false,
  setUser: (user) => set({ user: normalizeUserForPrototype(user) }),
  setToken: (token) => set({ token }),
  login: (user, token) => set({ user: normalizeUserForPrototype(user), token, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
  setInitialized: (value) => set({ initialized: value }),
}));
