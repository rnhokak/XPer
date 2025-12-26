import { z } from "zod";

export const cashflowTransactionTypes = ["expense", "income", "transfer"] as const;

const numberFromInput = (val: unknown) => {
  if (val === null || val === undefined || val === "") return undefined;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? val : parsed;
};

export const cashflowQuickAddSchema = z.object({
  type: z.enum(cashflowTransactionTypes).default("expense"),
  amount: z.preprocess(numberFromInput, z.number({ required_error: "Amount is required" }).positive("Amount must be greater than 0")),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  note: z
    .preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.string().max(500).optional())
    .nullable(),
});

export type CashflowQuickAddValues = z.infer<typeof cashflowQuickAddSchema>;
