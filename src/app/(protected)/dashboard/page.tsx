import Link from "next/link";
import { ArrowUpRight, HandCoins, LineChart, Loader2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  transaction_time: string;
  category?: { name?: string | null } | null;
};

type Debt = {
  id: string;
  direction: "lend" | "borrow";
  principal_amount: number;
  currency: string;
  start_date: string;
  due_date: string | null;
  status: "ongoing" | "paid_off" | "overdue" | "cancelled";
  description: string | null;
  partner?: { name?: string | null } | null;
};

type DebtPayment = { debt_id: string; payment_type: string; principal_amount: number | null; amount: number | null };

type TradingOrder = {
  id: string;
  status: "open" | "closed" | "cancelled";
  pnl_amount: number | null;
  open_time: string;
  close_time: string | null;
  side: "buy" | "sell";
  symbol: string;
  volume: number;
};

type TradingFunding = { amount: number; type: "deposit" | "withdraw"; currency: string; transaction_time: string };
type Account = { id: string; name: string; currency: string; is_default: boolean };

const startOfMonth = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatNumber = (value: number, fractionDigits = 0) =>
  Number(value).toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });

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

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();

  const [accountsRes, transactionsRes, debtsRes, paymentsRes, ordersRes, fundingRes] = await Promise.all([
    supabase.from("accounts").select("id,name,currency,is_default").eq("user_id", user.id).order("is_default", { ascending: false }),
    supabase
      .from("transactions")
      .select("id,type,amount,currency,transaction_time,category:categories(name)")
      .eq("user_id", user.id)
      .gte("transaction_time", monthStart)
      .order("transaction_time", { ascending: false })
      .limit(40),
    supabase
      .from("debts")
      .select("id,direction,principal_amount,currency,start_date,due_date,status,description,partner:partners(name)")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false })
      .limit(30),
    supabase.from("debt_payments").select("debt_id,payment_type,principal_amount,amount").eq("user_id", user.id),
    supabase
      .from("trading_orders")
      .select("id,status,pnl_amount,open_time,close_time,side,symbol,volume")
      .eq("user_id", user.id)
      .gte("open_time", monthStart)
      .order("open_time", { ascending: false })
      .limit(40),
    supabase
      .from("trading_funding")
      .select("amount,type,currency,transaction_time")
      .eq("user_id", user.id)
      .gte("transaction_time", monthStart)
      .order("transaction_time", { ascending: false })
      .limit(20),
  ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const transactions: Transaction[] = transactionsRes.data ?? [];
  const debts: Debt[] = debtsRes.data ?? [];
  const payments: DebtPayment[] = paymentsRes.data ?? [];
  const orders: TradingOrder[] = ordersRes.data ?? [];
  const funding: TradingFunding[] = fundingRes.data ?? [];

  const defaultCurrency = accounts.find((a) => a.is_default)?.currency ?? accounts[0]?.currency ?? transactions[0]?.currency ?? "VND";

  const totalIncome = transactions.reduce((sum, tx) => (tx.type === "income" ? sum + Number(tx.amount) : sum), 0);
  const totalExpense = transactions.reduce((sum, tx) => (tx.type === "expense" ? sum + Number(tx.amount) : sum), 0);
  const cashflowNet = totalIncome - totalExpense;
  const latestTransactions = transactions.slice(0, 5);

  const paymentMap = new Map<string, DebtPayment[]>();
  payments.forEach((p) => {
    const current = paymentMap.get(p.debt_id) ?? [];
    current.push(p);
    paymentMap.set(p.debt_id, current);
  });

  const debtsWithOutstanding = debts.map((debt) => ({
    ...debt,
    outstanding: computeOutstanding(debt.direction, debt.principal_amount, paymentMap.get(debt.id) ?? []),
  }));

  const lendOutstanding = debtsWithOutstanding
    .filter((d) => d.direction === "lend" && d.status !== "paid_off")
    .reduce((sum, d) => sum + (d.outstanding ?? d.principal_amount), 0);
  const borrowOutstanding = debtsWithOutstanding
    .filter((d) => d.direction === "borrow" && d.status !== "paid_off")
    .reduce((sum, d) => sum + (d.outstanding ?? d.principal_amount), 0);

  const upcomingDue = debtsWithOutstanding
    .filter((d) => d.due_date && d.status !== "paid_off")
    .sort((a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime())
    .slice(0, 3);

  const openOrders = orders.filter((o) => o.status === "open");
  const closedThisMonth = orders.filter((o) => o.status === "closed" && o.close_time && o.close_time >= monthStart);
  const pnlThisMonth = closedThisMonth.reduce((sum, o) => sum + Number(o.pnl_amount ?? 0), 0);
  // Withdraw - deposit: coi withdraw là phần rút về (realized)
  const fundingNet = funding.reduce((sum, f) => (f.type === "withdraw" ? sum + Number(f.amount) : sum - Number(f.amount)), 0);

  const latestOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Chụp nhanh ba module: cashflow, debts và trading.</p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/settings">
            Cấu hình nhanh
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-0 bg-white/90 shadow-sm ring-1 ring-black/5">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Cashflow tháng này
              </CardTitle>
              <CardDescription>
                Tính từ {new Date(monthStart).toLocaleDateString("vi-VN", { day: "2-digit", month: "short" })} đến hôm nay.
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/cashflow">Mở Cashflow</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p>
                <p className={`text-2xl font-semibold ${cashflowNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {cashflowNet >= 0 ? "+" : ""}
                  {formatNumber(cashflowNet, 0)} <span className="text-base font-normal text-muted-foreground">{defaultCurrency}</span>
                </p>
                <p className="text-xs text-muted-foreground">Thu - Chi</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Thu</p>
                <p className="text-2xl font-semibold text-emerald-700">
                  +{formatNumber(totalIncome, 0)} <span className="text-base font-normal text-emerald-700/80">{defaultCurrency}</span>
                </p>
                <p className="text-xs text-emerald-700/80">Giao dịch thu tháng này</p>
              </div>
              <div className="rounded-lg border bg-red-50 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-red-700">Chi</p>
                <p className="text-2xl font-semibold text-red-700">
                  -{formatNumber(totalExpense, 0)} <span className="text-base font-normal text-red-700/80">{defaultCurrency}</span>
                </p>
                <p className="text-xs text-red-700/80">Giao dịch chi tháng này</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Giao dịch mới nhất</p>
                <Badge variant="outline">{transactions.length} giao dịch tháng này</Badge>
              </div>
              <div className="divide-y rounded-lg border bg-white">
                {latestTransactions.length ? (
                  latestTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {tx.category?.name ?? (tx.type === "income" ? "Income" : "Expense")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.transaction_time).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <p className={`text-base font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.type === "income" ? "+" : "-"}
                        {formatNumber(tx.amount, 0)} {tx.currency ?? defaultCurrency}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chưa có giao dịch trong tháng.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/90 shadow-sm ring-1 ring-black/5">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-primary" />
                Debts
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/debts">Quản lý</Link>
              </Button>
            </div>
            <CardDescription>Theo dõi khoản cho vay / đi vay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-white px-3 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang cho vay</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatNumber(lendOutstanding, 0)} <span className="text-sm font-normal text-muted-foreground">{defaultCurrency}</span>
                </p>
                <Badge className="mt-2" variant="outline">
                  {debtsWithOutstanding.filter((d) => d.direction === "lend").length} khoản
                </Badge>
              </div>
              <div className="rounded-lg border bg-white px-3 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang đi vay</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatNumber(borrowOutstanding, 0)} <span className="text-sm font-normal text-muted-foreground">{defaultCurrency}</span>
                </p>
                <Badge className="mt-2" variant="outline">
                  {debtsWithOutstanding.filter((d) => d.direction === "borrow").length} khoản
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Sắp đến hạn</p>
              <div className="divide-y rounded-lg border bg-white">
                {upcomingDue.length ? (
                  upcomingDue.map((debt) => (
                    <div key={debt.id} className="flex items-center justify-between px-3 py-3 text-sm">
                      <div className="space-y-1">
                        <p className="font-medium">{debt.partner?.name ?? "Không có đối tác"}</p>
                        <p className="text-xs text-muted-foreground">
                          Đến hạn {new Date(debt.due_date ?? "").toLocaleDateString("vi-VN")} · {debt.direction === "lend" ? "Cho vay" : "Đi vay"}
                        </p>
                      </div>
                      <p className="text-right text-sm font-semibold text-foreground">
                        {formatNumber(debt.outstanding ?? debt.principal_amount, 0)} {debt.currency ?? defaultCurrency}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-muted-foreground">Không có khoản đến hạn.</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white/90 shadow-sm ring-1 ring-black/5">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Trading
            </CardTitle>
            <CardDescription>PnL và funding gần đây.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/trading/orders">Orders</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/trading/funding">Funding</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">PnL tháng này</p>
              <p className={`mt-1 text-2xl font-semibold ${pnlThisMonth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {pnlThisMonth >= 0 ? "+" : ""}
                {formatNumber(pnlThisMonth, 2)} <span className="text-base font-normal text-muted-foreground">USD</span>
              </p>
              <p className="text-xs text-muted-foreground">{closedThisMonth.length} lệnh đã đóng</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Open orders</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{openOrders.length}</p>
              <p className="text-xs text-muted-foreground">Chờ đóng</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Funding net</p>
              <p className={`mt-1 text-2xl font-semibold ${fundingNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fundingNet >= 0 ? "+" : ""}
                {formatNumber(fundingNet, 0)} <span className="text-base font-normal text-muted-foreground">USD</span>
              </p>
              <p className="text-xs text-muted-foreground">Withdraw - Deposit</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tổng lệnh theo tháng</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{orders.length}</p>
              <p className="text-xs text-muted-foreground">Đã ghi nhận tháng này</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Lệnh mới nhất</p>
            <div className="divide-y rounded-lg border bg-white">
              {latestOrders.length ? (
                latestOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {order.symbol} · {order.side.toUpperCase()} · {formatNumber(order.volume, 2)} lot
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mở {new Date(order.open_time).toLocaleString("vi-VN")} · {order.status}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${Number(order.pnl_amount ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {Number(order.pnl_amount ?? 0) >= 0 ? "+" : ""}
                      {formatNumber(order.pnl_amount ?? 0, 2)} USD
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">Chưa có lệnh nào trong tháng.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
