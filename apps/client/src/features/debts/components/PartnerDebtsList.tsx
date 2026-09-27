import { useMemo, useState } from "react";
import { type DebtRow, type Partner } from "@/hooks/useDebtsData";
import { type PartnerDebtSummary } from "./PartnerDebtsDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Phone,
  Search,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  debts: DebtRow[];
  partners: Partner[];
  onSelectPartner: (partner: PartnerDebtSummary) => void;
  currency?: string;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

export function groupDebtsByPartner(
  debts: DebtRow[],
  partners: Partner[]
): PartnerDebtSummary[] {
  const partnerMap = new Map<string, PartnerDebtSummary>();

  // 1. Initialize from partners list
  partners.forEach((p) => {
    partnerMap.set(p.id, {
      partnerId: p.id,
      partnerName: p.name,
      partnerType: p.type ?? null,
      phone: p.phone ?? null,
      note: p.note ?? null,
      partner: p,
      totalLendOutstanding: 0,
      totalBorrowOutstanding: 0,
      netBalance: 0,
      totalLendOriginal: 0,
      totalBorrowOriginal: 0,
      debts: [],
      activeDebtsCount: 0,
      settledDebtsCount: 0,
      hasOverdue: false,
      lastActivityDate: null,
    });
  });

  // 2. Distribute debts into partners
  debts.forEach((debt) => {
    const pId = debt.partner_id || debt.partner?.id || "unassigned";
    let summary = partnerMap.get(pId);

    if (!summary) {
      const name = debt.partner?.name || (debt.partner_id ? "Đối tác #" + debt.partner_id.slice(0, 6) : "Không xác định");
      summary = {
        partnerId: pId,
        partnerName: name,
        partnerType: debt.partner?.type ?? null,
        phone: debt.partner?.phone ?? null,
        note: debt.partner?.note ?? null,
        partner: debt.partner ?? null,
        totalLendOutstanding: 0,
        totalBorrowOutstanding: 0,
        netBalance: 0,
        totalLendOriginal: 0,
        totalBorrowOriginal: 0,
        debts: [],
        activeDebtsCount: 0,
        settledDebtsCount: 0,
        hasOverdue: false,
        lastActivityDate: null,
      };
      partnerMap.set(pId, summary);
    }

    summary.debts.push(debt);

    const isLend = debt.direction === "lend";
    const remaining = debt.outstanding_principal ?? debt.principal_amount ?? 0;
    const isPaidOff = debt.status === "paid_off" || remaining === 0;

    if (isLend) {
      summary.totalLendOriginal += debt.principal_amount;
      if (!isPaidOff) {
        summary.totalLendOutstanding += remaining;
        summary.activeDebtsCount += 1;
      } else {
        summary.settledDebtsCount += 1;
      }
    } else {
      summary.totalBorrowOriginal += debt.principal_amount;
      if (!isPaidOff) {
        summary.totalBorrowOutstanding += remaining;
        summary.activeDebtsCount += 1;
      } else {
        summary.settledDebtsCount += 1;
      }
    }

    if (
      debt.status === "overdue" ||
      (debt.due_date && new Date(debt.due_date).getTime() < Date.now() && !isPaidOff)
    ) {
      summary.hasOverdue = true;
    }

    const debtDate = debt.created_at || debt.start_date;
    if (debtDate) {
      if (!summary.lastActivityDate || new Date(debtDate) > new Date(summary.lastActivityDate)) {
        summary.lastActivityDate = debtDate;
      }
    }
  });

  // Calculate net balances and sort
  const result = Array.from(partnerMap.values()).map((s) => ({
    ...s,
    netBalance: s.totalLendOutstanding - s.totalBorrowOutstanding,
  }));

  // Sort: active debts first, overdue first, then by highest outstanding balance
  result.sort((a, b) => {
    if (a.hasOverdue && !b.hasOverdue) return -1;
    if (!a.hasOverdue && b.hasOverdue) return 1;

    const totalA = a.totalLendOutstanding + a.totalBorrowOutstanding;
    const totalB = b.totalLendOutstanding + b.totalBorrowOutstanding;

    if (totalA > 0 && totalB === 0) return -1;
    if (totalA === 0 && totalB > 0) return 1;

    if (totalA !== totalB) return totalB - totalA;
    return a.partnerName.localeCompare(b.partnerName);
  });

  return result;
}

export function PartnerDebtsList({
  debts,
  partners,
  onSelectPartner,
  currency = "VND",
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "lending" | "borrowing" | "settled">("all");
  const [sortBy, setSortBy] = useState<"balance" | "name" | "recent">("balance");

  const partnerSummaries = useMemo(() => {
    return groupDebtsByPartner(debts, partners);
  }, [debts, partners]);

  const filteredSummaries = useMemo(() => {
    let list = partnerSummaries;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.partnerName.toLowerCase().includes(q) ||
          p.partnerType?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q)
      );
    }

    // Tab filter
    if (filterTab === "lending") {
      list = list.filter((p) => p.totalLendOutstanding > 0);
    } else if (filterTab === "borrowing") {
      list = list.filter((p) => p.totalBorrowOutstanding > 0);
    } else if (filterTab === "settled") {
      list = list.filter((p) => p.totalLendOutstanding === 0 && p.totalBorrowOutstanding === 0);
    }

    // Sort
    if (sortBy === "name") {
      return [...list].sort((a, b) => a.partnerName.localeCompare(b.partnerName));
    }
    if (sortBy === "recent") {
      return [...list].sort((a, b) => {
        const timeA = a.lastActivityDate ? new Date(a.lastActivityDate).getTime() : 0;
        const timeB = b.lastActivityDate ? new Date(b.lastActivityDate).getTime() : 0;
        return timeB - timeA;
      });
    }

    // Default: balance
    return list;
  }, [partnerSummaries, searchTerm, filterTab, sortBy]);

  const lendingCount = useMemo(
    () => partnerSummaries.filter((p) => p.totalLendOutstanding > 0).length,
    [partnerSummaries]
  );
  const borrowingCount = useMemo(
    () => partnerSummaries.filter((p) => p.totalBorrowOutstanding > 0).length,
    [partnerSummaries]
  );
  const settledCount = useMemo(
    () => partnerSummaries.filter((p) => p.totalLendOutstanding === 0 && p.totalBorrowOutstanding === 0).length,
    [partnerSummaries]
  );

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên người, tổ chức, số điện thoại..."
            className="h-9 rounded-xl border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs sm:text-sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-xs font-semibold transition active:scale-95",
              filterTab === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            )}
          >
            Tất cả ({partnerSummaries.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("lending")}
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-xs font-semibold transition active:scale-95",
              filterTab === "lending"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            )}
          >
            Họ nợ mình ({lendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("borrowing")}
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-xs font-semibold transition active:scale-95",
              filterTab === "borrowing"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            )}
          >
            Mình nợ họ ({borrowingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("settled")}
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-xs font-semibold transition active:scale-95",
              filterTab === "settled"
                ? "bg-slate-700 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            )}
          >
            Đã xong ({settledCount})
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 pl-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "balance" | "name" | "recent")}
              className="h-7 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:ring-1 focus:ring-slate-300"
            >
              <option value="balance">Dư nợ cao nhất</option>
              <option value="recent">Mới nhất</option>
              <option value="name">Tên A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Partners List */}
      {filteredSummaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <Users className="h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">Không tìm thấy người/tổ chức phù hợp</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Hãy thử tìm bằng từ khóa khác hoặc tạo thêm khoản vay mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredSummaries.map((partner) => {
            const isBusiness =
              partner.partnerType?.toLowerCase().includes("doanh nghiệp") ||
              partner.partnerType?.toLowerCase().includes("công ty") ||
              partner.partnerType?.toLowerCase().includes("ngân hàng");

            const isNetLending = partner.netBalance > 0;
            const isNetBorrowing = partner.netBalance < 0;

            const initials = partner.partnerName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={partner.partnerId}
                onClick={() => onSelectPartner(partner)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectPartner(partner);
                  }
                }}
                className={cn(
                  "group relative flex flex-col justify-between rounded-3xl border bg-white p-4 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md active:scale-[0.99] cursor-pointer",
                  partner.hasOverdue
                    ? "border-rose-300 ring-2 ring-rose-400/10"
                    : "border-slate-200/90"
                )}
              >
                {/* Top: Avatar, Name, Type, and Net Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-2xs transition-transform group-hover:scale-105",
                        isNetLending
                          ? "bg-emerald-100 text-emerald-800"
                          : isNetBorrowing
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {isBusiness ? <Building2 className="h-5 w-5" /> : initials || <User className="h-5 w-5" />}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                          {partner.partnerName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                        <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-semibold">
                          {partner.partnerType || "Cá nhân"}
                        </Badge>
                        {partner.phone && (
                          <span className="flex items-center gap-0.5 text-slate-500">
                            <Phone className="h-2.5 w-2.5 text-slate-400" />
                            <span>{partner.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overdue Badge or Active count */}
                  <div>
                    {partner.hasOverdue ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        <ShieldAlert className="h-3 w-3" /> Quá hạn
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {partner.debts.length} khoản
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: 2-side breakdown */}
                <div className="my-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50/80 p-2.5 text-xs">
                  {/* Cho vay */}
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-emerald-800 flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-emerald-600" /> Cho vay
                    </span>
                    <p className="money-blur font-bold text-slate-900 mt-0.5">
                      {formatCurrency(partner.totalLendOutstanding)} {currency}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {partner.debts.filter((d) => d.direction === "lend" && d.status !== "paid_off").length} khoản nợ
                    </span>
                  </div>

                  {/* Đi vay */}
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-rose-800 flex items-center gap-1">
                      <ArrowDownLeft className="h-3 w-3 text-rose-600" /> Đi vay
                    </span>
                    <p className="money-blur font-bold text-slate-900 mt-0.5">
                      {formatCurrency(partner.totalBorrowOutstanding)} {currency}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {partner.debts.filter((d) => d.direction === "borrow" && d.status !== "paid_off").length} khoản nợ
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Net Position + View Details trigger */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500">Vị thế ròng:</span>
                    <span
                      className={cn(
                        "money-blur text-xs sm:text-sm font-bold",
                        isNetLending ? "text-emerald-600" : isNetBorrowing ? "text-rose-600" : "text-slate-600"
                      )}
                    >
                      {isNetLending ? "+" : isNetBorrowing ? "-" : ""}
                      {formatCurrency(Math.abs(partner.netBalance))} {currency}
                    </span>
                  </div>

                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Chi tiết</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
