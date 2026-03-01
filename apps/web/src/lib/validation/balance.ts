import { z } from "zod";

export const baseBalanceAccountSchema = z.object({
  account_type: z.enum(["TRADING", "FUNDING"]).optional().default("TRADING"),
  name: z.string().min(1, "Name is required"),
  currency: z.string().min(1, "Currency is required"),
  is_active: z.boolean().optional().default(true),
  broker: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  is_demo: z.boolean().optional().default(false),
});

export const createBalanceAccountSchema = baseBalanceAccountSchema;

export const updateBalanceAccountSchema = baseBalanceAccountSchema.extend({
  id: z.string().uuid("Account id is required"),
});

export type CreateBalanceAccountInput = z.infer<typeof createBalanceAccountSchema>;
export type UpdateBalanceAccountInput = z.infer<typeof updateBalanceAccountSchema>;
