import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserProfilePageClient } from "@/features/profile/UserProfilePageClient";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/auth/login");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return <UserProfilePageClient userId={user.id} email={user.email ?? ""} profile={profile ?? null} />;
}
