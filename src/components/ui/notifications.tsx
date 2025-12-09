"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useNotificationsStore, type NotificationType } from "@/store/notifications";

const typeStyles: Record<
  NotificationType,
  { container: string; icon: string; title: string; description: string; close: string }
> = {
  success: {
    container: "border-emerald-200 bg-white/80 text-emerald-900 shadow-emerald-100/70",
    icon: "text-emerald-600 bg-emerald-50",
    title: "text-emerald-900",
    description: "text-emerald-700",
    close: "hover:bg-emerald-50 hover:text-emerald-700",
  },
  error: {
    container: "border-rose-200 bg-white/85 text-rose-900 shadow-rose-100/70",
    icon: "text-rose-600 bg-rose-50",
    title: "text-rose-900",
    description: "text-rose-700",
    close: "hover:bg-rose-50 hover:text-rose-700",
  },
  warning: {
    container: "border-amber-200 bg-white/85 text-amber-900 shadow-amber-100/70",
    icon: "text-amber-600 bg-amber-50",
    title: "text-amber-900",
    description: "text-amber-700",
    close: "hover:bg-amber-50 hover:text-amber-700",
  },
  info: {
    container: "border-slate-200 bg-white/85 text-slate-900 shadow-slate-100/70",
    icon: "text-slate-600 bg-slate-50",
    title: "text-slate-900",
    description: "text-slate-700",
    close: "hover:bg-slate-50 hover:text-slate-700",
  },
};

const typeIcons: Record<NotificationType, ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

export function Notifications() {
  const notifications = useNotificationsStore((state) => state.notifications);
  const remove = useNotificationsStore((state) => state.remove);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && notifications[0]) {
        remove(notifications[0].id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notifications, remove]);

  if (!notifications.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center gap-3 px-3 py-4 sm:items-end sm:px-5 sm:py-6">
      {notifications.map((notif) => {
        const styles = typeStyles[notif.type] ?? typeStyles.info;
        const Icon = typeIcons[notif.type] ?? Info;
        return (
          <div
            key={notif.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-3 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur",
              styles.container
            )}
            role="status"
            aria-live="polite"
          >
            <span className={cn("mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full", styles.icon)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className={cn("text-sm font-semibold", styles.title)}>{notif.title}</p>
              {notif.description ? <p className={cn("mt-0.5 text-sm leading-snug", styles.description)}>{notif.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => remove(notif.id)}
              className={cn("rounded-full p-1 text-sm transition", styles.close)}
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
