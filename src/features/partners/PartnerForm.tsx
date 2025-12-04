"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { partnerFormSchema, type PartnerFormValues } from "@/lib/validation/partners";

const PARTNER_TYPES = ["person", "bank", "company", "other"];

type Partner = {
  id?: string;
  name: string;
  type: string | null;
  phone: string | null;
  note: string | null;
};

type Props = {
  partner?: Partner | null;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function PartnerForm({ partner, onSaved, onCancel }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      name: partner?.name ?? "",
      type: partner?.type ?? undefined,
      phone: partner?.phone ?? "",
      note: partner?.note ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: partner?.name ?? "",
      type: partner?.type ?? undefined,
      phone: partner?.phone ?? "",
      note: partner?.note ?? "",
    });
  }, [partner, form]);

  const handleSubmit = async (values: PartnerFormValues) => {
    setSubmitError(null);
    const payload = {
      name: values.name.trim(),
      type: values.type?.trim() || null,
      phone: values.phone?.trim() || null,
      note: values.note?.trim() || null,
    };

    const res = await fetch("/api/partners", {
      method: partner?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partner?.id ? { id: partner.id, ...payload } : payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Không lưu được đối tác");
      return;
    }

    onSaved?.();
    router.refresh();
  };

  if (!mounted) {
    return <div className="h-10 w-full animate-pulse rounded bg-muted" />;
  }

  return (
    <Form {...form}>
      <form className="space-y-3" onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên đối tác</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage>{form.formState.errors.name?.message}</FormMessage>
            </FormItem>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loại</FormLabel>
                <Select value={field.value ?? "unspecified"} onValueChange={(v) => field.onChange(v === "unspecified" ? undefined : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Không xác định</SelectItem>
                    {PARTNER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage>{form.formState.errors.type?.message}</FormMessage>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Liên hệ</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="Số điện thoại (tuỳ chọn)" />
                </FormControl>
                <FormMessage>{form.formState.errors.phone?.message}</FormMessage>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghi chú</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={3} />
              </FormControl>
              <FormMessage>{form.formState.errors.note?.message}</FormMessage>
            </FormItem>
          )}
        />

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Hủy
            </Button>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang lưu..." : partner?.id ? "Cập nhật" : "Thêm đối tác"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
