import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DebtPaymentForm } from "../_components/DebtPaymentForm";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  payment_type: "disbursement" | "repayment" | "receive";
  amount: number;
  principal_amount: number | null;
  interest_amount: number | null;
  payment_date: string;
  note: string | null;
  transaction: {
    id: string;
    type: "income" | "expense";
    amount: number;
    currency: string;
    transaction_time: string;
    note: string | null;
    account: { id: string; name: string | null; currency: string | null } | null;
    category: { id: string; name: string | null; type: "income" | "expense" | null } | null;
  } | null;
};

type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" };

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

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const debtId = resolvedParams?.id;
  if (!debtId) return notFound();
  const user = await requireUser();
  const supabase = await createClient();

  const debtPromise = supabase
    .from("debts")
    .select(
      "id,partner_id,direction,principal_amount,currency,start_date,due_date,status,description,interest_type,interest_rate,interest_cycle,created_at,updated_at,partner:partners(id,name,type,phone,note)"
    )
    .eq("id", debtId)
    .eq("user_id", user.id)
    .maybeSingle();

  const paymentsPromise = supabase
    .from("debt_payments")
    .select(
      "id,payment_type,amount,principal_amount,interest_amount,payment_date,note,transaction:transactions(id,type,amount,currency,transaction_time,note,account:accounts(id,name,currency),category:categories(id,name,type))"
    )
    .eq("debt_id", debtId)
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false });

  const accountsPromise = supabase
    .from("accounts")
    .select("id,name,type,currency,is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  const categoriesPromise = supabase.from("categories").select("id,name,type").eq("user_id", user.id);

  const [{ data: debt, error: debtError }, { data: payments, error: paymentsError }, accountsRes, categoriesRes] = await Promise.all([
    debtPromise,
    paymentsPromise,
    accountsPromise,
    categoriesPromise,
  ]);

  if (debtError) throw debtError;
  if (!debt) return notFound();
  if (paymentsError) throw paymentsError;

  const paymentRows: PaymentRow[] = (payments ?? []) as PaymentRow[];
  const accounts: Account[] = accountsRes.data ?? [];
  const categories: Category[] = categoriesRes.data ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const remainingPrincipal = computeOutstanding(debt.direction as "lend" | "borrow", debt.principal_amount, paymentRows);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Chi tiết khoản {debt.direction === "lend" ? "cho vay" : "đi vay"}</p>
          <h1 className="text-2xl font-semibold">{debt.partner?.name ?? "Không rõ đối tác"}</h1>
          <p className="text-sm text-muted-foreground">Bắt đầu {new Date(debt.start_date).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{debt.direction === "lend" ? "Cho vay" : "Đi vay"}</Badge>
          <Badge>{debt.status}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/debts">Quay lại danh sách</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin chính</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Gốc ban đầu</p>
              <p className="text-lg font-semibold">
                {debt.principal_amount.toLocaleString()} {debt.currency}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Còn lại</p>
              <p className="text-lg font-semibold">
                {remainingPrincipal.toLocaleString()} {debt.currency}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Bắt đầu</p>
              <p className="text-sm font-medium">{new Date(debt.start_date).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Đến hạn</p>
              <p className="text-sm font-medium">{debt.due_date ? new Date(debt.due_date).toLocaleDateString() : "Không"}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Chi tiết lãi suất</p>
            <p className="text-sm text-muted-foreground">
              Loại: {debt.interest_type}
              {debt.interest_rate ? ` · ${debt.interest_rate}${debt.interest_type === "percent" ? "%" : ""}` : ""}
              {debt.interest_cycle ? ` / ${debt.interest_cycle}` : ""}
            </p>
            <p className="text-sm font-semibold">Ghi chú</p>
            <p className="text-sm text-muted-foreground">{debt.description || "—"}</p>
            <p className="text-sm font-semibold">Liên hệ</p>
            <p className="text-sm text-muted-foreground">{debt.partner?.phone ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <DebtPaymentForm
        debtId={debt.id}
        direction={debt.direction as "lend" | "borrow"}
        currency={debt.currency}
        defaultAccountId={defaultAccount?.id}
        accounts={accounts}
        categories={categories}
        remainingPrincipal={remainingPrincipal}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">Gốc</TableHead>
                  <TableHead className="text-right">Lãi</TableHead>
                  <TableHead>Cashflow</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Chưa có giao dịch nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Badge variant={p.payment_type === "disbursement" ? "secondary" : "default"}>{p.payment_type}</Badge>
                      </TableCell>
                      <TableCell>{new Date(p.payment_date).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {p.amount.toLocaleString()} {p.transaction?.currency ?? debt.currency}
                      </TableCell>
                      <TableCell className="text-right">{(p.principal_amount ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(p.interest_amount ?? 0).toLocaleString()}</TableCell>
                      <TableCell>
                        {p.transaction ? (
                          <div className="text-sm">
                            <div className="font-semibold">{p.transaction.type}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.transaction.account?.name ?? "—"} {p.transaction.category?.name ? `· ${p.transaction.category?.name}` : ""}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px] whitespace-pre-wrap text-sm text-muted-foreground">
                        {p.note || p.transaction?.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
