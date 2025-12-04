"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PartnerForm } from "./PartnerForm";
import {
  PartnerTransactionFormDialog,
  type AccountOption,
  type CategoryOption,
  type PartnerOption,
} from "./PartnerTransactionFormDialog";

type Partner = {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  note: string | null;
  created_at: string | null;
};

type Balance = {
  total_lent: number | null;
  total_borrowed: number | null;
  total_receive: number | null;
  total_repay: number | null;
  balance: number | null;
};

type PartnerTransactionRow = {
  id: string;
  direction: "lend" | "borrow" | "repay" | "receive";
  amount: number;
  principal_amount: number | null;
  interest_amount: number | null;
  date: string;
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

type Props = {
  partner: Partner;
  balance: Balance | null;
  transactions: PartnerTransactionRow[];
  accounts: Array<AccountOption & { is_default?: boolean | null }>;
  categories: CategoryOption[];
  defaultCurrency: string;
};

const formatNumber = (value?: number | null, fractionDigits = 0) =>
  Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const directionDisplay: Record<PartnerTransactionRow["direction"], { label: string; tone: string }> = {
  lend: { label: "Cho vay", tone: "bg-emerald-50 text-emerald-700" },
  borrow: { label: "Đi vay", tone: "bg-amber-50 text-amber-700" },
  repay: { label: "Tôi trả", tone: "bg-blue-50 text-blue-700" },
  receive: { label: "Họ trả", tone: "bg-purple-50 text-purple-700" },
};

export function PartnerDetailPageClient({ partner, balance, transactions, accounts, categories, defaultCurrency }: Props) {
  const [showEdit, setShowEdit] = useState(false);

  const totals = useMemo(() => {
    const totalLent = Number(balance?.total_lent ?? 0);
    const totalBorrowed = Number(balance?.total_borrowed ?? 0);
    const totalReceive = Number(balance?.total_receive ?? 0);
    const totalRepay = Number(balance?.total_repay ?? 0);
    const theyOwe = Math.max(totalLent - totalReceive, 0);
    const iOwe = Math.max(totalBorrowed - totalRepay, 0);
    const net = Number(balance?.balance ?? theyOwe - iOwe);
    return { totalLent, totalBorrowed, totalReceive, totalRepay, theyOwe, iOwe, net };
  }, [balance]);

  const partnerOptions: PartnerOption[] = [{ id: partner.id, name: partner.name }];
  const accountOptions: AccountOption[] = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tổng hợp giao dịch với đối tác</p>
          <h1 className="text-2xl font-semibold">{partner.name}</h1>
          <p className="text-sm text-muted-foreground">{partner.type || "Chưa phân loại"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PartnerTransactionFormDialog
            partners={partnerOptions}
            accounts={accountOptions}
            categories={categories}
            defaultCurrency={defaultCurrency}
            defaultPartnerId={partner.id}
            presetDirection="lend"
            trigger={<Button size="sm">Cho vay</Button>}
          />
          <PartnerTransactionFormDialog
            partners={partnerOptions}
            accounts={accountOptions}
            categories={categories}
            defaultCurrency={defaultCurrency}
            defaultPartnerId={partner.id}
            presetDirection="borrow"
            trigger={<Button size="sm" variant="secondary">Đi vay</Button>}
          />
          <PartnerTransactionFormDialog
            partners={partnerOptions}
            accounts={accountOptions}
            categories={categories}
            defaultCurrency={defaultCurrency}
            defaultPartnerId={partner.id}
            presetDirection="receive"
            trigger={<Button size="sm" variant="outline">Nhận trả</Button>}
          />
          <PartnerTransactionFormDialog
            partners={partnerOptions}
            accounts={accountOptions}
            categories={categories}
            defaultCurrency={defaultCurrency}
            defaultPartnerId={partner.id}
            presetDirection="repay"
            trigger={<Button size="sm" variant="ghost">Tôi trả</Button>}
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/partners">Quay lại danh sách</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trạng thái tiền</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Họ nợ tôi</p>
            <p className="text-2xl font-semibold text-emerald-700">{formatNumber(totals.theyOwe)} {defaultCurrency}</p>
            <p className="text-xs text-muted-foreground">Đã cho vay {formatNumber(totals.totalLent)} · Đã nhận {formatNumber(totals.totalReceive)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tôi nợ họ</p>
            <p className="text-2xl font-semibold text-amber-700">{formatNumber(totals.iOwe)} {defaultCurrency}</p>
            <p className="text-xs text-muted-foreground">Đã vay {formatNumber(totals.totalBorrowed)} · Đã trả {formatNumber(totals.totalRepay)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net balance</p>
            <p className={`text-2xl font-semibold ${totals.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatNumber(totals.net)} {defaultCurrency}
            </p>
            <p className="text-xs text-muted-foreground">Dương: họ còn nợ tôi · Âm: tôi còn nợ họ</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Thông tin đối tác</CardTitle>
            <p className="text-sm text-muted-foreground">Chỉnh sửa để giữ thông tin liên hệ đầy đủ.</p>
          </div>
          <Button variant="outline" onClick={() => setShowEdit((v) => !v)}>
            {showEdit ? "Đóng form" : "Sửa thông tin"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showEdit ? (
            <PartnerForm
              partner={{
                id: partner.id,
                name: partner.name,
                type: partner.type,
                phone: partner.phone,
                note: partner.note,
              }}
              onSaved={() => setShowEdit(false)}
              onCancel={() => setShowEdit(false)}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Liên hệ</p>
                <p className="text-sm font-semibold">{partner.phone || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ghi chú</p>
                <p className="text-sm text-muted-foreground">{partner.note || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử giao dịch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Cashflow</TableHead>
                  <TableHead>Gốc/Lãi</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Chưa có giao dịch nào với đối tác này.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${directionDisplay[tx.direction].tone}`}>
                          {directionDisplay[tx.direction].label}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDateTime(tx.date)}</TableCell>
                      <TableCell className="space-y-1 text-sm">
                        {tx.transaction ? (
                          <>
                            <p className={tx.transaction.type === "income" ? "text-emerald-700" : "text-red-600"}>
                              {tx.transaction.type === "income" ? "+" : "-"}
                              {formatNumber(tx.transaction.amount)} {tx.transaction.currency}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tx.transaction.account?.name ? `${tx.transaction.account.name} · ${tx.transaction.account.currency || ""}` : "Không gắn tài khoản"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tx.transaction.category?.name ?? "Không phân loại"}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Không tìm thấy bản ghi cashflow</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p>Gốc: {formatNumber(tx.principal_amount)}</p>
                        <p>Lãi: {formatNumber(tx.interest_amount)}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                        {tx.note || tx.transaction?.note || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatNumber(tx.amount)} {tx.transaction?.currency ?? defaultCurrency}
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
