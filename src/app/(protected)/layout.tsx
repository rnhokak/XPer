import MainLayout from "@/components/layout/MainLayout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return <MainLayout userEmail={user.email} userDisplayName={profile?.display_name ?? null}>{children}</MainLayout>;
}
