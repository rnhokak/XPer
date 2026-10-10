"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ModalMode = "create" | "edit" | "view";
export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";

export interface ModalContextValue {
  onClose?: () => void;
  mode?: ModalMode;
  disableAutoFocus?: boolean;
}

export const ModalContext = React.createContext<ModalContextValue>({});
export const useModalContext = () => React.useContext(ModalContext);

const sizeClasses: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
  full: "sm:max-w-[95vw] sm:h-[95vh]",
};

export interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: ModalSize;
  mode?: ModalMode;
  disableAutoFocus?: boolean;
  hideHeaderClose?: boolean;
  mobileMargin?: boolean;
}

export const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm sm:bg-slate-950/50",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
      className
    )}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";

export const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(
  (
    {
      className,
      children,
      size = "lg",
      mode,
      disableAutoFocus,
      onOpenAutoFocus,
      mobileMargin = false,
      ...props
    },
    ref
  ) => {
    const context = useModalContext();
    const effectiveMode = mode ?? context.mode ?? "create";
    const effectiveDisableAutoFocus =
      disableAutoFocus ??
      context.disableAutoFocus ??
      (effectiveMode === "edit" || effectiveMode === "view");

    return (
      <DialogPrimitive.Portal>
        <ModalOverlay />
        <DialogPrimitive.Content
          ref={ref}
          onOpenAutoFocus={(event) => {
            if (effectiveDisableAutoFocus) {
              event.preventDefault();
            }
            onOpenAutoFocus?.(event);
          }}
          className={cn(
            // Mobile full screen vs mobile with top/bottom 10px margin
            mobileMargin
              ? "fixed inset-x-0 top-[10px] bottom-[10px] z-50 flex flex-col w-full h-[calc(100dvh-20px)] max-h-[calc(100dvh-20px)] bg-background border border-slate-200/80 rounded-2xl m-0 shadow-2xl overflow-hidden outline-none"
              : "fixed inset-0 z-50 flex flex-col w-full h-full h-[100dvh] max-h-[100dvh] bg-background border-0 rounded-none m-0 shadow-none overflow-hidden outline-none",
            // Mobile animations
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 duration-200",
            // Desktop / Tablet dialog modal (sm: >= 640px)
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-2xl sm:overflow-hidden",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
            !mobileMargin && "dialog-mobile-fullscreen",
            sizeClasses[size],
            className
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
ModalContent.displayName = "ModalContent";

export interface ModalHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  onClose?: () => void;
  hideCloseButton?: boolean;
}

export const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  (
    {
      className,
      title,
      description,
      icon,
      badge,
      headerAction,
      onClose,
      hideCloseButton = false,
      children,
      ...props
    },
    ref
  ) => {
    const context = useModalContext();
    const handleClose = onClose ?? context.onClose;

    return (
      <div
        ref={ref}
        className={cn(
          "shrink-0 flex items-center justify-between border-b border-slate-100 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md",
          // iOS Safe Area for iPhone Dynamic Island and notch
          "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 px-4 sm:pt-4 sm:pb-3.5 sm:px-6",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {title && (
                typeof title === "string" ? (
                  <DialogPrimitive.Title className="text-base sm:text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    {title}
                  </DialogPrimitive.Title>
                ) : (
                  <DialogPrimitive.Title asChild>{title}</DialogPrimitive.Title>
                )
              )}
              {badge}
            </div>
            {description && (
              typeof description === "string" ? (
                <DialogPrimitive.Description className="text-xs text-muted-foreground truncate leading-normal">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description asChild>{description}</DialogPrimitive.Description>
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}
          {!hideCloseButton && handleClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8.5 w-8.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              aria-label="Đóng popup"
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          )}
        </div>
        {children}
      </div>
    );
  }
);
ModalHeader.displayName = "ModalHeader";

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollable?: boolean;
}

export const ModalBody = React.forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, scrollable = true, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex-1 min-h-0",
        scrollable && "overflow-y-auto overscroll-contain",
        "p-4 sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ModalBody.displayName = "ModalBody";

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  closeText?: string;
  showCloseButton?: boolean;
  actions?: React.ReactNode;
}

export const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  (
    {
      className,
      onClose,
      closeText = "Đóng",
      showCloseButton = true,
      actions,
      children,
      ...props
    },
    ref
  ) => {
    const context = useModalContext();
    const handleClose = onClose ?? context.onClose;

    return (
      <div
        ref={ref}
        className={cn(
          "shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm",
          // iOS Safe Area for iPhone Home indicator bar
          "pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-4 sm:pt-3.5 sm:pb-3.5 sm:px-6",
          className
        )}
        {...props}
      >
        {showCloseButton && handleClose && (
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="rounded-xl h-9 sm:h-9 text-xs sm:text-sm font-semibold border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 min-w-[80px]"
          >
            {closeText}
          </Button>
        )}
        {actions}
        {children}
      </div>
    );
  }
);
ModalFooter.displayName = "ModalFooter";

export interface ModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  mode?: ModalMode;
  disableAutoFocus?: boolean;
  size?: ModalSize;
  closeText?: string;
  showCloseButton?: boolean;
  hideHeaderClose?: boolean;
  mobileMargin?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  children?: React.ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  icon,
  badge,
  headerAction,
  footer,
  mode = "create",
  disableAutoFocus,
  size = "lg",
  closeText = "Đóng",
  showCloseButton = true,
  hideHeaderClose = false,
  mobileMargin = false,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  children,
}: ModalProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (!nextOpen && onClose) {
      onClose();
    }
  };

  const contextValue = React.useMemo<ModalContextValue>(
    () => ({
      onClose,
      mode,
      disableAutoFocus,
    }),
    [onClose, mode, disableAutoFocus]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <ModalContext.Provider value={contextValue}>
        <ModalContent
          size={size}
          mode={mode}
          disableAutoFocus={disableAutoFocus}
          mobileMargin={mobileMargin}
          className={className}
        >
          {title ? (
            <>
              <ModalHeader
                title={title}
                description={description}
                icon={icon}
                badge={badge}
                headerAction={headerAction}
                onClose={onClose}
                hideCloseButton={hideHeaderClose}
                className={headerClassName}
              />
              <ModalBody className={bodyClassName}>{children}</ModalBody>
              <ModalFooter
                onClose={onClose}
                closeText={closeText}
                showCloseButton={showCloseButton}
                className={footerClassName}
              >
                {footer}
              </ModalFooter>
            </>
          ) : (
            children
          )}
        </ModalContent>
      </ModalContext.Provider>
    </DialogPrimitive.Root>
  );
}

export {
  DialogPrimitive,
};
