import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportDatesManager from "./ReportDatesManager";

export const dynamic = "force-dynamic";

export default async function ReportDatesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: reportRuns } = await supabase
    .from("report_runs")
    .select("id,user_id,type,report_date,note,created_at")
    .eq("user_id", user.id)
    .order("report_date", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Bảng ngày báo cáo</h1>
        <p className="text-sm text-muted-foreground">Ghi lại ngày bắt đầu báo cáo mới nhất cho cashflow và trading.</p>
      </div>
      <ReportDatesManager initialRuns={reportRuns ?? []} />
    </div>
  );
}
