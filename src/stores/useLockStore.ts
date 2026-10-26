import { create } from 'zustand';

interface LockState {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  // Trigger untuk memaksa PinLockOverlay memeriksa ulang database setting
  refreshSeq: number;
  requestLockCheck: () => void;
}

export const useLockStore = create<LockState>((set) => ({
  isLocked: false,
  setIsLocked: (locked) => set({ isLocked: locked }),
  refreshSeq: 0,
  requestLockCheck: () => set((state) => ({ refreshSeq: state.refreshSeq + 1 })),
}));
