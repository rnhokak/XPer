import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type DebtRow = {
  id: string;
  partner_id: string;
  direction: "lend" | "borrow";
  principal_amount: number;
  currency: string;
  start_date: string;
  due_date: string | null;
  status: "ongoing" | "paid_off" | "overdue" | "cancelled";
  description: string | null;
  interest_type: "none" | "fixed" | "percent";
  interest_rate: number | null;
  interest_cycle: "day" | "month" | "year" | null;
  created_at: string | null;
  updated_at: string | null;
  partner: { id: string; name: string; type: string | null; phone?: string | null } | null;
  outstanding_principal: number;
};

const statusVariant = (status: DebtRow["status"]) => {
  switch (status) {
    case "paid_off":
      return "default";
    case "overdue":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
};

export function DebtsTable({ debts }: { debts: DebtRow[] }) {
  const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "—");

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Danh sách khoản vay</CardTitle>
          <p className="text-sm text-muted-foreground">Tổng hợp tất cả khoản cho vay / đi vay và trạng thái.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/debts/new">Thêm khoản mới</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có khoản vay nào. Bấm &quot;Thêm khoản mới&quot; để bắt đầu.</p>
          ) : (
            debts.map((debt) => (
              <div key={debt.id} className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{debt.partner?.name ?? "Không rõ"}</p>
                    <p className="text-xs text-muted-foreground">{debt.partner?.type ?? "Không phân loại"}</p>
                  </div>
                  <Badge variant={debt.direction === "lend" ? "secondary" : "outline"}>
                    {debt.direction === "lend" ? "Cho vay" : "Đi vay"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Gốc ban đầu</p>
                    <p className="font-semibold">
                      {debt.principal_amount.toLocaleString()} {debt.currency}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <p className="text-xs text-emerald-700">Còn lại</p>
                    <p className="font-semibold text-emerald-700">
                      {debt.outstanding_principal.toLocaleString()} {debt.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Bắt đầu {formatDate(debt.start_date)}</span>
                  <span>Đến hạn {formatDate(debt.due_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={statusVariant(debt.status)}>{debt.status}</Badge>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/debts/${debt.id}`}>Chi tiết</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Đối tác</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Gốc ban đầu</TableHead>
                  <TableHead className="text-right">Còn lại</TableHead>
                  <TableHead>Ngày bắt đầu</TableHead>
                  <TableHead>Đến hạn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Chưa có khoản vay nào. Bấm &quot;Thêm khoản mới&quot; để bắt đầu.
                    </TableCell>
                  </TableRow>
                ) : (
                  debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell>
                        <div className="font-semibold">{debt.partner?.name ?? "Không rõ"}</div>
                        <div className="text-xs text-muted-foreground">{debt.partner?.type ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={debt.direction === "lend" ? "secondary" : "outline"}>
                          {debt.direction === "lend" ? "Cho vay" : "Đi vay"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {debt.principal_amount.toLocaleString()} {debt.currency}
                      </TableCell>
                      <TableCell className="text-right">
                        {debt.outstanding_principal.toLocaleString()} {debt.currency}
                      </TableCell>
                      <TableCell>{new Date(debt.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{debt.due_date ? new Date(debt.due_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(debt.status)}>{debt.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/debts/${debt.id}`}>Chi tiết</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
