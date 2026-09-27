import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Tên tài khoản không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại tài khoản"),
  currency: z.string().min(1, "Currency is required").default("VND"),
  balance: z.coerce.number().optional().default(0),
  is_default: z.boolean().optional().default(false),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "Tên tài khoản không được để trống"),
  is_default: z.boolean().optional().default(false),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
