import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { ToastProviderContext, useToast } from "@/components/ui/use-toast";

const ToastList = () => {
  const { toasts } = useToast();

  return (
    <>
      {toasts.map(({ id, title, description, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title ? <ToastTitle>{title}</ToastTitle> : null}
            {description ? <ToastDescription>{description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
    </>
  );
};

export const Toaster = () => {
  return (
    <ToastProvider>
      <ToastProviderContext>
        <ToastList />
        <ToastViewport />
      </ToastProviderContext>
    </ToastProvider>
  );
};
