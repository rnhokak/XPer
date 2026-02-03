import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeCashflowRange, normalizeRangeShift, rangeBounds } from "@/lib/cashflow/utils";
import { PieChartIcon } from "lucide-react";
import { TransactionByCategoryReport } from "./_components/TransactionByCategoryReport";

type SearchParams = { range?: string; shift?: string };

type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  is_default?: boolean | null;
  category_focus: string | null;
};
type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  currency: string;
  note: string | null;
  transaction_time: string;
  category_id: string | null;
  account_id: string | null;
};

export default async function TransactionByCategoryReportPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const supabase = await createClient();

  const range = normalizeCashflowRange((await searchParams)?.range);
  const shift = normalizeRangeShift((await searchParams)?.shift);
  const { start, end } = rangeBounds(range, shift);

  const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,type,currency,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id,name,type,parent_id,is_default,category_focus")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id,type,amount,currency,note,transaction_time,category_id,account_id")
      .eq("user_id", user.id)
      .gte("transaction_time", start.toISOString())
      .lt("transaction_time", end.toISOString())
      .order("transaction_time", { ascending: false })
  ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];
  const transactions: Transaction[] = transactionsRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Báo cáo giao dịch theo danh mục</h1>
          <p className="text-sm text-muted-foreground">Phân tích chi tiêu/thu nhập theo danh mục hàng tháng.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Tổng quan theo danh mục
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionByCategoryReport 
            transactions={transactions} 
            categories={categories} 
            range={range} 
            shift={shift} 
          />
        </CardContent>
      </Card>
    </div>
  );
}