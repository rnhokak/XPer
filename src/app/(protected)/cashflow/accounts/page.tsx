import { AccountsManager } from "../_components/AccountsManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CashflowAccountsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id,name,type,currency,is_default,created_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountsManager accounts={data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
