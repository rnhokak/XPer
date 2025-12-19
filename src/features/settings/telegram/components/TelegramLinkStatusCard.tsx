import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TelegramLinkInfo = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  telegram_user_id: number;
  telegram_chat_id: number;
  created_at: string | null;
};

type Props = {
  link: TelegramLinkInfo | null;
  unlinking: boolean;
  error?: string | null;
  onUnlink: () => void;
};

const formatName = (link: TelegramLinkInfo) => {
  if (link.first_name || link.last_name) {
    return [link.first_name, link.last_name].filter(Boolean).join(" ");
  }
  if (link.username) {
    return `@${link.username}`;
  }
  return `#${link.telegram_user_id}`;
};

export function TelegramLinkStatusCard({ link, onUnlink, unlinking, error }: Props) {
  return (
    <Card className="border border-slate-800 bg-slate-950/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Trạng thái</CardTitle>
        <p className="text-sm text-muted-foreground">Kiểm tra tài khoản Telegram đã liên kết.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {link ? (
          <>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-sm text-muted-foreground">Đã liên kết với</p>
              <p className="text-lg font-semibold">{formatName(link)}</p>
              {link.username ? <p className="text-sm text-muted-foreground">@{link.username}</p> : null}
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <p className="text-[11px] uppercase tracking-wide">User ID</p>
                  <p className="font-mono text-sm">{link.telegram_user_id}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide">Chat ID</p>
                  <p className="font-mono text-sm">{link.telegram_chat_id}</p>
                </div>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button variant="destructive" className="w-full" disabled={unlinking} onClick={onUnlink}>
              {unlinking ? "Đang hủy liên kết..." : "Hủy liên kết"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Chưa có tài khoản Telegram nào được liên kết.</p>
            <p className="text-sm">Tạo mã bên dưới và gửi lệnh /link trên Telegram để kết nối.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
