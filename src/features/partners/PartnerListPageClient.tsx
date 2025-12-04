"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartnerForm } from "./PartnerForm";
import {
  PartnerTransactionFormDialog,
  type AccountOption,
  type CategoryOption,
  type PartnerOption,
} from "./PartnerTransactionFormDialog";

type PartnerBalance = {
  total_lent: number | null;
  total_borrowed: number | null;
  total_receive: number | null;
  total_repay: number | null;
  balance: number | null;
};

type PartnerRow = {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  note: string | null;
  created_at: string | null;
  balance: PartnerBalance | null;
};

type Props = {
  partners: PartnerRow[];
  accounts: Array<AccountOption & { is_default?: boolean | null }>;
  categories: CategoryOption[];
  defaultCurrency: string;
};

const formatNumber = (value?: number | null, fractionDigits = 0) =>
  Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });

const computeSides = (balance: PartnerBalance | null) => {
  const totalLent = Number(balance?.total_lent ?? 0);
  const totalBorrowed = Number(balance?.total_borrowed ?? 0);
  const totalReceive = Number(balance?.total_receive ?? 0);
  const totalRepay = Number(balance?.total_repay ?? 0);
  const theyOwe = Math.max(totalLent - totalReceive, 0);
  const iOwe = Math.max(totalBorrowed - totalRepay, 0);
  const net = Number(balance?.balance ?? theyOwe - iOwe);
  return { theyOwe, iOwe, net, totalLent, totalBorrowed };
};

export function PartnerListPageClient({ partners, accounts, categories, defaultCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"balance" | "name" | "recent">("balance");
  const [showCreate, setShowCreate] = useState(false);

  const enhanced = useMemo(() => {
    return partners.map((p) => {
      const sides = computeSides(p.balance);
      return { ...p, ...sides };
    });
  }, [partners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? enhanced.filter((p) => p.name.toLowerCase().includes(q)) : enhanced;
    const sorted = [...base];
    if (sort === "balance") {
      sorted.sort((a, b) => b.net - a.net);
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
    }
    return sorted;
  }, [enhanced, search, sort]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, p) => {
        acc.theyOwe += p.theyOwe;
        acc.iOwe += p.iOwe;
        acc.net += p.net;
        return acc;
      },
      { theyOwe: 0, iOwe: 0, net: 0 }
    );
  }, [filtered]);

  const partnerOptions: PartnerOption[] = partners.map((p) => ({ id: p.id, name: p.name }));
  const accountOptions: AccountOption[] = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Quản lý mọi dòng tiền theo từng đối tác</p>
          <h1 className="text-2xl font-semibold">Money by Partner</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PartnerTransactionFormDialog
            partners={partnerOptions}
            accounts={accountOptions}
            categories={categories}
            defaultCurrency={defaultCurrency}
            trigger={<Button>Thêm giao dịch</Button>}
          />
          <Button variant="outline" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Ẩn form đối tác" : "Thêm đối tác"}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle>Tổng quan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Họ nợ tôi</p>
            <p className="text-2xl font-semibold">{formatNumber(totals.theyOwe)} {defaultCurrency}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tôi nợ họ</p>
            <p className="text-2xl font-semibold">{formatNumber(totals.iOwe)} {defaultCurrency}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net balance</p>
            <p className={`text-2xl font-semibold ${totals.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatNumber(totals.net)} {defaultCurrency}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="h-full rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Đối tác</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Tìm theo tên"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-[220px]"
                />
                <Select value={sort} onValueChange={(v: typeof sort) => setSort(v)}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balance">Balance giảm dần</SelectItem>
                    <SelectItem value="name">Tên</SelectItem>
                    <SelectItem value="recent">Mới nhất</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đối tác hoặc không khớp tìm kiếm.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.type || "Chưa phân loại"}
                          {p.phone ? ` · ${p.phone}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Net {formatNumber(p.net)} {defaultCurrency}</Badge>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/partners/${p.id}`}>Xem chi tiết</Link>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-md bg-emerald-50 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-emerald-700">Họ nợ tôi</p>
                        <p className="text-lg font-semibold text-emerald-700">{formatNumber(p.theyOwe)} {defaultCurrency}</p>
                      </div>
                      <div className="rounded-md bg-amber-50 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-amber-700">Tôi nợ họ</p>
                        <p className="text-lg font-semibold text-amber-700">{formatNumber(p.iOwe)} {defaultCurrency}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Tổng vay/cho vay</p>
                        <p className="text-sm font-semibold">{formatNumber(p.totalBorrowed)} / {formatNumber(p.totalLent)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <PartnerTransactionFormDialog
                        partners={partnerOptions}
                        accounts={accountOptions}
                        categories={categories}
                        defaultCurrency={defaultCurrency}
                        defaultPartnerId={p.id}
                        presetDirection="lend"
                        trigger={<Button size="sm">Cho vay</Button>}
                      />
                      <PartnerTransactionFormDialog
                        partners={partnerOptions}
                        accounts={accountOptions}
                        categories={categories}
                        defaultCurrency={defaultCurrency}
                        defaultPartnerId={p.id}
                        presetDirection="borrow"
                        trigger={<Button size="sm" variant="secondary">Đi vay</Button>}
                      />
                      <PartnerTransactionFormDialog
                        partners={partnerOptions}
                        accounts={accountOptions}
                        categories={categories}
                        defaultCurrency={defaultCurrency}
                        defaultPartnerId={p.id}
                        presetDirection="receive"
                        trigger={<Button size="sm" variant="outline">Nhận trả</Button>}
                      />
                      <PartnerTransactionFormDialog
                        partners={partnerOptions}
                        accounts={accountOptions}
                        categories={categories}
                        defaultCurrency={defaultCurrency}
                        defaultPartnerId={p.id}
                        presetDirection="repay"
                        trigger={<Button size="sm" variant="ghost">Tôi trả</Button>}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{showCreate ? "Thêm/ sửa đối tác" : "Quản lý đối tác"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tạo mới hoặc chỉnh sửa thông tin đối tác để mọi giao dịch được gắn chính xác.
            </p>
            {showCreate ? (
              <PartnerForm
                onSaved={() => {
                  setShowCreate(false);
                }}
                onCancel={() => setShowCreate(false)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nhấn "Thêm đối tác" để mở form.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
