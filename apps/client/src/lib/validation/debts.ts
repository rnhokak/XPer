import { z } from "zod";

const numberFromInput = (val: unknown) => {
  if (val === null || val === undefined || val === "") return undefined;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? val : parsed;
};

const optionalString = z
  .preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.string().max(500).optional())
  .nullable();

const dateString = z.string().refine((val) => !Number.isNaN(new Date(val).getTime()), "Invalid date");

export const partnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: optionalString,
  phone: optionalString,
  note: optionalString,
});

export type PartnerInput = z.infer<typeof partnerSchema>;

export const debtCreateSchema = z
  .object({
    partner_id: z.string().uuid({ message: "Partner is required" }),
    direction: z.enum(["lend", "borrow"]),
    principal_amount: z.preprocess(
      numberFromInput,
      z.number({ required_error: "Amount is required" }).positive("Amount must be greater than 0")
    ),
    currency: z.string().min(1, "Currency is required").optional(),
    start_date: dateString,
    due_date: z
      .preprocess((val) => (val === "" ? undefined : val), dateString.optional())
      .nullable()
      .optional(),
    interest_type: z.enum(["none", "fixed", "percent"]).default("none"),
    interest_rate: z.preprocess(numberFromInput, z.number().positive().optional()).nullable(),
    interest_cycle: z.enum(["day", "month", "year"]).optional().nullable(),
    description: optionalString,
    account_id: z.string().uuid().nullable().optional(),
    category_id: z.string().uuid().nullable().optional(),
    transaction_time: z
      .preprocess((val) => (val === "" ? undefined : val), z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid datetime"))
      .optional(),
    note: optionalString,
  })
  .superRefine((val, ctx) => {
    if (val.interest_type !== "none" && (val.interest_rate === null || val.interest_rate === undefined)) {
      ctx.addIssue({
        path: ["interest_rate"],
        code: "custom",
        message: "Interest rate is required when interest type is not none",
      });
    }
    if (val.interest_type === "none" && val.interest_rate) {
      ctx.addIssue({
        path: ["interest_rate"],
        code: "custom",
        message: "Remove interest rate when interest type is none",
      });
    }
    if (val.interest_type === "none" && val.interest_cycle) {
      ctx.addIssue({
        path: ["interest_cycle"],
        code: "custom",
        message: "Interest cycle is not needed when interest type is none",
      });
    }
  });

export type DebtCreateInput = z.infer<typeof debtCreateSchema>;

export const debtPaymentSchema = z.object({
  debt_id: z.string().uuid({ message: "Debt is required" }),
  amount: z.preprocess(
    numberFromInput,
    z.number({ required_error: "Amount is required" }).positive("Amount must be greater than 0")
  ),
  principal_amount: z.preprocess(numberFromInput, z.number().positive().optional()).nullable(),
  interest_amount: z.preprocess(numberFromInput, z.number().nonnegative().optional()).nullable(),
  account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  currency: z.string().optional(),
  payment_date: z
    .preprocess((val) => (val === "" ? undefined : val), z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid datetime"))
    .optional(),
  note: optionalString,
});

export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;
