import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import FundingPageClient from "./FundingPageClient";

export const dynamic = "force-dynamic";

export type FundingRow = Database["public"]["Tables"]["trading_funding"]["Row"];

export default async function FundingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trading_funding")
    .select("*")
    .eq("user_id", user.id)
    .order("transaction_time", { ascending: false });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funding history</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-500">
          Failed to load funding transactions: {error.message}
        </CardContent>
      </Card>
    );
  }

  const fundingRows: FundingRow[] = (data ?? []) as FundingRow[];
  const serverNow = new Date().toISOString();
  return <FundingPageClient initialData={fundingRows} serverNow={serverNow} />;
}
