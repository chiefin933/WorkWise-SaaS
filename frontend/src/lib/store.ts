import { create } from 'zustand';
import api from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<AuthUser>('/users/me/');
      set({ user: res.data, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      set({ isLoading: false });
    }
  },
  clearUser: () => set({ user: null, isLoading: false }),
}));
