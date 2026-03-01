import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  is_default: z.boolean().optional(),
});

export type AccountInput = z.infer<typeof accountSchema>;
