import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type Database } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { DebtQuickCreateForm } from "../_components/DebtQuickCreateForm";

export const dynamic = "force-dynamic";
type AccountRow = Pick<Database["public"]["Tables"]["accounts"]["Row"], "id" | "name" | "type" | "currency" | "is_default">;

export default async function NewDebtPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [partnersRes, accountsRes, categoriesRes] = await Promise.all([
    supabase.from("partners").select("id,name,type").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id,name,type,currency,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name,type").eq("user_id", user.id),
  ]);

  const partners = partnersRes.data ?? [];
  const accounts: AccountRow[] = accountsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Tạo khoản vay mới</p>
          <h1 className="text-2xl font-semibold">Debts</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/debts">Quay lại</Link>
        </Button>
      </div>

      <DebtQuickCreateForm
        partners={partners}
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}
