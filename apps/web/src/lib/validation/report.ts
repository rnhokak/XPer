import { z } from "zod";

export const reportTypes = ["cashflow", "trading", "funding"] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportRunCreateSchema = z.object({
  type: z.enum(reportTypes),
  report_date: z.string().optional(),
  note: z.string().max(250).optional().nullable(),
});

export const reportRunUpdateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(reportTypes),
  report_date: z.string(),
  note: z.string().max(250).optional().nullable(),
});
