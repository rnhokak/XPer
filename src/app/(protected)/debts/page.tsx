import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DebtQuickAddDialog } from "./_components/DebtQuickAddDialog";
import { DebtsTable } from "./_components/DebtsTable";

export const dynamic = "force-dynamic";

type Partner = { id: string; name: string; type: string | null; phone?: string | null };
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" };
type DebtPayment = { debt_id: string; payment_type: string; principal_amount: number | null; amount: number | null };
type DebtRow = {
  id: string;
  partner_id: string;
  direction: "lend" | "borrow";
  principal_amount: number;
  currency: string;
  start_date: string;
  due_date: string | null;
  status: "ongoing" | "paid_off" | "overdue" | "cancelled";
  description: string | null;
  interest_type: "none" | "fixed" | "percent";
  interest_rate: number | null;
  interest_cycle: "day" | "month" | "year" | null;
  created_at: string | null;
  updated_at: string | null;
  partner: Partner | null;
  outstanding_principal: number;
};
type DebtRowBase = Omit<DebtRow, "outstanding_principal">;

const computeOutstanding = (
  direction: "lend" | "borrow",
  principalAmount: number,
  payments: Array<{ payment_type: string; principal_amount: number | null; amount: number | null }>
) => {
  const paidPrincipal = payments.reduce((sum, p) => {
    const principal = p.principal_amount ?? p.amount ?? 0;
    if (direction === "borrow" && p.payment_type === "repayment") {
      return sum + Number(principal);
    }
    if (direction === "lend" && p.payment_type === "receive") {
      return sum + Number(principal);
    }
    return sum;
  }, 0);

  const remaining = Number(principalAmount) - paidPrincipal;
  return remaining < 0 ? 0 : remaining;
};

export default async function DebtsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [partnersRes, accountsRes, categoriesRes, debtsRes, paymentsRes] = await Promise.all([
    supabase.from("partners").select("id,name,type,phone").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id,name,type,currency,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name,type").eq("user_id", user.id),
    supabase
      .from("debts")
      .select(
        "id,partner_id,direction,principal_amount,currency,start_date,due_date,status,description,interest_type,interest_rate,interest_cycle,created_at,updated_at,partner:partners(id,name,type,phone)"
      )
      .eq("user_id", user.id)
      .order("start_date", { ascending: false }),
    supabase.from("debt_payments").select("debt_id,payment_type,principal_amount,amount").eq("user_id", user.id),
  ]);

  const partners: Partner[] = partnersRes.data ?? [];
  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];
  const payments: DebtPayment[] = paymentsRes.data ?? [];

  const paymentMap = new Map<string, DebtPayment[]>();
  payments.forEach((p) => {
    const current = paymentMap.get(p.debt_id) ?? [];
    current.push(p);
    paymentMap.set(p.debt_id, current);
  });

  const debtsData: DebtRowBase[] = debtsRes.data ?? [];
  const debts: DebtRow[] =
    debtsData.map((debt) => ({
      ...debt,
      outstanding_principal: computeOutstanding(debt.direction, debt.principal_amount, paymentMap.get(debt.id) ?? []),
    })) ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  const totalLendOutstanding = debts
    .filter((d) => d.direction === "lend" && d.status !== "paid_off")
    .reduce((sum, d) => sum + (d.outstanding_principal ?? d.principal_amount), 0);
  const totalBorrowOutstanding = debts
    .filter((d) => d.direction === "borrow" && d.status !== "paid_off")
    .reduce((sum, d) => sum + (d.outstanding_principal ?? d.principal_amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Quản lý cho vay/đi vay và tự động ghi nhận cashflow.</p>
          <h1 className="text-2xl font-semibold">Debts</h1>
        </div>
        <Button asChild>
          <Link href="/debts/new">Thêm khoản vay mới</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Tổng kết nhanh</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang cho vay</p>
              <p className="mt-1 text-2xl font-semibold">
                {totalLendOutstanding.toLocaleString()} <span className="text-base font-normal text-muted-foreground">{defaultCurrency}</span>
              </p>
              <Badge className="mt-2" variant="outline">
                {debts.filter((d) => d.direction === "lend").length} khoản
              </Badge>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang đi vay</p>
              <p className="mt-1 text-2xl font-semibold">
                {totalBorrowOutstanding.toLocaleString()}{" "}
                <span className="text-base font-normal text-muted-foreground">{defaultCurrency}</span>
              </p>
              <Badge className="mt-2" variant="outline">
                {debts.filter((d) => d.direction === "borrow").length} khoản
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Quản lý đối tác</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Thêm người/đơn vị liên quan tới khoản vay ở màn riêng.</p>
            <Button asChild variant="outline">
              <Link href="/debts/partners">Mở màn Đối tác</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <DebtQuickAddDialog
        partners={partners}
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultCurrency}
      />

      <DebtsTable debts={debts} />
    </div>
  );
}
