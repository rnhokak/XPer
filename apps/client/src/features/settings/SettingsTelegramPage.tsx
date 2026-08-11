import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotificationsStore } from '@/store/notifications'
import {
  useTelegramLink,
  useGenerateTelegramLinkCode,
  useUnlinkTelegram,
} from '@/hooks/useSettingsData'
import { Loader2 } from 'lucide-react'

type TelegramLinkInfo = {
  username: string | null
  first_name: string | null
  last_name: string | null
  telegram_user_id: number
  telegram_chat_id: number
  created_at: string | null
}

type LinkCodeState = {
  code: string
  expiresAt: string
}

const formatExpiration = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

const formatName = (link: TelegramLinkInfo) => {
  if (link.first_name || link.last_name) {
    return [link.first_name, link.last_name].filter(Boolean).join(' ')
  }
  if (link.username) {
    return `@${link.username}`
  }
  return `#${link.telegram_user_id}`
}

export default function SettingsTelegramPage() {
  const notify = useNotificationsStore((state) => state.notify)
  const { data: link, isLoading } = useTelegramLink()
  const generateCodeMutation = useGenerateTelegramLinkCode()
  const unlinkMutation = useUnlinkTelegram()
  
  const [codeState, setCodeState] = useState<LinkCodeState | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlinkError, setUnlinkError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setCodeError(null)
    try {
      const result = await generateCodeMutation.mutateAsync()
      setCodeState({ code: result.code, expiresAt: result.expires_at })
    } catch (err: any) {
      setCodeError(err?.message ?? 'Không tạo được mã, thử lại sau.')
    }
  }

  const handleUnlink = async () => {
    setUnlinkError(null)
    try {
      await unlinkMutation.mutateAsync()
      notify({
        type: 'success',
        title: 'Đã hủy liên kết',
        description: 'Telegram account has been unlinked.',
      })
    } catch (err: any) {
      setUnlinkError(err?.message ?? 'Không thể hủy liên kết, thử lại sau.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-12">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Telegram</h1>
        <p className="text-sm text-muted-foreground">Liên kết tài khoản Telegram để ghi cashflow nhanh.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Status Card */}
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
                {unlinkError ? <p className="text-sm text-destructive">{unlinkError}</p> : null}
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={unlinkMutation.isPending}
                  onClick={handleUnlink}
                >
                  {unlinkMutation.isPending ? 'Đang hủy liên kết...' : 'Hủy liên kết'}
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

        {/* Link Code Card */}
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
              <li>
                2. Gửi lệnh{' '}
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-emerald-300">/link CODE</span>.
              </li>
              <li>3. Bot sẽ xác nhận khi liên kết thành công.</li>
            </ol>
            {codeError ? <p className="text-sm text-destructive">{codeError}</p> : null}
            <Button
              onClick={handleGenerate}
              disabled={generateCodeMutation.isPending}
              className="w-full"
            >
              {generateCodeMutation.isPending ? 'Đang tạo...' : codeState ? 'Tạo mã mới' : 'Tạo mã liên kết'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
