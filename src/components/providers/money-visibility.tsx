"use client";

import { useEffect, useState } from "react";
import { useMoneyVisibilityStore } from "@/store/money-visibility";

const STORAGE_KEY = "xper:hide-amounts";

// Sync the global hideAmounts flag to the DOM and localStorage.
export function MoneyVisibilityProvider() {
  const hideAmounts = useMoneyVisibilityStore((state) => state.hideAmounts);
  const setHideAmounts = useMoneyVisibilityStore((state) => state.setHideAmounts);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage so user preference persists between sessions.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "true") setHideAmounts(true);
    if (stored === "false") setHideAmounts(false);
    setHydrated(true);
  }, [setHideAmounts]);

  // Keep the body data attribute and localStorage in sync with the store.
  useEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    document.body.dataset.moneyHidden = hideAmounts ? "true" : "false";
    window.localStorage.setItem(STORAGE_KEY, hideAmounts ? "true" : "false");
  }, [hideAmounts, hydrated]);

  // Default the data attribute immediately to avoid flashes before hydration.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.moneyHidden = "true";
    }
  }, []);

  return null;
}
