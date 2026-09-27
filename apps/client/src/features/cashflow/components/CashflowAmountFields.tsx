import { useEffect, useMemo, useState } from "react";
import { type Control, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";
import { History, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const evaluateAmountExpression = (raw: string) => {
  const clean = raw.replace(/,/g, ".").replace(/\s+/g, "");
  if (!clean || clean === "." || clean === "-" || clean === "+") return undefined;
  if (!/^[0-9+\-*/.()]+$/.test(clean)) return undefined;
  try {
    const result = new Function(`"use strict"; return (${clean});`)();
    return typeof result === "number" && Number.isFinite(result) ? result : undefined;
  } catch {
    return undefined;
  }
};

const normalizeAmount = (raw: string) => evaluateAmountExpression(raw);

const formatNumericValue = (value: string) => {
  if (!value || value === "-" || value === "." || value === "-." || value === "+") return value;
  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = sign ? value.slice(1) : value;
  const hasDecimal = unsigned.includes(".");
  const [integerPart = "", decimalPart] = unsigned.split(".");
  const formattedInteger = integerPart ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : hasDecimal ? "0" : "";
  const decimalSuffix = hasDecimal ? `.${decimalPart ?? ""}` : "";
  return `${sign}${formattedInteger}${decimalSuffix}`;
};

const formatInputDisplay = (value: string, fallback?: string) => {
  const cleaned = value.replace(/,/g, "");
  if (!cleaned) return "";
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) {
    return fallback ?? value;
  }
  return formatNumericValue(cleaned);
};

const formatNumberForInput = (value: number) => formatNumericValue(String(value));

const getCurrencySymbol = (curr: string) => {
  switch (curr.toUpperCase()) {
    case "VND":
      return "₫";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    default:
      return curr;
  }
};

const formatChipLabel = (val: number, isVnd: boolean) => {
  if (isVnd) {
    if (val >= 1000000) {
      const tr = val / 1000000;
      return `${tr % 1 === 0 ? tr : tr.toFixed(1)}tr`;
    }
    if (val >= 1000) {
      const k = val / 1000;
      return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
    }
    return String(val);
  }
  if (val >= 1000000) return `${val / 1000000}M`;
  if (val >= 1000) return `${val / 1000}k`;
  return String(val);
};

type PresetDef = {
  amount: number;
  label: string;
  emoji: string;
  keywords: string[];
};

const EXPENSE_PRESETS_VND: PresetDef[] = [
  { amount: 30000, label: "30k", emoji: "☕", keywords: ["cafe", "cà phê", "trà", "coffee", "uống", "nước"] },
  { amount: 50000, label: "50k", emoji: "🍜", keywords: ["ăn", "cơm", "bún", "phở", "food", "dining", "trưa", "sáng"] },
  { amount: 100000, label: "100k", emoji: "🛒", keywords: ["chợ", "siêu thị", "mart", "ăn uống", "tạp hóa"] },
  { amount: 200000, label: "200k", emoji: "🛍️", keywords: ["mua", "sắm", "quần", "áo", "xăng", "xe", "di chuyển"] },
  { amount: 500000, label: "500k", emoji: "💡", keywords: ["điện", "nước", "hóa đơn", "bill", "nhà", "mua sắm"] },
];

const INCOME_PRESETS_VND: PresetDef[] = [
  { amount: 500000, label: "500k", emoji: "💵", keywords: ["thu", "khác", "thưởng", "lãi", "bán"] },
  { amount: 2000000, label: "2tr", emoji: "🎁", keywords: ["thưởng", "bonus", "quà", "thu nhập"] },
  { amount: 5000000, label: "5tr", emoji: "💰", keywords: ["lương", "salary", "thu nhập", "dự án"] },
  { amount: 10000000, label: "10tr", emoji: "💼", keywords: ["lương", "salary", "thu nhập"] },
  { amount: 20000000, label: "20tr", emoji: "🏦", keywords: ["lương", "salary", "thu nhập", "đầu tư"] },
];

const TRANSFER_PRESETS_VND: PresetDef[] = [
  { amount: 100000, label: "100k", emoji: "🔄", keywords: ["chuyển", "transfer", "nạp"] },
  { amount: 500000, label: "500k", emoji: "💳", keywords: ["chuyển", "transfer", "tiết kiệm"] },
  { amount: 1000000, label: "1tr", emoji: "📲", keywords: ["chuyển", "transfer"] },
  { amount: 2000000, label: "2tr", emoji: "🏦", keywords: ["chuyển", "transfer", "rút"] },
  { amount: 5000000, label: "5tr", emoji: "🔁", keywords: ["chuyển", "transfer", "tiết kiệm"] },
];

const EXPENSE_PRESETS_OTHER: PresetDef[] = [
  { amount: 5, label: "5", emoji: "☕", keywords: ["cafe", "coffee", "drink"] },
  { amount: 10, label: "10", emoji: "🍔", keywords: ["food", "lunch", "dining"] },
  { amount: 20, label: "20", emoji: "🛒", keywords: ["groceries", "market"] },
  { amount: 50, label: "50", emoji: "🛍️", keywords: ["shopping", "clothes"] },
  { amount: 100, label: "100", emoji: "💡", keywords: ["bills", "utilities"] },
];

const INCOME_PRESETS_OTHER: PresetDef[] = [
  { amount: 100, label: "100", emoji: "💵", keywords: ["income", "bonus"] },
  { amount: 500, label: "500", emoji: "🎁", keywords: ["bonus", "freelance"] },
  { amount: 1000, label: "1k", emoji: "💰", keywords: ["salary", "income"] },
  { amount: 2000, label: "2k", emoji: "💼", keywords: ["salary", "payroll"] },
  { amount: 5000, label: "5k", emoji: "🏦", keywords: ["salary", "investment"] },
];

const TRANSFER_PRESETS_OTHER: PresetDef[] = [
  { amount: 50, label: "50", emoji: "🔄", keywords: ["transfer"] },
  { amount: 100, label: "100", emoji: "💳", keywords: ["transfer"] },
  { amount: 200, label: "200", emoji: "📲", keywords: ["transfer"] },
  { amount: 500, label: "500", emoji: "🏦", keywords: ["transfer"] },
  { amount: 1000, label: "1k", emoji: "🔁", keywords: ["transfer"] },
];

type CategoryItem = { id: string; name: string; type: string };

type Props = {
  control: Control<CashflowQuickAddValues>;
  currency?: string;
  themeColor?: "rose" | "emerald" | "blue";
  transactionType?: "expense" | "income" | "transfer";
  categories?: CategoryItem[];
  onSelectCategory?: (categoryId: string) => void;
};

export function CashflowAmountFields({
  control,
  currency,
  themeColor = "rose",
  transactionType = "expense",
  categories = [],
  onSelectCategory,
}: Props) {
  const watchedCurrency = useWatch({ control, name: "currency" }) ?? currency ?? "VND";
  const amountValue = useWatch({ control, name: "amount" });
  const [amountInput, setAmountInput] = useState("");
  const [autoThousand, setAutoThousand] = useState(watchedCurrency === "VND");
  const isVnd = watchedCurrency === "VND";

  useEffect(() => {
    setAutoThousand(watchedCurrency === "VND");
  }, [watchedCurrency]);

  useEffect(() => {
    if (typeof amountValue === "number" && !Number.isNaN(amountValue)) {
      setAmountInput(formatNumberForInput(amountValue));
      return;
    }
    setAmountInput("");
  }, [amountValue]);

  // Read recent amounts from localStorage
  const recentAmounts = useMemo(() => {
    try {
      const key = `cashflow:recentAmounts:${watchedCurrency}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const list: Array<{ amount: number; ts: number }> = JSON.parse(raw);
      return list
        .map((item) => item.amount)
        .filter((amt) => typeof amt === "number" && Number.isFinite(amt) && amt > 0)
        .slice(0, 4);
    } catch {
      return [];
    }
  }, [watchedCurrency, amountValue]);

  const applyThousandShortcuts = (raw: string) => {
    const trimmed = raw.trim();
    if (!autoThousand || !isVnd) return trimmed;
    if (/^\d{1,3}$/.test(trimmed) && trimmed.length <= 3) {
      return `${trimmed}000`;
    }
    return trimmed;
  };

  const handleSetAmount = (val: number, onChange: (v: number | undefined) => void) => {
    onChange(val);
    setAmountInput(formatNumberForInput(val));
  };

  const handleAddDelta = (delta: number, onChange: (v: number | undefined) => void) => {
    const current = typeof amountValue === "number" && Number.isFinite(amountValue) ? amountValue : 0;
    const next = current + delta;
    if (next > 0) {
      onChange(next);
      setAmountInput(formatNumberForInput(next));
    }
  };

  const handleMultiplyThousand = (onChange: (v: number | undefined) => void) => {
    const current = typeof amountValue === "number" && Number.isFinite(amountValue) ? amountValue : 0;
    if (current > 0) {
      const next = current * 1000;
      onChange(next);
      setAmountInput(formatNumberForInput(next));
    } else if (amountInput) {
      const cleaned = amountInput.replace(/,/g, "");
      const num = Number(cleaned);
      if (!Number.isNaN(num) && num > 0) {
        const next = num * 1000;
        onChange(next);
        setAmountInput(formatNumberForInput(next));
      }
    }
  };

  const handleClear = (onChange: (v: number | undefined) => void) => {
    setAmountInput("");
    onChange(undefined);
  };

  // Presets tailored to transaction type
  const activePresets: PresetDef[] = useMemo(() => {
    if (isVnd) {
      if (transactionType === "income") return INCOME_PRESETS_VND;
      if (transactionType === "transfer") return TRANSFER_PRESETS_VND;
      return EXPENSE_PRESETS_VND;
    }
    if (transactionType === "income") return INCOME_PRESETS_OTHER;
    if (transactionType === "transfer") return TRANSFER_PRESETS_OTHER;
    return EXPENSE_PRESETS_OTHER;
  }, [isVnd, transactionType]);

  const deltaAmounts = useMemo(() => {
    if (isVnd) {
      if (transactionType === "income") return [500000, 1000000, 2000000, 5000000, 10000000];
      if (transactionType === "transfer") return [100000, 500000, 1000000, 2000000, 5000000];
      return [10000, 20000, 50000, 100000, 500000];
    }
    if (transactionType === "income") return [100, 200, 500, 1000];
    if (transactionType === "transfer") return [20, 50, 100, 200];
    return [1, 5, 10, 20, 50];
  }, [isVnd, transactionType]);

  const findMatchedCategory = (keywords: string[]) => {
    if (!categories || categories.length === 0) return null;
    for (const kw of keywords) {
      const found = categories.find((c) => c.name.toLowerCase().includes(kw));
      if (found) return found;
    }
    return categories[0] ?? null;
  };

  const handleSelectPreset = (preset: PresetDef, onChange: (v: number | undefined) => void) => {
    handleSetAmount(preset.amount, onChange);
    if (onSelectCategory && categories.length > 0) {
      const matched = findMatchedCategory(preset.keywords);
      if (matched) {
        onSelectCategory(matched.id);
      }
    }
  };

  const hasAmount = typeof amountValue === "number" && amountValue > 0;

  return (
    <FormField
      control={control}
      name="amount"
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormControl>
            <div className="space-y-2.5">
              {/* Main Amount Input Card */}
              <div
                className={cn(
                  "relative flex items-center rounded-2xl border-2 bg-gradient-to-b from-white to-slate-50/60 p-2.5 sm:p-3.5 shadow-xs transition-all duration-200",
                  hasAmount
                    ? themeColor === "rose"
                      ? "border-rose-400/80 shadow-rose-500/5 ring-4 ring-rose-500/10"
                      : themeColor === "emerald"
                      ? "border-emerald-400/80 shadow-emerald-500/5 ring-4 ring-emerald-500/10"
                      : "border-blue-400/80 shadow-blue-500/5 ring-4 ring-blue-500/10"
                    : "border-slate-200 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100"
                )}
              >
                {/* Currency Symbol Badge */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-lg font-bold text-slate-700 sm:h-12 sm:w-12 sm:text-xl">
                  {getCurrencySymbol(watchedCurrency)}
                </div>

                {/* Input */}
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus={true}
                  className="h-11 flex-1 border-0 bg-transparent px-3 text-2xl font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0 sm:h-12 sm:text-3xl"
                  value={amountInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cleaned = raw.replace(/,/g, "");
                    const normalized = normalizeAmount(cleaned);
                    field.onChange(normalized);
                    if (!cleaned) {
                      setAmountInput("");
                      return;
                    }
                    setAmountInput(formatInputDisplay(cleaned, raw));
                  }}
                  onBlur={(e) => {
                    const cleaned = e.target.value.replace(/,/g, "");
                    const nextValue = applyThousandShortcuts(cleaned);
                    const normalized = normalizeAmount(nextValue);
                    setAmountInput(normalized !== undefined ? formatNumberForInput(normalized) : "");
                    field.onChange(normalized);
                  }}
                  placeholder="0"
                />

                {/* Action buttons on the right of input */}
                <div className="flex items-center gap-1">
                  {amountInput ? (
                    <button
                      type="button"
                      onClick={() => handleClear(field.onChange)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/70 text-slate-500 hover:bg-slate-300 hover:text-slate-800 transition active:scale-95"
                      title="Xóa số tiền"
                      aria-label="Xóa"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}

                  {isVnd && (
                    <button
                      type="button"
                      onClick={() => setAutoThousand((v) => !v)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[11px] font-semibold transition active:scale-95",
                        autoThousand
                          ? "bg-emerald-100/80 text-emerald-700"
                          : "bg-slate-100 text-slate-400 hover:text-slate-600"
                      )}
                      title={autoThousand ? "Đang bật tự thêm 3 số 0 khi nhập" : "Tắt tự thêm 3 số 0"}
                    >
                      {autoThousand ? "Auto 000" : "+000 off"}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {!hasAmount ? (
                  <>
                    <span className="text-[11px] font-medium text-slate-400 mr-0.5 flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3 text-amber-500" /> Nhanh:
                    </span>

                    {/* Recent amounts if available */}
                    {recentAmounts.length > 0 &&
                      recentAmounts.map((amt) => (
                        <button
                          key={`recent-${amt}`}
                          type="button"
                          onClick={() => handleSetAmount(amt, field.onChange)}
                          className="flex items-center gap-1 rounded-xl border border-amber-200/90 bg-amber-50/70 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 active:scale-95 shadow-2xs"
                          title="Số tiền gần đây"
                        >
                          <History className="h-2.5 w-2.5 text-amber-600" />
                          <span>{formatChipLabel(amt, isVnd)}</span>
                        </button>
                      ))}

                    {/* Preset chips with auto-paired category */}
                    {activePresets.map((preset) => {
                      const matched = findMatchedCategory(preset.keywords);
                      return (
                        <button
                          key={`${preset.amount}-${preset.label}`}
                          type="button"
                          onClick={() => handleSelectPreset(preset, field.onChange)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 shadow-2xs"
                          title={matched ? `Chọn ${preset.label} và danh mục ${matched.name}` : `Chọn ${preset.label}`}
                        >
                          <span>{preset.emoji}</span>
                          <span>{preset.label}</span>
                          {matched && (
                            <span className="text-[10px] font-normal text-muted-foreground truncate max-w-[70px]">
                              • {matched.name}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-slate-400 mr-0.5">Cộng thêm:</span>

                    {/* Delta chips tailored to transactionType */}
                    {deltaAmounts.map((amt) => (
                      <button
                        key={`delta-${amt}`}
                        type="button"
                        onClick={() => handleAddDelta(amt, field.onChange)}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 shadow-2xs"
                      >
                        +{formatChipLabel(amt, isVnd)}
                      </button>
                    ))}

                    {/* +000 Shortcut */}
                    <button
                      type="button"
                      onClick={() => handleMultiplyThousand(field.onChange)}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95 shadow-2xs"
                      title="Nhân 1,000 (thêm 3 số 0)"
                    >
                      +000
                    </button>

                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={() => handleClear(field.onChange)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </FormControl>
          <FormMessage className="text-xs text-rose-500 font-medium">
            {(control._formState.errors as any)?.amount?.message}
          </FormMessage>
        </FormItem>
      )}
    />
  );
}
