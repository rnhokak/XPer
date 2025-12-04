"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { partnerSchema, type PartnerInput } from "@/lib/validation/debts";

type Partner = { id: string; name: string; type: string | null; phone?: string | null; note?: string | null };

const PARTNER_TYPES = ["person", "bank", "company", "other"];

export function PartnersManager({ partners }: { partners: Partner[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partner | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<PartnerInput>({
    resolver: zodResolver(partnerSchema),
    defaultValues: { name: "", type: undefined, phone: "", note: "" },
  });

  const resetForm = () => {
    form.reset({ name: "", type: undefined, phone: "", note: "" });
    setEditing(null);
    setSubmitError(null);
  };

  const upsert = async (values: PartnerInput) => {
    setSubmitError(null);
    const payload = {
      name: values.name.trim(),
      type: values.type?.trim() || null,
      phone: values.phone?.trim() || null,
      note: values.note?.trim() || null,
    };
    const res = await fetch("/api/debts/partners", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Failed to save partner");
      return;
    }
    resetForm();
    router.refresh();
  };

  const remove = async (id: string) => {
    setSubmitError(null);
    const res = await fetch("/api/debts/partners", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Failed to delete partner");
      return;
    }
    if (editing?.id === id) resetForm();
    router.refresh();
  };

  const startEdit = (partner: Partner) => {
    setEditing(partner);
    form.reset({
      name: partner.name,
      type: partner.type ?? undefined,
      phone: partner.phone ?? "",
      note: partner.note ?? "",
    });
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{editing ? "Cập nhật đối tác" : "Đối tác mới"}</p>
          <p className="text-sm text-muted-foreground">Thêm người/đơn vị liên quan tới khoản vay.</p>
        </div>
        {editing ? (
          <Button size="sm" variant="ghost" onClick={resetForm}>
            Hủy
          </Button>
        ) : null}
      </div>

      {!mounted ? (
        <div className="space-y-3 p-4">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr,1fr]">
          <Form {...form}>
            <form className="space-y-3 rounded-lg border bg-white p-4" onSubmit={form.handleSubmit(upsert)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên</FormLabel>
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
              {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu..." : editing ? "Cập nhật đối tác" : "Thêm đối tác"}
              </Button>
            </form>
          </Form>

          <div className="space-y-2">
            {partners.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đối tác nào.</p>
            ) : (
              partners.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.type || "—"} {p.phone ? `· ${p.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p.id)}>
                      Xoá
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
