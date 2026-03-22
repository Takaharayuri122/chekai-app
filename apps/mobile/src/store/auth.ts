// apps/mobile/src/store/auth.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import type { Usuario } from '@meta-app/shared';

const storage = new MMKV({ id: 'auth-store' });

// Adapter Zustand <-> MMKV
const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface AuthState {
  user: Usuario | null;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  _hasHydrated: boolean;
  setUser: (user: Usuario | null) => void;
  setOnboardingCompleted: () => void;
  setHasHydrated: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      onboardingCompleted: false,
      _hasHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setOnboardingCompleted: () => set({ onboardingCompleted: true }),

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // onboardingCompleted é device-level (não reseta no logout)
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-state',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        onboardingCompleted: state.onboardingCompleted,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
