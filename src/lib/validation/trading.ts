import { z } from "zod";

const amountPreprocessor = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized || normalized === ".") return undefined;
    const parsed = Number(normalized.startsWith(".") ? `0${normalized}` : normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number().positive("Amount must be greater than 0"));

export const fundingFormSchema = z.object({
  type: z.enum(["deposit", "withdraw"]),
  amount: amountPreprocessor,
  currency: z.string().min(1, "Currency is required"),
  method: z.string().min(1, "Method is required"),
  transaction_time: z.string().min(1, "Transaction time is required"),
  note: z.string().optional().nullable(),
});

export type FundingFormValues = z.infer<typeof fundingFormSchema>;

export const orderFormSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["buy", "sell"]),
  entry_price: z.number().positive("Entry price must be greater than 0"),
  sl_price: z.number().positive().optional(),
  tp_price: z.number().positive().optional(),
  volume: z.number().positive("Volume must be greater than 0"),
  leverage: z.number().int().positive().optional(),
  ticket: z.string().optional().nullable(),
  original_position_size: z.number().optional().nullable(),
  commission_usd: z.number().optional().nullable(),
  swap_usd: z.number().optional().nullable(),
  equity_usd: z.number().optional().nullable(),
  margin_level: z.number().optional().nullable(),
  close_reason: z.string().optional().nullable(),
  status: z.enum(["open", "closed", "cancelled"]).default("open"),
  open_time: z.string().min(1, "Open time is required"),
  close_time: z.string().optional(),
  close_price: z.number().positive().optional(),
  pnl_amount: z.number().optional(),
  pnl_percent: z.number().optional(),
  note: z.string().optional().nullable(),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;
