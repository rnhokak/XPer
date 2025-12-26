import * as React from "react";
import type { ToastProps } from "@radix-ui/react-toast";

const TOAST_LIMIT = 2;
const TOAST_REMOVE_DELAY = 5000;

type ToastActionElement = React.ReactElement;

type ToastItem = ToastProps & {
  id: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
};

type ToastContextState = {
  toasts: ToastItem[];
  toast: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (toastId?: string) => void;
};

const ToastContext = React.createContext<ToastContextState | undefined>(undefined);

const genId = () => Math.random().toString(36).slice(2, 9);

export const ToastProviderContext = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((toastId?: string) => {
    setToasts((current) => (toastId ? current.filter((toast) => toast.id !== toastId) : []));
  }, []);

  const toast = React.useCallback(
    (toastData: Omit<ToastItem, "id">) => {
      const id = genId();
      setToasts((current) => {
        const next = [{ ...toastData, id }, ...current];
        return next.slice(0, TOAST_LIMIT);
      });

      window.setTimeout(() => dismiss(id), TOAST_REMOVE_DELAY);
    },
    [dismiss]
  );

  return <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProviderContext");
  }
  return context;
};
