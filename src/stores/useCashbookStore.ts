import { create } from 'zustand';
import { type Cashbook } from '../database/queries';

interface CashbookState {
  activeCashbook: Cashbook | null;
  setActiveCashbook: (cashbook: Cashbook | null) => void;
}

export const useCashbookStore = create<CashbookState>((set) => ({
  activeCashbook: null,
  setActiveCashbook: (cashbook) => set({ activeCashbook: cashbook }),
}));
