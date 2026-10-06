"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm sm:bg-slate-950/50",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
  disableAutoFocus?: boolean;
  mode?: "create" | "edit" | "view";
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideCloseButton = false, disableAutoFocus, mode, onOpenAutoFocus, ...props }, ref) => {
  const shouldDisableAutoFocus = disableAutoFocus ?? (mode === "edit" || mode === "view");

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        onOpenAutoFocus={(event) => {
          if (shouldDisableAutoFocus) {
            event.preventDefault();
          }
          onOpenAutoFocus?.(event);
        }}
        className={cn(
          // Mobile-first full screen: occupies entire screen, zero background bleed-through
          "fixed inset-0 z-50 flex flex-col w-full h-full h-[100dvh] max-h-[100dvh] bg-background border-0 rounded-none m-0 shadow-none overflow-hidden duration-200 outline-none",
          // Native mobile slide sheet animations
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4",
          // Desktop / Tablet dialog styling (sm: >= 640px)
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-2xl",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
          "dialog-mobile-fullscreen",
          className
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            className="dialog-close-button absolute right-3.5 top-[calc(env(safe-area-inset-top,0px)+0.6rem)] sm:top-4 sm:right-4 z-20 flex h-8.5 w-8.5 items-center justify-center rounded-full bg-slate-100/90 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition active:scale-95 border border-slate-200/50 sm:border-0"
            aria-label="Đóng popup"
          >
            <X className="h-4.5 w-4.5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 flex flex-col space-y-1 text-left border-b border-slate-100 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md",
      "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 px-4 pr-12 sm:pt-5 sm:pb-3.5 sm:px-6 sm:pr-12",
      className
    )}
    {...props}
  />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base sm:text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground leading-normal", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  closeText?: string;
  showCloseButton?: boolean;
}

const DialogFooter = ({
  className,
  onClose,
  closeText = "Đóng",
  showCloseButton = false,
  children,
  ...props
}: DialogFooterProps) => (
  <div
    className={cn(
      "shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm",
      "pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-4 sm:pt-3.5 sm:pb-3.5 sm:px-6",
      className
    )}
    {...props}
  >
    {showCloseButton && onClose && (
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        className="rounded-xl h-9 text-xs sm:text-sm font-semibold border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 min-w-[80px]"
      >
        {closeText}
      </Button>
    )}
    {children}
  </div>
);

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

// Re-export common modal components
export * from "./modal";
