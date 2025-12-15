import { z } from "zod";

export const categoryTypes = ["expense", "income", "transfer"] as const;
export type CategoryType = (typeof categoryTypes)[number];

export const categoryGroups = ["sinh_hoat", "an_uong", "ca_nhan_giai_tri", "tai_chinh", "khac"] as const;
export type CategoryGroup = (typeof categoryGroups)[number];
export const categoryGroupLabels: Record<CategoryGroup, string> = {
  sinh_hoat: "Sinh hoạt",
  an_uong: "Ăn uống",
  ca_nhan_giai_tri: "Cá nhân – Giải trí",
  tai_chinh: "Tài chính",
  khac: "Khác",
};

export const categoryFocuses = ["co_ban", "phat_trien_ban_than", "dau_tu", "con_cai", "khac_focus"] as const;
export type CategoryFocus = (typeof categoryFocuses)[number];
export const categoryFocusLabels: Record<CategoryFocus, string> = {
  co_ban: "Cơ bản",
  phat_trien_ban_than: "Phát triển bản thân",
  dau_tu: "Đầu tư",
  con_cai: "Con cái",
  khac_focus: "Khác",
};

export const categorySchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(categoryTypes),
    parent_id: z.string().uuid().nullable().optional(),
    level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    category_group: z.enum(categoryGroups).nullable().optional(),
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
