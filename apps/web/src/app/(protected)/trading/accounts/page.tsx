import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BalanceAccountsPageClient from "./BalanceAccountsPageClient";

export const dynamic = "force-dynamic";

export default async function BalanceAccountsPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("balance_accounts")
    .select("id,account_type,name,currency,is_active,created_at,broker,platform,account_number,is_demo")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const accounts = data ?? [];

  return <BalanceAccountsPageClient initialAccounts={accounts} loadError={error?.message ?? null} />;
}
