import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import TradingDashboardPageClient from "./TradingDashboardPageClient";

export const dynamic = "force-dynamic";

type LatestBalanceRow = Database["public"]["Views"]["balance_account_latest_balances"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["trading_daily_balance_snapshots"]["Row"];

export default async function TradingDashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const { data: latestBalances, error: latestError } = await supabase
    .from("balance_account_latest_balances")
    .select("balance_account_id,user_id,account_type,name,currency,is_active,current_balance,balance_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("account_type", { ascending: true })
    .order("name", { ascending: true });

  const accounts = (latestBalances ?? []) as LatestBalanceRow[];
  const accountIds = accounts.map((a) => a.balance_account_id).filter(Boolean) as string[];

  let snapshots: SnapshotRow[] = [];
  if (accountIds.length > 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: snapData } = await supabase
      .from("trading_daily_balance_snapshots")
      .select("*")
      .in("balance_account_id", accountIds)
      .gte("date", monthStart.toISOString().slice(0, 10))
      .order("date", { ascending: true });
    snapshots = (snapData ?? []) as SnapshotRow[];
  }

  return (
    <TradingDashboardPageClient
      latestBalances={accounts}
      snapshots={snapshots}
      loadError={latestError?.message ?? null}
    />
  );
}
