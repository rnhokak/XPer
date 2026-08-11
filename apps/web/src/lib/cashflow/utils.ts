const ALLOWED_RANGES = ["today", "week", "month"] as const;

export type CashflowRange = (typeof ALLOWED_RANGES)[number];

export const normalizeCashflowRange = (value?: string | null): CashflowRange => {
  if (!value) return "month";
  const normalized = value.toLowerCase();
  return (ALLOWED_RANGES as readonly string[]).includes(normalized) ? (normalized as CashflowRange) : "month";
};

const SHIFT_LIMIT = 120;

export const normalizeRangeShift = (value?: string | null) => {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(-SHIFT_LIMIT, Math.min(SHIFT_LIMIT, parsed));
};

export const rangeBounds = (range: CashflowRange, shift = 0) => {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (shift) start.setDate(start.getDate() + shift);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (range === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    if (shift) start.setDate(start.getDate() + shift * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  if (shift) start.setMonth(start.getMonth() + shift);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
};

export const rangeStart = (range: CashflowRange) => rangeBounds(range).start;
