type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  transaction_time: string;
  category?: { id?: string | null; name?: string | null } | null;
};

const formatNumber = (value: number) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const startOfWeekMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

type PeriodKey = "day" | "week" | "month";
type PeriodSummary = { income: number; expense: number; net: number };

const summarizePeriods = (transactions: Transaction[]): Record<PeriodKey, PeriodSummary> => {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfWeekMonday(now);
  const monthStart = startOfMonth(now);

  const ranges: Record<PeriodKey, { start: Date; end: Date }> = {
    day: { start: dayStart, end: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) },
    week: { start: weekStart, end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
    month: { start: monthStart, end: new Date(new Date(monthStart).setMonth(monthStart.getMonth() + 1)) },
  };

  const initial: Record<PeriodKey, PeriodSummary> = {
    day: { income: 0, expense: 0, net: 0 },
    week: { income: 0, expense: 0, net: 0 },
    month: { income: 0, expense: 0, net: 0 },
  };

  return transactions.reduce((acc, tx) => {
    const t = new Date(tx.transaction_time);
    (Object.keys(ranges) as PeriodKey[]).forEach((key) => {
      const { start, end } = ranges[key];
      if (t >= start && t < end) {
        if (tx.type === "income") {
          acc[key].income += tx.amount;
          acc[key].net += tx.amount;
        } else {
          acc[key].expense += tx.amount;
          acc[key].net -= tx.amount;
        }
      }
    });
    return acc;
  }, initial);
};

const buildCategoryTotals = (transactions: Transaction[]) => {
  const map = new Map<string, { income: number; expense: number }>();
  transactions.forEach((tx) => {
    const key = tx.category?.name ?? "Uncategorized";
    const current = map.get(key) ?? { income: 0, expense: 0 };
    if (tx.type === "income") {
      current.income += tx.amount;
    } else {
      current.expense += tx.amount;
    }
    map.set(key, current);
  });
  return Array.from(map.entries()).map(([name, totals]) => ({
    name,
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
  }));
};

const buildDailySeries = (transactions: Transaction[], days = 7) => {
  const now = new Date();
  const labels: string[] = [];
  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-CA");
    labels.push(label);
    buckets.set(label, { income: 0, expense: 0 });
  }

  transactions.forEach((tx) => {
    const d = new Date(tx.transaction_time);
    d.setHours(0, 0, 0, 0);
    const label = d.toLocaleDateString("en-CA");
    if (!buckets.has(label)) return;
    const entry = buckets.get(label)!;
    if (tx.type === "income") {
      entry.income += tx.amount;
    } else {
      entry.expense += tx.amount;
    }
  });

  return labels.map((label) => ({ label, ...(buckets.get(label) ?? { income: 0, expense: 0 }) }));
};

export function CashflowReport({ transactions }: { transactions: Transaction[] }) {
  const summaries = summarizePeriods(transactions);
  const categoryTotals = buildCategoryTotals(transactions).sort((a, b) => b.net - a.net);
  const dailySeries = buildDailySeries(transactions, 7);
  const maxDaily = Math.max(...dailySeries.map((d) => Math.max(d.income, d.expense)), 1);

  const periodMeta: Record<PeriodKey, { label: string; description: string }> = {
    day: { label: "Hôm nay", description: "Từ 00:00 đến hiện tại" },
    week: { label: "Tuần này", description: "Tính từ thứ 2" },
    month: { label: "Tháng này", description: "Tính từ ngày 1" },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(Object.keys(summaries) as PeriodKey[]).map((key) => {
          const item = summaries[key];
          return (
            <div
              key={key}
              className="flex min-h-[140px] flex-col justify-between rounded-lg border bg-white/90 p-2.5 shadow-sm ring-1 ring-black/5 sm:min-h-[150px] sm:rounded-xl sm:p-3"
            >
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 sm:text-[11px]">
                  {periodMeta[key].label}
                </p>
                <p className="text-[10px] text-muted-foreground sm:text-[11px]">{periodMeta[key].description}</p>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5 sm:mt-2 sm:gap-2">
                <span className={`text-lg font-semibold sm:text-2xl ${item.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {item.net >= 0 ? "+" : ""}
                  {formatNumber(item.net)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-col gap-1 text-[9px] sm:mt-2 sm:gap-2 sm:text-[10px]">
                <div className="inline-flex w-fit self-end items-center justify-between rounded-full bg-emerald-50 px-2 py-1 sm:px-2.5">
                  <span className="text-[9px] uppercase tracking-wide text-emerald-700 sm:text-[10px]">Thu</span>
                  <span className="font-semibold text-emerald-700 leading-tight">+{formatNumber(item.income)}</span>
                </div>
                <div className="inline-flex w-fit self-end items-center justify-between rounded-full bg-red-50 px-2 py-1 sm:px-2.5">
                  <span className="text-[9px] uppercase tracking-wide text-red-700 sm:text-[10px]">Chi</span>
                  <span className="font-semibold text-red-700 leading-tight">-{formatNumber(item.expense)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Xu hướng 7 ngày</p>
            <p className="text-xs text-muted-foreground">Thu vs Chi theo ngày</p>
          </div>
          <span className="text-xs text-muted-foreground">Đỉnh: {formatNumber(maxDaily)}</span>
        </div>
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="flex min-w-[260px] items-end gap-2 sm:min-w-[320px] sm:gap-3">
            {dailySeries.map((d) => {
              const incHeight = Math.max(6, (d.income / maxDaily) * 120);
              const expHeight = Math.max(6, (d.expense / maxDaily) * 120);
              return (
                <div key={d.label} className="flex flex-col items-center gap-1">
                  <div className="flex items-end gap-1">
                    <div
                      className="w-4 rounded-md bg-emerald-500/80 sm:w-5"
                      style={{ height: `${incHeight}px` }}
                      title={`Thu ${formatNumber(d.income)}`}
                    />
                    <div
                      className="w-4 rounded-md bg-red-500/80 sm:w-5"
                      style={{ height: `${expHeight}px` }}
                      title={`Chi ${formatNumber(d.expense)}`}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-foreground">
                    {d.income >= d.expense ? (
                      <span className="text-emerald-600">+{formatNumber(d.income - d.expense)}</span>
                    ) : (
                      <span className="text-red-600">-{formatNumber(d.expense - d.income)}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{d.label.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Thu
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Chi
          </span>
        </div>
      </div>
    </div>
  );
}
