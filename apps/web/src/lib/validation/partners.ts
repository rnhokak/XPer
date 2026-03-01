import { z } from "zod";

const numberFromInput = (val: unknown) => {
  if (val === null || val === undefined || val === "") return undefined;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? val : parsed;
};

const optionalString = z
  .preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), z.string().max(500).optional())
  .nullable();

const datetimeString = z
  .string()
  .refine((val) => !Number.isNaN(new Date(val).getTime()), "Invalid datetime");

export const partnerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: optionalString,
  phone: optionalString,
  note: optionalString,
});

export type PartnerFormValues = z.infer<typeof partnerFormSchema>;

export const partnerTransactionSchema = z.object({
  partner_id: z.string().uuid({ message: "Partner is required" }),
  direction: z.enum(["lend", "borrow", "repay", "receive"]),
  amount: z.preprocess(
    numberFromInput,
    z.number({ required_error: "Amount is required" }).positive("Amount must be greater than 0")
  ),
  principal_amount: z.preprocess(numberFromInput, z.number().positive().optional()).nullable(),
  interest_amount: z.preprocess(numberFromInput, z.number().nonnegative().optional()).nullable(),
  account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  currency: z.string().optional(),
  date: z.preprocess((val) => (val === "" ? undefined : val), datetimeString.optional()).optional(),
  note: optionalString,
});

export type PartnerTransactionInput = z.infer<typeof partnerTransactionSchema>;
