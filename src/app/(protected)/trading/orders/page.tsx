import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import OrdersPageClient from "./OrdersPageClient";

export const dynamic = "force-dynamic";

export type OrderRow = Database["public"]["Tables"]["trading_orders"]["Row"];
type TradingBalanceRow = {
  balance_account_id: string;
  name: string;
  currency: string;
  broker: string | null;
  platform: string | null;
  account_number: string | null;
  is_demo: boolean | null;
};

export default async function OrdersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trading_orders")
    .select("*")
    .eq("user_id", user.id)
    .order("open_time", { ascending: false });

  const { data: tradingAccountsData } = await supabase
    .from("balance_accounts")
    .select("id,name,currency,is_active,account_type,broker,platform,account_number,is_demo")
    .eq("user_id", user.id)
    .eq("account_type", "TRADING")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-500">Failed to load orders: {error.message}</CardContent>
      </Card>
    );
  }

  const orders: OrderRow[] = (data ?? []) as OrderRow[];
  const tradingAccounts: TradingBalanceRow[] =
    tradingAccountsData
      ?.map((row: any) => ({
        balance_account_id: row.id,
        name: row.name,
        currency: row.currency,
        broker: row.broker ?? null,
        platform: row.platform ?? null,
        account_number: row.account_number ?? null,
        is_demo: row.is_demo ?? null,
      }))
      .filter(Boolean) ?? [];

  return <OrdersPageClient initialOrders={orders} tradingAccounts={tradingAccounts} />;
}
