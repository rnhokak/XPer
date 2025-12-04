import { CashflowQuickAddForm } from "./_components/CashflowQuickAddForm";
import { CashflowRangeFilter } from "./_components/CashflowRangeFilter";
import { CashflowTransactionList } from "./_components/CashflowTransactionList";
import { CashflowReport } from "./_components/CashflowReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

const rangeStart = (range: string | undefined) => {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "month") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
};

export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const supabase = await createClient();

  const allowedRanges = new Set(["today", "week", "month", "all"]);
  const range = allowedRanges.has(searchParams?.range ?? "") ? (searchParams?.range as string) : "month";
  const start = rangeStart(range);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cashflow</h1>
          <p className="text-sm text-muted-foreground">Theo dõi giao dịch và thêm nhanh qua modal.</p>
        </div>
        <CashflowQuickAddForm
          categories={categories}
          accounts={accounts}
          defaultAccountId={defaultAccount?.id}
          defaultCurrency={defaultCurrency}
          useDialog
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cashflow tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Nhập số tiền và bấm Add là đủ. Category, account, thời gian đều tuỳ chọn.</p>
          <p>Mặc định sẽ dùng account đánh dấu default nếu có. Currency lấy từ account hoặc fallback {defaultCurrency}.</p>
          <p>Giao dịch mới sẽ hiện ngay dưới danh sách, bạn có thể lọc Today/Week/Month.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowReport transactions={transactions} />
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
          <CashflowTransactionList transactions={transactions} categories={categories} accounts={accounts} />
        </CardContent>
      </Card>
    </div>
  );
}
