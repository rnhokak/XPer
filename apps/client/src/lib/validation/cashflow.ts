import { z } from "zod";

export const cashflowTransactionTypes = ["expense", "income", "transfer"] as const;
export type CashflowTransactionType = (typeof cashflowTransactionTypes)[number];
export const cashflowTransactionTypeLabels: Record<CashflowTransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
};

const numberFromInput = (val: unknown) => {
  if (val === null || val === undefined || val === "") return undefined;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? val : parsed;
};

export const cashflowQuickAddSchema = z
  .object({
    type: z.enum(cashflowTransactionTypes).default("expense"),
    amount: z.preprocess(
      numberFromInput,
      z.number({ required_error: "Vui lòng nhập số tiền" }).positive("Số tiền phải lớn hơn 0")
    ),
    category_id: z.preprocess(
      (val) => (val === null || val === "" ? undefined : val),
      z.string().nullable().optional()
    ),
    account_id: z.string().uuid().nullable().optional(),
    destination_account_id: z.string().uuid().nullable().optional(),
    destination_amount: z.preprocess(
      numberFromInput,
      z.number().positive("Số tiền nhận phải lớn hơn 0").optional().nullable()
    ),
    destination_currency: z.string().nullable().optional(),
    exchange_rate: z.preprocess(
      numberFromInput,
      z.number().positive("Hệ số nhân phải lớn hơn 0").optional().nullable()
    ),
    note: z
      .preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.string().max(500).optional())
      .nullable(),
    transaction_time: z
      .preprocess((val) => {
        if (val === null || val === undefined || val === "") return undefined;
        return val;
      }, z.string().refine((val) => !Number.isNaN(new Date(val).getTime()), "Thời gian không hợp lệ"))
      .optional(),
    currency: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "transfer" && (!data.category_id || data.category_id.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_id"],
        message: "Vui lòng chọn danh mục",
      });
    }

    if (data.type === "transfer") {
      if (!data.destination_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination_account_id"],
          message: "Vui lòng chọn tài khoản hoặc đối tác nhận",
        });
      } else if (data.account_id && data.destination_account_id === data.account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination_account_id"],
          message: "Tài khoản nhận không được trùng tài khoản chuyển",
        });
      }

      // Check if currencies differ
      const srcCurr = (data.currency || "").trim().toUpperCase();
      const destCurr = (data.destination_currency || "").trim().toUpperCase();
      if (srcCurr && destCurr && srcCurr !== destCurr) {
        if (!data.destination_amount || data.destination_amount <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["destination_amount"],
            message: "Vui lòng nhập số tiền nhận quy đổi",
          });
        }
        if (!data.exchange_rate || data.exchange_rate <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["exchange_rate"],
            message: "Vui lòng nhập hệ số nhân / tỷ giá",
          });
        }
      }
    }
  });

export type CashflowQuickAddValues = z.infer<typeof cashflowQuickAddSchema>;
