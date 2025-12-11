import Link from "next/link";
import { CashflowRangeFilter } from "./_components/CashflowRangeFilter";
import { CashflowTransactionList } from "./_components/CashflowTransactionList";
import { CashflowReport } from "./_components/CashflowReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeCashflowRange, rangeStart } from "@/lib/cashflow/utils";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string };

type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense"; is_default?: boolean | null };
type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  note: string | null;
  transaction_time: string;
  category: { id?: string | null; name?: string | null } | null;
  account: { id?: string | null; name?: string | null; currency?: string | null } | null;
};

export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const supabase = await createClient();

  const range = normalizeCashflowRange(searchParams?.range);
  const start = rangeStart(range === "all" ? null : range);

  const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
    supabase.from("accounts").select("id,name,type,currency,is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name,type,is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    (start
      ? supabase
          .from("transactions")
          .select("id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)")
          .eq("user_id", user.id)
          .gte("transaction_time", start.toISOString())
          .order("transaction_time", { ascending: false })
          .limit(50)
      : supabase
          .from("transactions")
          .select("id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)")
          .eq("user_id", user.id)
          .order("transaction_time", { ascending: false })
          .limit(50)),
  ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];
  const transactions: Transaction[] = transactionsRes.data ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cashflow</h1>
          <p className="text-sm text-muted-foreground">Theo dõi giao dịch và thêm mới.</p>
        </div>
        <Button asChild>
          <Link href="/cashflow/new">Add Transaction</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowReport transactions={transactions} range={range} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">Latest activity (limit 50)</p>
          </div>
          <CashflowRangeFilter value={range} />
        </CardHeader>
        <CardContent>
          <CashflowTransactionList transactions={transactions} categories={categories} accounts={accounts} range={range} />
        </CardContent>
      </Card>
    </div>
  );
}
