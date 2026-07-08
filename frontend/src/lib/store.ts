import { create } from 'zustand';
import api from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  /** True once fetchUser has completed at least once (success or failure). */
  hasFetched: boolean;
  /**
   * Set when fetchUser fails with a "user not in DB" error.
   * 'no_user'  — authenticated via Clerk but not registered in WorkWise
   * 'error'    — generic server/network error
   * null       — no error
   */
  fetchError: 'no_user' | 'error' | null;
  setUser: (user: AuthUser | null) => void;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
}

const NOT_FOUND_SIGNALS = ['user not found', 'sign up', 'not in db', 'not found', 'no account'];

export const useAuthStore = create<AuthState>((set, get) => ({
  user:       null,
  isLoading:  false,
  hasFetched: false,
  fetchError: null,

  setUser: (user) => set({ user }),

  fetchUser: async () => {
    // Prevent concurrent duplicate fetches
    if (get().isLoading) return;
    set({ isLoading: true, fetchError: null });
    try {
      const res = await api.get<AuthUser>('/users/me/');
      set({ user: res.data, isLoading: false, hasFetched: true, fetchError: null });
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { detail?: string; error?: string } }; message?: string };
      const msg = (
        e?.response?.data?.detail ||
        e?.response?.data?.error  ||
        e?.message                ||
        ''
      ).toLowerCase();

      const isNotFound =
        e?.response?.status === 404 ||
        NOT_FOUND_SIGNALS.some(s => msg.includes(s));

      set({
        isLoading:  false,
        hasFetched: true,
        fetchError: isNotFound ? 'no_user' : 'error',
      });

      throw err;
    }
  },

  clearUser: () => set({ user: null, isLoading: false, hasFetched: false, fetchError: null }),
}));
