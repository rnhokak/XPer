import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
} from "react-hook-form";
import { cn } from "@/lib/utils";

export const Form = FormProvider;

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControllerProps<TFieldValues, TName>
) {
  return <Controller {...props} />;
}

export const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props} />
  )
);
FormItem.displayName = "FormItem";

export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
));
FormLabel.displayName = "FormLabel";

export const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("grid gap-1", className)} {...props} />
));
FormControl.displayName = "FormControl";

export const FormMessage = ({ className, children }: React.HTMLAttributes<HTMLParagraphElement>) => (
  children ? <p className={cn("text-sm text-red-500", className)}>{children}</p> : null
);

export const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
FormDescription.displayName = "FormDescription";

export const FormItemContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-1">{children}</div>
);

// Utility component to wrap inputs with error highlighting
export const FormInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-1">{children}</div>
);

// Wraps a child and passes down form control props. Useful when combining with custom inputs.
export const FormFieldControl = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ className, ...props }, ref) => (
  <Slot ref={ref} className={cn(className)} {...props} />
));
FormFieldControl.displayName = "FormFieldControl";
