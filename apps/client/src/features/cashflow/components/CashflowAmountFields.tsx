import { useEffect, useState } from "react";
import { type Control, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";

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

type Props = {
  control: Control<CashflowQuickAddValues>;
  currency?: string;
};

export function CashflowAmountFields({ control, currency }: Props) {
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
            </div>
          </FormControl>
          <FormMessage>{(control._formState.errors as any)?.amount?.message}</FormMessage>
        </FormItem>
      )}
    />
  );
}
