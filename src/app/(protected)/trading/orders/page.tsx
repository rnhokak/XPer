import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import OrdersPageClient from "./OrdersPageClient";

export const dynamic = "force-dynamic";

export type OrderRow = Database["public"]["Tables"]["trading_orders"]["Row"];

export default async function OrdersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trading_orders")
    .select("*")
    .eq("user_id", user.id)
    .order("open_time", { ascending: false });

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
  return <OrdersPageClient initialOrders={orders} />;
}
