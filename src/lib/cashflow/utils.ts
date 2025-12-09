const ALLOWED_RANGES = ["today", "week", "month", "all"] as const;

export type CashflowRange = (typeof ALLOWED_RANGES)[number];

export const normalizeCashflowRange = (value?: string | null): CashflowRange => {
  if (!value) return "month";
  const normalized = value.toLowerCase();
  return (ALLOWED_RANGES as readonly string[]).includes(normalized) ? (normalized as CashflowRange) : "month";
};

export const rangeStart = (range: CashflowRange | null) => {
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
