import { CashflowQuickAddForm } from "../_components/CashflowQuickAddForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type CategoryFocus } from "@/lib/validation/categories";

export const dynamic = "force-dynamic";

type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  is_default?: boolean | null;
  category_focus: CategoryFocus | null;
};

export default async function CashflowNewPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [accountsRes, categoriesRes] = await Promise.all([
    supabase.from("accounts").select("id,name,type,currency,is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id,name,type,parent_id,is_default,category_focus")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (accountsRes.error) {
    console.error("Error fetching accounts:", accountsRes.error);
    redirect("/cashflow");
  }

  if (categoriesRes.error) {
    console.error("Error fetching categories:", categoriesRes.error);
    redirect("/cashflow");
  }

  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden px-[2px] sm:px-4 pb-[300px] md:pb-0">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Add Transaction</h1>
        <p className="text-sm text-muted-foreground">Enter transaction details below.</p>
      </div>

      <Card>
        <CardContent>
          <CashflowQuickAddForm 
            categories={categories} 
            accounts={accounts}
            defaultAccountId={defaultAccount?.id}
            defaultCurrency={defaultCurrency}
            useDialog={false}
            range="month"
          />
        </CardContent>
      </Card>
    </div>
  );
}
