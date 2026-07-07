import { create } from 'zustand';
import api from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  /** True once fetchUser has completed at least once (success or failure). */
  hasFetched: boolean;
  setUser: (user: AuthUser | null) => void;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  hasFetched: false,
  setUser: (user) => set({ user }),
  fetchUser: async () => {
    // Prevent concurrent duplicate fetches
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await api.get<AuthUser>('/users/me/');
      set({ user: res.data, isLoading: false, hasFetched: true });
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      set({ isLoading: false, hasFetched: true });
      throw err;
    }
  },
  clearUser: () => set({ user: null, isLoading: false, hasFetched: false }),
}));
