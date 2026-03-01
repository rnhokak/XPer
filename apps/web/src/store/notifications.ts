import { create } from "zustand";

export type NotificationType = "info" | "success" | "error" | "warning";

export type Notification = {
  id: string;
  title: string;
  description?: string;
  type: NotificationType;
  duration?: number;
  createdAt: number;
};

type NotificationInput = Omit<Notification, "id" | "createdAt"> & { id?: string };

type NotificationState = {
  notifications: Notification[];
  notify: (input: NotificationInput) => string;
  remove: (id: string) => void;
  clear: () => void;
};

const genId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `notif_${Math.random().toString(36).slice(2, 10)}`;
};

export const useNotificationsStore = create<NotificationState>((set, get) => ({
  notifications: [],
  notify: (input) => {
    const id = input.id ?? genId();
    const notification: Notification = {
      id,
      title: input.title,
      description: input.description,
      type: input.type ?? "info",
      duration: input.duration ?? 5000,
      createdAt: Date.now(),
    };

    set((state) => ({ notifications: [...state.notifications, notification] }));

    if (notification.duration && typeof window !== "undefined") {
      window.setTimeout(() => get().remove(id), notification.duration);
    }

    return id;
  },
  remove: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
  clear: () => set({ notifications: [] }),
}));
