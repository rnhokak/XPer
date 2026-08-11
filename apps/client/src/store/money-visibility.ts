import { create } from "zustand";

type MoneyVisibilityState = {
  hideAmounts: boolean;
  setHideAmounts: (hidden: boolean) => void;
  toggleHideAmounts: () => void;
};

// Controls whether monetary values should be obscured across the app.
export const useMoneyVisibilityStore = create<MoneyVisibilityState>((set) => ({
  hideAmounts: true, // default to hidden on first load
  setHideAmounts: (hidden) => set({ hideAmounts: hidden }),
  toggleHideAmounts: () => set((state) => ({ hideAmounts: !state.hideAmounts })),
}));
