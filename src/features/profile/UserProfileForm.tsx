"use client";

import { useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const displayNameSchema = z
  .string()
  .max(80, "Tên hiển thị quá dài")
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()));

const formSchema = z.object({
  displayName: displayNameSchema,
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  userId: string;
  email: string;
  initialDisplayName?: string | null;
  initialAvatarUrl?: string | null;
};

export function UserProfileForm({ userId, email, initialDisplayName, initialAvatarUrl }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(initialDisplayName ?? null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: initialDisplayName ?? "",
    },
  });

  const uploadAvatar = async (file: File) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
      });
      if (uploadError) {
        setSubmitError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      if (profileError) {
        setSubmitError(profileError.message);
        return;
      }
      setAvatarUrl(publicUrl);
      setSubmitSuccess("Avatar updated");
    } finally {
      setAvatarUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: values.displayName ?? null, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      setSubmitError(error.message);
      return;
    }
      setCurrentDisplayName(values.displayName ?? null);
      setSubmitSuccess("Profile updated");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[0.65fr,1.35fr]">
      <Card className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-full border bg-muted">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
              {(currentDisplayName ?? email ?? "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{currentDisplayName || email}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar(file);
          }}
        />
        <Button variant="outline" size="sm" disabled={avatarUploading} onClick={() => fileInputRef.current?.click()}>
          {avatarUploading ? "Đang tải..." : "Đổi avatar"}
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin hồ sơ</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="displayName">Tên hiển thị</Label>
              <Input id="displayName" {...form.register("displayName")} />
              {form.formState.errors.displayName ? (
                <p className="text-sm text-red-500">{form.formState.errors.displayName.message}</p>
              ) : null}
            </div>

            {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
            {submitSuccess ? <p className="text-sm text-green-600">{submitSuccess}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  form.reset({ displayName: initialDisplayName ?? "" });
                  setSubmitError(null);
                  setSubmitSuccess(null);
                  setCurrentDisplayName(initialDisplayName ?? null);
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
