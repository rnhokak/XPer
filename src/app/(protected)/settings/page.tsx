import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Cài đặt</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Update preferences, API keys, and integrations here.
        </CardContent>
      </Card>
      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Bảng ngày báo cáo</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center justify-between gap-4">
          <p>Quản lý các mốc bắt đầu báo cáo cashflow và trading.</p>
          <Button asChild variant="outline">
            <Link href="/settings/report-dates">Mở bảng ngày báo cáo</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
