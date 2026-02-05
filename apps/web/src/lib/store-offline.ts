import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  setOnline: (online: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSyncCount: 0,
  isSyncing: false,
  setOnline: (online) => set({ isOnline: online }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
}));
