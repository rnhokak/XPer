import { z } from "zod";

export const categoryTypes = ["expense", "income", "transfer"] as const;
export type CategoryType = (typeof categoryTypes)[number];

export const categoryFocuses = ["NE", "SE", "INV", "EDU", "ENJ", "KHAC"] as const;
export type CategoryFocus = (typeof categoryFocuses)[number];
export const categoryFocusLabels: Record<CategoryFocus, string> = {
  NE: "Cơ bản",
  SE: "Tiết kiệm / Dự phòng",
  INV: "Đầu tư",
  EDU: "Phát triển bản thân",
  ENJ: "Giải trí / Sở thích",
  KHAC: "Khác",
};

export const categorySchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(categoryTypes),
    parent_id: z.string().uuid().nullable().optional(),
    level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    category_focus: z.enum(categoryFocuses).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
      if (data.level !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["level"],
          message: "Transfer categories must be top level",
        });
      }
      if (data.parent_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parent_id"],
          message: "Transfer categories cannot have a parent",
        });
      }
    }
  });

export type CategoryInput = z.infer<typeof categorySchema>;
