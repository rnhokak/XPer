import { useEffect, useState } from "react";
import { type Control, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";

const toLocalInput = (input: string | Date) => {
  const date = input instanceof Date ? input : new Date(input);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const defaultDateTimeValue = () => toLocalInput(new Date());
const timePresets = [
  { label: "Now", minutes: 0 },
  { label: "-1w", minutes: -10080 },
];

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

type SuggestedAmount = { label: string; value: number | null };

type Props = {
  control: Control<CashflowQuickAddValues>;
  currency?: string;
  suggestedAmounts?: SuggestedAmount[];
};

export function CashflowAmountDateFields({ control, currency, suggestedAmounts = [] }: Props) {
  const watchedCurrency = useWatch({ control, name: "currency" }) ?? currency ?? "VND";
  const amountValue = useWatch({ control, name: "amount" });
  const [amountInput, setAmountInput] = useState("");
  const [autoThousand, setAutoThousand] = useState(watchedCurrency === "VND");

  useEffect(() => {
    setAutoThousand(watchedCurrency === "VND");
  }, [watchedCurrency]);

  useEffect(() => {
    if (typeof amountValue === "number") {
      setAmountInput(formatNumberForInput(amountValue));
      return;
    }
    setAmountInput("");
  }, [amountValue]);

  const applyThousandShortcuts = (raw: string) => {
    const trimmed = raw.trim();
    if (!autoThousand || watchedCurrency !== "VND") return trimmed;
    if (/^\d{1,3}$/.test(trimmed) && trimmed.length <= 3) {
      return `${trimmed}000`;
    }
    return trimmed;
  };

  return (
    <>
      <FormField
        control={control}
        name="transaction_time"
        render={({ field }) => {
          const nowLocal = defaultDateTimeValue();
          const adjustMinutes = (minutes: number) => {
            const base = field.value ? new Date(field.value) : new Date();
            base.setMinutes(base.getMinutes() + minutes);
            const now = new Date();
            const clamped = base > now ? now : base;
            field.onChange(toLocalInput(clamped));
          };

          return (
            <FormItem>
              <FormLabel className="text-sm font-semibold">Transaction time</FormLabel>
              <FormControl>
                <div className="space-y-2 rounded-xl border bg-white/70 p-3 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    {timePresets.map((preset) => {
                      const presetDate = new Date();
                      presetDate.setMinutes(presetDate.getMinutes() + preset.minutes);
                      const presetInput = toLocalInput(presetDate);
                      const isActive = field.value && Math.abs(new Date(field.value).getTime() - presetDate.getTime()) < 60 * 1000;
                      return (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          className={`rounded-full px-3 ${isActive ? "bg-foreground text-white hover:bg-foreground" : "bg-white"}`}
                          onClick={() => field.onChange(presetInput)}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="rounded-full px-3" onClick={() => adjustMinutes(-1440)}>
                        -1d
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="rounded-full px-3" onClick={() => adjustMinutes(1440)}>
                        +1d
                      </Button>
                    </div>
                  </div>
                  <Input
                    type="datetime-local"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = val ? new Date(val) : null;
                      const now = new Date();
                      if (parsed && parsed > now) {
                        field.onChange(toLocalInput(now));
                        return;
                      }
                      field.onChange(val);
                    }}
                    max={nowLocal}
                    placeholder="Now by default"
                  />
                </div>
              </FormControl>
              <FormMessage>{(control._formState.errors as any)?.transaction_time?.message}</FormMessage>
            </FormItem>
          );
        }}
      />

      <FormField
        control={control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold">Amount *</FormLabel>
            <FormControl>
              <div className="space-y-2 rounded-2xl border bg-slate-50/70 p-3 shadow-inner">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,110px]">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="text-lg h-12 rounded-xl px-3 w-full"
                    value={amountInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleaned = raw.replace(/,/g, "");
                      const normalized = normalizeAmount(applyThousandShortcuts(cleaned));
                      field.onChange(normalized);
                      if (!cleaned) {
                        setAmountInput("");
                        return;
                      }
                      setAmountInput(formatInputDisplay(cleaned, raw));
                    }}
                    onBlur={(e) => {
                      const cleaned = e.target.value.replace(/,/g, "");
                      const normalized = normalizeAmount(applyThousandShortcuts(cleaned));
                      setAmountInput(normalized !== undefined ? formatNumberForInput(normalized) : "");
                      field.onChange(normalized);
                    }}
                    placeholder="e.g. 120000"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl w-full"
                      onClick={() => {
                        setAmountInput("");
                        field.onChange(undefined);
                      }}
                    >
                      Clear
                    </Button>
                    {watchedCurrency === "VND" ? (
                      <Button
                        type="button"
                        variant={autoThousand ? "default" : "outline"}
                        size="sm"
                        className="rounded-xl w-full"
                        onClick={() => setAutoThousand((v) => !v)}
                      >
                        {autoThousand ? "Auto 000" : "No 000"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {suggestedAmounts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestedAmounts.map((item, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          if (item.value === null) {
                            const current = field.value ?? 0;
                            const nextValue = current * 1000;
                            field.onChange(nextValue);
                            setAmountInput(formatNumberForInput(nextValue));
                          } else {
                            field.onChange(item.value);
                            setAmountInput(formatNumberForInput(item.value));
                          }
                        }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </FormControl>
            <FormMessage>{(control._formState.errors as any)?.amount?.message}</FormMessage>
          </FormItem>
        )}
      />
    </>
  );
}
