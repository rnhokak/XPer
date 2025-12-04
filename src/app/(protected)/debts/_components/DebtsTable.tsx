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
  return (
    <Card>
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
      </CardContent>
    </Card>
  );
}
