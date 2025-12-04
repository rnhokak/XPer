import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "expense"]),
  parent_id: z.string().uuid().nullable().optional(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export type CategoryInput = z.infer<typeof categorySchema>;
