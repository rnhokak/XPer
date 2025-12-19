import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LinkCodeState = {
  code: string;
  expiresAt: string;
};

type Props = {
  codeState: LinkCodeState | null;
  generating: boolean;
  error?: string | null;
  onGenerate: () => void;
};

const formatExpiration = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

export function LinkCodeCard({ codeState, generating, error, onGenerate }: Props) {
  return (
    <Card className="border border-slate-800 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-base">Mã liên kết</CardTitle>
        <p className="text-sm text-muted-foreground">Tạo mã dùng một lần và gửi /link CODE cho bot.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-dashed border-emerald-500 bg-emerald-500/5 p-4 text-center">
          {codeState ? (
            <>
              <p className="text-xs uppercase text-emerald-300">Dùng trong 5 phút</p>
              <p className="text-3xl font-bold tracking-[0.4em] text-emerald-400">{codeState.code}</p>
              <p className="text-xs text-muted-foreground">Hết hạn lúc {formatExpiration(codeState.expiresAt)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có mã hoạt động.</p>
          )}
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. Mở Telegram và tìm bot.</li>
          <li>2. Gửi lệnh <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-emerald-300">/link CODE</span>.</li>
          <li>3. Bot sẽ xác nhận khi liên kết thành công.</li>
        </ol>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={onGenerate} disabled={generating} className="w-full">
          {generating ? "Đang tạo..." : codeState ? "Tạo mã mới" : "Tạo mã liên kết"}
        </Button>
      </CardContent>
    </Card>
  );
}
