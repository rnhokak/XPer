"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { OrderRow } from "./page";
import { orderFormSchema, type OrderFormValues } from "@/lib/validation/trading";
import { Percent, TrendingDown, TrendingUp } from "lucide-react";
import { useNotificationsStore } from "@/store/notifications";

interface OrdersPageClientProps {
  initialOrders: OrderRow[];
  tradingAccounts: {
    balance_account_id: string;
    name: string;
    currency: string;
    broker: string | null;
    platform: string | null;
    account_number: string | null;
    is_demo: boolean | null;
  }[];
}

type StatusFilter = "all" | "open" | "closed" | "cancelled";

const defaultDateTimeValue = () => new Date().toISOString().slice(0, 16);
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");
const toInputDateTime = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 16) : "");
const PAGE_SIZE = 50;

const formatNumber = (value?: number | null, fractionDigits = 2) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits });

const getOrderCommission = (order: OrderRow) => Number(order.commission_usd ?? 0) + Number(order.swap_usd ?? 0);
const getOrderNetPnl = (order: OrderRow) => Number(order.pnl_amount ?? 0) + getOrderCommission(order);

type ChartPoint = { label: string; value: number };
type PnlPoint = { label: string; win: number; loss: number };
type PeriodSummary = {
  label: string;
  pnl: number;
  wins: number;
  losses: number;
  winAmount: number;
  loseAmount: number;
  winRate: number;
  commission: number;
};
type WinRateComparison = {
  current: number;
  previous: number;
  label: string;
  prevLabel: string;
};
type PeriodComparison = {
  current: PeriodSummary;
  previous: PeriodSummary;
};

const localDateLabel = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local TZ

const startOfWeekMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Build daily series for the last N days anchored to today (local time).
const buildLastNDaysSeries = (
  orders: OrderRow[],
  dateKeys: Array<"open_time" | "close_time">,
  valueSelector: (o: OrderRow) => number,
  days = 7
) => {
  const anchor = new Date(); // always use today as anchor

  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    labels.push(localDateLabel(d));
  }

  const map = new Map<string, number>(labels.map((label) => [label, 0]));

  orders.forEach((order) => {
    const rawDate = dateKeys.map((key) => order[key]).find(Boolean);
    if (!rawDate) return;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return;
    const label = localDateLabel(d);
    if (!map.has(label)) return;
    map.set(label, (map.get(label) ?? 0) + valueSelector(order));
  });

  return labels.map((label) => ({ label, value: map.get(label) ?? 0 }));
};

const buildLastNDaysPnlSeries = (
  orders: OrderRow[],
  dateKeys: Array<"open_time" | "close_time">,
  days = 7
): PnlPoint[] => {
  const anchor = new Date(); // always anchor to today
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    labels.push(localDateLabel(d));
  }
  const map = new Map<string, { win: number; loss: number }>(
    labels.map((label) => [label, { win: 0, loss: 0 }])
  );

  orders.forEach((order) => {
    const rawDate = dateKeys.map((key) => order[key]).find(Boolean);
    if (!rawDate) return;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return;
    const label = localDateLabel(d);
    if (!map.has(label)) return;
    const pnl = getOrderNetPnl(order);
    const current = map.get(label)!;
    if (pnl >= 0) {
      current.win += pnl;
    } else {
      current.loss += Math.abs(pnl);
    }
  });

  return labels.map((label) => {
    const entry = map.get(label) ?? { win: 0, loss: 0 };
    return { label, win: entry.win, loss: entry.loss };
  });
};

const getDateFromOrder = (order: OrderRow, keys: Array<"open_time" | "close_time">) => {
  const rawDate = keys.map((k) => order[k]).find(Boolean);
  if (!rawDate) return null;
  const d = new Date(rawDate);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getPeriodSummaries = (orders: OrderRow[], keys: Array<"open_time" | "close_time">): Record<"day" | "week" | "month", PeriodSummary> => {
  const anchor = new Date();

  const sameDay = (d: Date) =>
    d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth() && d.getDate() === anchor.getDate();
  const getWeekNumber = (d: Date) => {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };
  const anchorWeek = getWeekNumber(anchor);
  const anchorYear = anchor.getFullYear();
  const sameWeek = (d: Date) => d.getFullYear() === anchorYear && getWeekNumber(d) === anchorWeek;
  const sameMonth = (d: Date) => d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth();

  const summarize = (predicate: (d: Date) => boolean, label: string): PeriodSummary => {
    let pnl = 0;
    let wins = 0;
    let losses = 0;
    let winAmount = 0;
    let loseAmount = 0;
    let commission = 0;
    orders.forEach((order) => {
      const d = getDateFromOrder(order, keys);
      if (!d || !predicate(d)) return;
      const val = getOrderNetPnl(order);
      commission += getOrderCommission(order);
      pnl += val;
      if (val > 0) wins += 1;
      if (val < 0) losses += 1;
      if (val > 0) winAmount += val;
      if (val < 0) loseAmount += Math.abs(val);
    });
    const totalTrades = wins + losses;
    const winRate = totalTrades === 0 ? 0 : Math.round((wins / totalTrades) * 100);
    return { label, pnl, wins, losses, winAmount, loseAmount, winRate, commission };
  };

  return {
    day: summarize(sameDay, anchor.toLocaleDateString()),
    week: summarize(sameWeek, `Week ${anchorWeek} ${anchorYear}`),
    month: summarize(sameMonth, anchor.toLocaleString("default", { month: "short", year: "numeric" })),
  };
};

const summarizeRange = (orders: OrderRow[], keys: Array<"open_time" | "close_time">, start: Date, end: Date): PeriodSummary => {
  let pnl = 0;
  let wins = 0;
  let losses = 0;
  let winAmount = 0;
  let loseAmount = 0;
  let commission = 0;

  orders.forEach((order) => {
    const d = getDateFromOrder(order, keys);
    if (!d || d < start || d >= end) return;
    const val = getOrderNetPnl(order);
    commission += getOrderCommission(order);
    pnl += val;
    if (val > 0) {
      wins += 1;
      winAmount += val;
    } else if (val < 0) {
      losses += 1;
      loseAmount += Math.abs(val);
    }
  });
  const total = wins + losses;
  const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);

  return {
    label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    pnl,
    wins,
    losses,
    winAmount,
    loseAmount,
    winRate,
    commission,
  };
};

const getPeriodComparisons = (
  orders: OrderRow[],
  keys: Array<"open_time" | "close_time">
): Record<"day" | "week" | "month", PeriodComparison> => {
  const anchor = new Date();

  // Day
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const prevDayStart = new Date(dayStart);
  prevDayStart.setDate(prevDayStart.getDate() - 1);
  const prevDayEnd = new Date(dayStart);

  // Week (Monday start)
  const weekStart = startOfWeekMonday(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);

  // Month
  const monthStart = startOfMonth(anchor);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const prevMonthEnd = new Date(monthStart);

  return {
    day: {
      current: summarizeRange(orders, keys, dayStart, dayEnd),
      previous: summarizeRange(orders, keys, prevDayStart, prevDayEnd),
    },
    week: {
      current: summarizeRange(orders, keys, weekStart, weekEnd),
      previous: summarizeRange(orders, keys, prevWeekStart, prevWeekEnd),
    },
    month: {
      current: summarizeRange(orders, keys, monthStart, monthEnd),
      previous: summarizeRange(orders, keys, prevMonthStart, prevMonthEnd),
    },
  };
};

const getWinRateComparison = (orders: OrderRow[], keys: Array<"open_time" | "close_time">, period: "week" | "month"): WinRateComparison => {
  const anchor = new Date();

  const currentStart = period === "week" ? startOfWeekMonday(anchor) : startOfMonth(anchor);
  const currentEnd = new Date(currentStart);
  if (period === "week") {
    currentEnd.setDate(currentStart.getDate() + 7);
  } else {
    currentEnd.setMonth(currentStart.getMonth() + 1);
  }
  const prevStart = new Date(currentStart);
  if (period === "week") {
    prevStart.setDate(currentStart.getDate() - 7);
  } else {
    prevStart.setMonth(currentStart.getMonth() - 1);
  }
  const prevEnd = new Date(currentStart);

  const summarize = (start: Date, end: Date) => {
    let wins = 0;
    let losses = 0;
    orders.forEach((order) => {
      const d = getDateFromOrder(order, keys);
      if (!d || d < start || d >= end) return;
      const val = getOrderNetPnl(order);
      if (val > 0) wins += 1;
      if (val < 0) losses += 1;
    });
    const total = wins + losses;
    return total === 0 ? 0 : Math.round((wins / total) * 100);
  };

  const current = summarize(currentStart, currentEnd);
  const previous = summarize(prevStart, prevEnd);

  const label =
    period === "week"
      ? `${currentStart.toLocaleDateString()} - ${currentEnd.toLocaleDateString()}`
      : currentStart.toLocaleString("default", { month: "short", year: "numeric" });
  const prevLabel =
    period === "week"
      ? `${prevStart.toLocaleDateString()} - ${prevEnd.toLocaleDateString()}`
      : prevStart.toLocaleString("default", { month: "short", year: "numeric" });

  return { current, previous, label, prevLabel };
};

type CsvRow = {
  ticket?: string;
  opening_time_utc?: string;
  closing_time_utc?: string;
  type?: string;
  lots?: string;
  original_position_size?: string;
  symbol?: string;
  opening_price?: string;
  closing_price?: string;
  stop_loss?: string;
  take_profit?: string;
  commission_usd?: string;
  swap_usd?: string;
  profit_usd?: string;
  equity_usd?: string;
  margin_level?: string;
  close_reason?: string;
};

const parseCsv = (text: string): CsvRow[] => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx]?.trim() ?? "";
    });
    return row as CsvRow;
  });
};

const csvRowToOrderPayload = (row: CsvRow, balanceAccountId: string | null): OrderFormValues | null => {
  if (!row.symbol || !row.opening_price || !row.lots || !row.type || !row.opening_time_utc || !balanceAccountId) {
    return null;
  }
  const side = row.type.toLowerCase() === "sell" ? "sell" : "buy";
  const openTime = new Date(row.opening_time_utc);
  const closeTime = row.closing_time_utc ? new Date(row.closing_time_utc) : null;
  const status = closeTime ? "closed" : "open";

  const leverageVal = row.original_position_size ? Number(row.original_position_size) : undefined;
  const leverage = leverageVal !== undefined && Number.isInteger(leverageVal) ? leverageVal : undefined;
  const originalPosSize = row.original_position_size ? Number(row.original_position_size) : undefined;

  return {
    ticket: row.ticket ?? undefined,
    symbol: row.symbol,
    side,
    entry_price: Number(row.opening_price),
    sl_price: row.stop_loss ? Number(row.stop_loss) : undefined,
    tp_price: row.take_profit ? Number(row.take_profit) : undefined,
    volume: Number(row.lots),
    leverage,
    original_position_size: originalPosSize,
    commission_usd: row.commission_usd ? Number(row.commission_usd) : undefined,
    swap_usd: row.swap_usd ? Number(row.swap_usd) : undefined,
    equity_usd: row.equity_usd ? Number(row.equity_usd) : undefined,
    margin_level: row.margin_level ? Number(row.margin_level) : undefined,
    close_reason: row.close_reason ?? undefined,
    status,
    open_time: isNaN(openTime.getTime()) ? "" : openTime.toISOString().slice(0, 16),
    close_time: closeTime && !isNaN(closeTime.getTime()) ? closeTime.toISOString().slice(0, 16) : "",
    close_price: row.closing_price ? Number(row.closing_price) : undefined,
    pnl_amount: row.profit_usd ? Number(row.profit_usd) : undefined,
    pnl_percent: undefined,
    note: undefined,
    balance_account_id: balanceAccountId,
  };
};

const defaultOrderValues = (balanceAccountId?: string): OrderFormValues => ({
  ticket: "",
  symbol: "",
  side: "buy",
  entry_price: 0,
  sl_price: undefined,
  tp_price: undefined,
  volume: 0,
  leverage: undefined,
  original_position_size: undefined,
  commission_usd: undefined,
  swap_usd: undefined,
  equity_usd: undefined,
  margin_level: undefined,
  close_reason: undefined,
  status: "open",
  open_time: defaultDateTimeValue(),
  close_time: "",
  close_price: undefined,
  pnl_amount: undefined,
  pnl_percent: undefined,
  note: undefined,
  balance_account_id: balanceAccountId ?? "",
});

export default function OrdersPageClient({ initialOrders, tradingAccounts }: OrdersPageClientProps) {
  const router = useRouter();
  const notify = useNotificationsStore((state) => state.notify);
  const [activeBalanceAccountId, setActiveBalanceAccountId] = useState(tradingAccounts[0]?.balance_account_id ?? "");
  const [mounted, setMounted] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState<{ symbol: string; status: StatusFilter }>({ symbol: "", status: "all" });
  const [filters, setFilters] = useState<{ symbol: string; status: StatusFilter }>({ symbol: "", status: "all" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [reportPeriod, setReportPeriod] = useState<"day" | "week" | "month">("day");
  const [periodView, setPeriodView] = useState<"current" | "previous">("current");
  const [winRatePeriod, setWinRatePeriod] = useState<"week" | "month">("week");
  const [syncingLedger, setSyncingLedger] = useState(false);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: defaultOrderValues(activeBalanceAccountId),
  });

  const tradingAccountMap = useMemo(() => {
    const map = new Map<string, OrdersPageClientProps["tradingAccounts"][number]>();
    tradingAccounts.forEach((acc) => map.set(acc.balance_account_id, acc));
    return map;
  }, [tradingAccounts]);

  const filteredOrders = useMemo(() => {
    return initialOrders.filter((order) => {
      const matchesSymbol = filters.symbol
        ? order.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
        : true;
      const matchesStatus = filters.status === "all" ? true : order.status === filters.status;
      return matchesSymbol && matchesStatus;
    });
  }, [filters, initialOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!activeBalanceAccountId && tradingAccounts[0]) {
      setActiveBalanceAccountId(tradingAccounts[0].balance_account_id);
      form.setValue("balance_account_id", tradingAccounts[0].balance_account_id);
    }
  }, [activeBalanceAccountId, tradingAccounts, form]);

  useEffect(() => {
    if (editingOrder) return;
    if (activeBalanceAccountId) {
      form.setValue("balance_account_id", activeBalanceAccountId);
    }
  }, [activeBalanceAccountId, editingOrder, form]);

  useEffect(() => {
    setPage(1);
  }, [filters.symbol, filters.status, initialOrders.length]);

  useEffect(() => {
    if (reportPeriod === "week") setWinRatePeriod("week");
    if (reportPeriod === "month") setWinRatePeriod("month");
  }, [reportPeriod]);

  const metrics = useMemo(() => {
    const closedOrders = filteredOrders.filter((o) => o.status === "closed");
    const winCount = closedOrders.filter((o) => getOrderNetPnl(o) > 0).length;
    const closedCount = closedOrders.length;
    const winRate = closedCount === 0 ? 0 : Math.round((winCount / closedCount) * 100);
    const totalPnl = closedOrders.reduce((acc, o) => acc + getOrderNetPnl(o), 0);
    const totalCommission = closedOrders.reduce((acc, o) => acc + getOrderCommission(o), 0);
    const grossPnl = closedOrders.reduce((acc, o) => acc + Number(o.pnl_amount ?? 0), 0);

    const lotsSeries = buildLastNDaysSeries(filteredOrders, ["open_time", "close_time"], (o) => Number(o.volume ?? 0), 7);
    const pnlSeries = buildLastNDaysPnlSeries(closedOrders, ["close_time", "open_time"], 7);
    const periodSummaries = getPeriodSummaries(closedOrders, ["close_time", "open_time"]);
    const winRateComparison = getWinRateComparison(closedOrders, ["close_time", "open_time"], winRatePeriod);
    const periodComparisons = getPeriodComparisons(closedOrders, ["close_time", "open_time"]);

    return {
      winRate,
      closedCount,
      totalPnl,
      totalCommission,
      grossPnl,
      lotsSeries,
      pnlSeries,
      periodSummaries,
      winRateComparison,
      periodComparisons,
    };
  }, [filteredOrders, winRatePeriod]);

  const periodMeta: Record<"day" | "week" | "month", { label: string; description: string; accent: string }> = {
    day: { label: "Ngày", description: "Hôm nay (local time)", accent: "from-emerald-500/10" },
    week: { label: "Tuần", description: "Tuần này (bắt đầu thứ 2)", accent: "from-blue-500/10" },
    month: { label: "Tháng", description: "Tháng này", accent: "from-amber-500/10" },
  };

  const activeComparison = metrics.periodComparisons[reportPeriod];
  const activeSummary = periodView === "current" ? activeComparison.current : activeComparison.previous;
  const activePrevious = periodView === "current" ? activeComparison.previous : activeComparison.current;
  const pnlDelta = activeSummary.pnl - activePrevious.pnl;
  const winRateDelta = activeSummary.winRate - activePrevious.winRate;
  const commissionDelta = activeSummary.commission - activePrevious.commission;
  const totalTrades = activeSummary.wins + activeSummary.losses;
  const prevTrades = activePrevious.wins + activePrevious.losses;
  const tradeDelta = totalTrades - prevTrades;
  const avgPnlPerTrade = totalTrades === 0 ? 0 : activeSummary.pnl / totalTrades;
  const grossTotal = Math.max(1, activeSummary.winAmount + activeSummary.loseAmount);
  const winShare = Math.round((activeSummary.winAmount / grossTotal) * 100);

  useEffect(() => {
    // Debug charts data in console
    console.log("PnL series (7 days)", metrics.pnlSeries);
    console.log("Lots series (7 days)", metrics.lotsSeries);
  }, [metrics.pnlSeries, metrics.lotsSeries]);

  const hasTradingAccounts = tradingAccounts.length > 0;
  const activeAccount = activeBalanceAccountId ? tradingAccountMap.get(activeBalanceAccountId) ?? null : null;
  const getAccountLabel = (order: OrderRow) => {
    const acc = order.balance_account_id ? tradingAccountMap.get(order.balance_account_id) : null;
    if (!acc) return "Unlinked";
    return `${acc.name} (${acc.currency})`;
  };

  const handleLedgerSync = async () => {
    setSyncingLedger(true);
    const res = await fetch("/api/trading/orders/sync-ledger", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify({
        type: "error",
        title: "Sync ledger thất bại",
        description: json.error ?? "Sync failed",
      });
    } else {
      notify({
        type: "success",
        title: "Đã sync ledger",
        description: `Đã sync ${json.synced ?? 0} orders (skipped: ${json.skipped ?? 0}).`,
      });
      router.refresh();
    }
    setSyncingLedger(false);
  };

  if (!mounted) {
    return <div className="text-sm text-muted-foreground">Loading orders…</div>;
  }

  const openNewDialog = () => {
    if (!activeBalanceAccountId) {
      notify({
        type: "error",
        title: "Chưa chọn balance account",
        description: "Chọn Trading balance account trước khi tạo order.",
      });
      return;
    }
    setEditingOrder(null);
    form.reset({
      ...defaultOrderValues(activeBalanceAccountId),
      balance_account_id: activeBalanceAccountId ?? "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (order: OrderRow) => {
    setEditingOrder(order);
    form.reset({
      ticket: order.ticket ?? "",
      symbol: order.symbol,
      side: order.side,
      entry_price: order.entry_price,
      sl_price: order.sl_price ?? undefined,
      tp_price: order.tp_price ?? undefined,
      volume: order.volume,
      leverage: order.leverage ?? undefined,
      original_position_size: order.original_position_size ?? undefined,
      commission_usd: order.commission_usd ?? undefined,
      swap_usd: order.swap_usd ?? undefined,
      equity_usd: order.equity_usd ?? undefined,
      margin_level: order.margin_level ?? undefined,
      close_reason: order.close_reason ?? undefined,
      status: order.status,
      open_time: toInputDateTime(order.open_time),
      close_time: toInputDateTime(order.close_time),
      close_price: order.close_price ?? undefined,
      pnl_amount: order.pnl_amount ?? undefined,
      pnl_percent: order.pnl_percent ?? undefined,
      note: order.note ?? undefined,
      balance_account_id: order.balance_account_id ?? activeBalanceAccountId ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (values: OrderFormValues) => {
    if (!values.balance_account_id) {
      notify({
        type: "error",
        title: "Chưa chọn balance account",
        description: "Chọn balance account trước khi lưu order.",
      });
      return;
    }
    const selectedAccount = tradingAccountMap.get(values.balance_account_id);
    const payload = {
      ...values,
      balance_account_id: values.balance_account_id ?? selectedAccount?.balance_account_id ?? undefined,
      ticket: values.ticket?.trim() || null,
      sl_price: values.sl_price ?? null,
      tp_price: values.tp_price ?? null,
      leverage: values.leverage ?? null,
      close_time: values.close_time ? new Date(values.close_time).toISOString() : null,
      close_price: values.close_price ?? null,
      pnl_amount: values.pnl_amount ?? null,
      pnl_percent: values.pnl_percent ?? null,
      note: values.note?.trim() ? values.note.trim() : null,
      original_position_size: values.original_position_size ?? null,
      commission_usd: values.commission_usd ?? null,
      swap_usd: values.swap_usd ?? null,
      equity_usd: values.equity_usd ?? null,
      margin_level: values.margin_level ?? null,
      close_reason: values.close_reason?.trim() || null,
      open_time: new Date(values.open_time).toISOString(),
    };

    const res = await fetch("/api/trading/orders", {
      method: editingOrder ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingOrder ? { id: editingOrder.id, ...payload } : payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      notify({
        type: "error",
        title: "Lưu order thất bại",
        description: error.error ?? "Failed to save order",
      });
      return;
    }

    notify({
      type: "success",
      title: editingOrder ? "Đã cập nhật order" : "Đã tạo order",
      description: editingOrder ? "Order đã được cập nhật." : "Order mới đã được thêm.",
    });
    form.reset({
      ...defaultOrderValues(activeBalanceAccountId),
      balance_account_id: activeBalanceAccountId ?? "",
    });
    setDialogOpen(false);
    setEditingOrder(null);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch("/api/trading/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      notify({
        type: "error",
        title: "Không xóa được order",
        description: error.error ?? "Failed to delete order",
      });
      setDeleting(false);
      return;
    }
    notify({
      type: "success",
      title: "Đã xóa order",
      description: "Order đã được gỡ khỏi danh sách.",
    });
    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  };

  const handleImport = async () => {
    if (!activeBalanceAccountId) {
      notify({
        type: "error",
        title: "Chưa chọn balance account",
        description: "Chọn balance account để import orders.",
      });
      return;
    }
    if (!importFile) return;
    setImporting(true);

    try {
      const text = await importFile.text();
      const rows = parseCsv(text)
        .map((row) => csvRowToOrderPayload(row, activeBalanceAccountId))
        .filter((r): r is OrderFormValues => Boolean(r));

      if (rows.length === 0) {
        notify({
          type: "error",
          title: "Import thất bại",
          description: "Không tìm thấy dữ liệu hợp lệ trong file CSV.",
        });
        setImporting(false);
        return;
      }

      const res = await fetch("/api/trading/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        notify({
          type: "error",
          title: "Import thất bại",
          description: error.error ?? "Import thất bại",
        });
        setImporting(false);
        return;
      }

      notify({
        type: "success",
        title: "Đã import orders",
        description: `Đã import ${rows.length} orders.`,
      });
      setImportFile(null);
      setImportDialogOpen(false);
      router.refresh();
    } catch (err: any) {
      notify({
        type: "error",
        title: "Import thất bại",
        description: err?.message ?? "Import thất bại",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">Create, update, and review your trading orders.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleLedgerSync} disabled={syncingLedger}>
            {syncingLedger ? "Syncing..." : "Sync ledger from closed orders"}
          </Button>
          <Button size="lg" onClick={openNewDialog} disabled={!hasTradingAccounts}>
            New order
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Trading account context</CardTitle>
          <CardDescription>
            Mọi order phải gắn vào một Trading balance account. Chọn account để tạo mới hoặc import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasTradingAccounts ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">Chưa có Trading account.</p>
                <p className="text-muted-foreground">Tạo balance account (TRADING) trước khi thêm order.</p>
              </div>
              <Button asChild>
                <Link href="/trading/accounts">Tạo Trading account</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1.05fr,0.95fr]">
              <div className="space-y-2">
                <FormLabel>Chọn Trading account</FormLabel>
                <Select
                  value={activeBalanceAccountId}
                  onValueChange={(val) => {
                    setActiveBalanceAccountId(val);
                    form.setValue("balance_account_id", val);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn account" />
                  </SelectTrigger>
                  <SelectContent>
                    {tradingAccounts.map((acc) => (
                      <SelectItem key={acc.balance_account_id} value={acc.balance_account_id}>
                        {acc.name} · {acc.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeAccount ? (
                <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Broker</p>
                    <p className="font-medium text-foreground">{activeAccount.broker || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Platform</p>
                    <p className="font-medium text-foreground">{activeAccount.platform || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Account #</p>
                    <p className="font-medium text-foreground">{activeAccount.account_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Mode</p>
                    <p className="font-medium text-foreground">{activeAccount.is_demo ? "Demo" : "Live"}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filters</CardTitle>
          <CardDescription>Scope orders by symbol and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[1fr,200px,140px] items-end">
            <div className="space-y-2">
              <FormLabel>Symbol</FormLabel>
              <Input
                placeholder="e.g. XAUUSD"
                value={filtersDraft.symbol}
                onChange={(e) => setFiltersDraft((prev) => ({ ...prev, symbol: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Status</FormLabel>
              <Select
                value={filtersDraft.status}
                onValueChange={(value: StatusFilter) => setFiltersDraft((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setFilters(filtersDraft)}>
                Filter
              </Button>
              <Button variant="ghost" onClick={() => {
                const reset = { symbol: "", status: "all" as StatusFilter };
                setFiltersDraft(reset);
                setFilters(reset);
                setPage(1);
              }}>
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Báo cáo hiệu suất</CardTitle>
          <CardDescription>Ngày / tuần / tháng với so sánh kỳ liền trước</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Chọn kỳ</p>
              <div className="flex flex-wrap gap-2">
                {(["day", "week", "month"] as const).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={reportPeriod === key ? "default" : "outline"}
                    className={`rounded-full px-4 ${reportPeriod === key ? "bg-foreground text-white hover:bg-foreground" : "bg-white"}`}
                    onClick={() => setReportPeriod(key)}
                  >
                    {periodMeta[key].label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1 font-semibold text-foreground">
                {periodView === "current" ? "Kỳ hiện tại" : "Kỳ trước"}
              </span>
              <div className="flex overflow-hidden rounded-full border">
                <Button
                  type="button"
                  variant={periodView === "current" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none px-3 text-xs"
                  onClick={() => setPeriodView("current")}
                >
                  Hiện tại
                </Button>
                <Button
                  type="button"
                  variant={periodView === "previous" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none px-3 text-xs"
                  onClick={() => setPeriodView("previous")}
                >
                  Kỳ trước
                </Button>
              </div>
              <span>{periodMeta[reportPeriod].description}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1.1fr]">
            <div
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r ${periodMeta[reportPeriod].accent} via-white to-white p-5 shadow-sm`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_45%)]" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground shadow-sm">
                    {periodMeta[reportPeriod].label} · {activeSummary.label}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`text-3xl font-semibold ${activeSummary.pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatNumber(activeSummary.pnl)}
                    </span>
                    <span className="text-sm text-muted-foreground">PnL ròng</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 font-semibold text-foreground shadow-sm">
                      {pnlDelta >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                      {pnlDelta >= 0 ? "+" : ""}
                      {formatNumber(pnlDelta)} so với kỳ trước
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 font-semibold text-foreground shadow-sm">
                      <Percent className="h-4 w-4" />
                      {winRateDelta >= 0 ? "+" : ""}
                      {winRateDelta}% winrate vs kỳ trước
                    </span>
                  </div>
                </div>
                <div className="min-w-[220px] space-y-3 rounded-xl border bg-white/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground/70">Win rate</span>
                    <span className="text-sm font-semibold">{activeSummary.winRate}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                      style={{ width: `${Math.min(100, Math.max(6, activeSummary.winRate))}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">
                      <p className="text-xs uppercase tracking-wide text-emerald-800/80">Wins</p>
                      <p className="font-semibold">{activeSummary.wins}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 px-2 py-1 text-red-700">
                      <p className="text-xs uppercase tracking-wide text-red-800/80">Losses</p>
                      <p className="font-semibold">{activeSummary.losses}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Trung bình/trade</span>
                    <span className="font-semibold text-foreground">{formatNumber(avgPnlPerTrade)}</span>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white/80 p-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Giao dịch đóng</p>
                  <p className="text-lg font-semibold text-foreground">{totalTrades}</p>
                  <p className={`text-xs ${tradeDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {tradeDelta >= 0 ? "+" : ""}
                    {tradeDelta} vs kỳ trước
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Win / Loss gross</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatNumber(activeSummary.winAmount)} / {formatNumber(activeSummary.loseAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">Win chiếm {winShare}% tổng biến động</p>
                </div>
                <div className="rounded-lg bg-white/80 p-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Commission</p>
                  <p className="text-lg font-semibold text-foreground">{formatNumber(activeSummary.commission)}</p>
                  <p className={`text-xs ${commissionDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {commissionDelta >= 0 ? "+" : ""}
                    {formatNumber(commissionDelta)} vs kỳ trước
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Nhịp kỳ trước</p>
                  <p className="text-lg font-semibold text-foreground">{formatNumber(activePrevious.pnl)}</p>
                  <p className="text-xs text-muted-foreground">{activePrevious.label}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Win rate theo chu kỳ</p>
                    <p className="text-sm font-semibold text-foreground">
                      {winRatePeriod === "week" ? "Tuần" : "Tháng"}: {metrics.winRateComparison.current}%{" "}
                      <span className={metrics.winRateComparison.current >= metrics.winRateComparison.previous ? "text-emerald-600" : "text-red-600"}>
                        {metrics.winRateComparison.previous === 0 ? "" : `(${metrics.winRateComparison.current - metrics.winRateComparison.previous}%)`}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hiện tại: {metrics.winRateComparison.label} · Trước đó: {metrics.winRateComparison.prevLabel}
                    </p>
                  </div>
                  <Select value={winRatePeriod} onValueChange={(v: "week" | "month") => setWinRatePeriod(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Kỳ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Tuần</SelectItem>
                      <SelectItem value="month">Tháng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-primary to-emerald-500"
                    style={{ width: `${Math.min(100, Math.max(6, metrics.winRateComparison.current))}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Tổng PnL (closed, đã trừ phí)</p>
                    <p className={`text-xl font-semibold ${metrics.totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatNumber(metrics.totalPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Gross: {formatNumber(metrics.grossPnl)} · Commission+Swap: {formatNumber(metrics.totalCommission)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Avg lot mỗi ngày</p>
                    <p className="text-xl font-semibold">
                      {metrics.lotsSeries.length
                        ? formatNumber(
                            metrics.lotsSeries.reduce((acc, p) => acc + p.value, 0) / metrics.lotsSeries.length,
                            3
                          )
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Closed trades</p>
                    <p className="text-xl font-semibold">{metrics.closedCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Win rate toàn bộ</p>
                    <p className="text-xl font-semibold">{metrics.winRate}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(["day", "week", "month"] as const).map((key) => {
              const summary = metrics.periodSummaries[key];
              const comparison = metrics.periodComparisons[key];
              const delta = comparison.current.pnl - comparison.previous.pnl;
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 shadow-sm ${reportPeriod === key ? "border-foreground/30 bg-foreground/[0.03]" : "bg-white/80"}`}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground/70">
                    <span>{key === "day" ? "Hôm nay" : key === "week" ? "Tuần" : "Tháng"}</span>
                    <span className="text-[11px] text-muted-foreground">{summary.label}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold ${
                        summary.pnl >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {summary.pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {formatNumber(summary.pnl)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {summary.winRate}% win · {summary.wins}/{summary.losses}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Commission: {formatNumber(summary.commission)}
                  </p>
                  <p className={`mt-1 text-xs ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {delta >= 0 ? "+" : ""}
                    {formatNumber(delta)} vs kỳ trước
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">PnL theo ngày</p>
                  <p className="text-xs text-muted-foreground">Dựa trên close time (closed)</p>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto pb-2">
                <div className="flex min-w-[260px] items-end gap-2 min-h-[140px] sm:min-w-[320px] sm:gap-3">
                  {metrics.pnlSeries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
                  ) : (
                    metrics.pnlSeries.map((point) => {
                      const maxVal = Math.max(
                        ...metrics.pnlSeries.map((p) => Math.max(p.win, p.loss)),
                        1
                      );
                      const winHeight = point.win > 0 ? Math.max(4, (point.win / maxVal) * 96) : 0;
                      const lossHeight = point.loss > 0 ? Math.max(4, (point.loss / maxVal) * 96) : 0;
                      return (
                        <div key={point.label} className="flex flex-col items-center gap-1">
                          <div className="flex items-end gap-1">
                            <div
                              className="w-3 rounded-md bg-emerald-500 sm:w-4"
                              style={{ height: `${winHeight}px`, opacity: point.win > 0 ? 1 : 0.2 }}
                              title={`${point.label}: Win ${formatNumber(point.win)}`}
                            />
                            <div
                              className="w-3 rounded-md bg-red-500 sm:w-4"
                              style={{ height: `${lossHeight}px`, opacity: point.loss > 0 ? 1 : 0.2 }}
                              title={`${point.label}: Lose ${formatNumber(point.loss)}`}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="text-emerald-600">{point.win > 0 ? formatNumber(point.win) : "0"}</span>
                            <span className="text-red-600">-{point.loss > 0 ? formatNumber(point.loss) : "0"}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{point.label.slice(5)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-gradient-to-r from-indigo-50 to-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Lots theo ngày</p>
                  <p className="text-xs text-muted-foreground">Dựa trên open time</p>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto pb-2">
                <div className="flex min-w-[260px] items-end gap-1.5 min-h-[140px] sm:min-w-[320px] sm:gap-2">
                  {metrics.lotsSeries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
                  ) : (
                    metrics.lotsSeries.map((point) => {
                      const maxVal = Math.max(...metrics.lotsSeries.map((p) => p.value), 1);
                      const heightPx = Math.max(4, (point.value / maxVal) * 96);
                      return (
                        <div key={point.label} className="flex flex-col items-center gap-1">
                          <div
                            className="w-8 rounded-md bg-primary/80 sm:w-10"
                            style={{ height: `${heightPx}px` }}
                            title={`${point.label}: ${formatNumber(point.value, 3)} lots`}
                          />
                          <div className="text-[11px] font-semibold text-primary">
                            {point.value > 0 ? formatNumber(point.value, 3) : "0"}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{point.label.slice(5)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Import orders (CSV)</CardTitle>
            <CardDescription>
              Định dạng: ticket, opening_time_utc, closing_time_utc, type, lots, original_position_size, symbol, opening_price,
              closing_price, stop_loss, take_profit, commission_usd, swap_usd, profit_usd, equity_usd, margin_level, close_reason
            </CardDescription>
          </div>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Import CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import orders</DialogTitle>
                <DialogDescription>Chọn file CSV theo định dạng đã mô tả để import.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Giá trị dùng: symbol, type (buy/sell), opening_time_utc, closing_time_utc, lots, opening_price, closing_price,
                  stop_loss, take_profit, profit_usd, close_reason. Các cột khác được lưu kèm (commission/swap/equity/margin).
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" type="button" onClick={() => setImportDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleImport} disabled={!importFile || importing || !activeBalanceAccountId}>
                  {importing ? "Đang import..." : "Import"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>All orders tied to your account with quick edit/delete.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders match the current filters.</p>
          ) : (
            <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {currentPage} / {totalPages} · Showing {paginatedOrders.length} of {filteredOrders.length} orders
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:hidden">
              {paginatedOrders.map((order) => (
                <div key={order.id} className="rounded-lg border bg-white p-2 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {order.ticket ? <p className="text-[11px] font-semibold text-primary">Ticket #{order.ticket}</p> : null}
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Symbol</p>
                      <p className="text-base font-semibold text-foreground">{order.symbol}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(order.open_time)}</p>
                      <p className="text-xs text-muted-foreground">Account: {getAccountLabel(order)}</p>
                    </div>
                    <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                          order.side === "buy" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {order.side === "buy" ? "Buy" : "Sell"}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Entry</p>
                        <p className="font-medium text-foreground">{formatNumber(order.entry_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Volume</p>
                        <p className="font-medium text-foreground">{formatNumber(order.volume, 2)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">SL / TP</p>
                        <p className="font-medium text-foreground">
                          {formatNumber(order.sl_price)} / {formatNumber(order.tp_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Status</p>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                            order.status === "open"
                              ? "bg-blue-50 text-blue-700"
                              : order.status === "closed"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Close time</p>
                        <p className="text-foreground">{formatDateTime(order.close_time)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">PnL (net)</p>
                        {order.pnl_amount !== null && order.pnl_amount !== undefined ? (
                          <div className="text-foreground">
                            <span className={getOrderNetPnl(order) >= 0 ? "text-emerald-600" : "text-red-600"}>
                              {formatNumber(getOrderNetPnl(order))}
                            </span>
                            {order.pnl_percent !== null && order.pnl_percent !== undefined ? (
                              <span className="ml-1 text-xs text-muted-foreground">({formatNumber(order.pnl_percent, 2)}%)</span>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" disabled={order.is_imported} onClick={() => openEditDialog(order)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={order.is_imported}
                        onClick={() => setDeleteTarget(order)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[300px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>SL</TableHead>
                      <TableHead>TP</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>Close</TableHead>
                      <TableHead>PnL (net)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-semibold">{order.ticket ?? "—"}</TableCell>
                        <TableCell className="font-semibold">{order.symbol}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getAccountLabel(order)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              order.side === "buy" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {order.side === "buy" ? "Buy" : "Sell"}
                          </span>
                        </TableCell>
                        <TableCell>{formatNumber(order.entry_price)}</TableCell>
                        <TableCell>{formatNumber(order.sl_price)}</TableCell>
                        <TableCell>{formatNumber(order.tp_price)}</TableCell>
                        <TableCell>{formatNumber(order.volume, 2)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              order.status === "open"
                                ? "bg-blue-50 text-blue-700"
                                : order.status === "closed"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(order.open_time)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(order.close_time)}</TableCell>
                        <TableCell>
                        {order.pnl_amount !== null && order.pnl_amount !== undefined ? (
                          <div className="space-y-0.5">
                              <div className={getOrderNetPnl(order) >= 0 ? "text-emerald-600" : "text-red-600"}>
                                {formatNumber(getOrderNetPnl(order))}
                              </div>
                              {order.pnl_percent !== null && order.pnl_percent !== undefined ? (
                                <div className="text-xs text-muted-foreground">{formatNumber(order.pnl_percent, 2)}%</div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button variant="ghost" size="sm" disabled={order.is_imported} onClick={() => openEditDialog(order)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={order.is_imported}
                            onClick={() => setDeleteTarget(order)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOrder ? "Edit order" : "New order"}</DialogTitle>
            <DialogDescription>Capture order details and risk metadata.</DialogDescription>
          </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                  <FormField
                    control={form.control}
                    name="balance_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Balance account</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setActiveBalanceAccountId(val);
                          }}
                          disabled={!hasTradingAccounts}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn Balance account" />
                          </SelectTrigger>
                          <SelectContent>
                            {tradingAccounts.map((acc) => (
                              <SelectItem key={acc.balance_account_id} value={acc.balance_account_id}>
                                {acc.name} · {acc.currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage>{form.formState.errors.balance_account_id?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ticket"
                    render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional ticket id"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.ticket?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="XAUUSD" />
                      </FormControl>
                      <FormMessage>{form.formState.errors.symbol?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="side"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Side</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose side" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buy">Buy</SelectItem>
                          <SelectItem value="sell">Sell</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage>{form.formState.errors.side?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="entry_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.entry_price?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="volume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume (lots)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.volume?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="sl_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SL price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.sl_price?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tp_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TP price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.tp_price?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leverage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leverage</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.leverage?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="original_position_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original position size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.original_position_size?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="commission_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commission (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.commission_usd?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="swap_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Swap (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.swap_usd?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="equity_usd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equity (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.equity_usd?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="margin_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Margin level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.margin_level?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                name="close_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Close reason</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional reason (e.g., sl/tp/manual)"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.close_reason?.message}</FormMessage>
                  </FormItem>
                )}
              />
              </div>

              <FormField
                control={form.control}
                name="open_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Open time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.open_time?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.status?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="close_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Close time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.close_time?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="close_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Close price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.close_price?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pnl_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PnL amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.pnl_amount?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pnl_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PnL %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.pnl_percent?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Trade rationale, broker, etc."
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : editingOrder ? "Update order" : "Create order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete order</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The order "{deleteTarget?.symbol}" will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
