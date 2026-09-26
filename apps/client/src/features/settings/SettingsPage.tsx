import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  formatAppVersion,
  checkForAppUpdate,
  reloadLatestVersion,
  type CheckUpdateResult,
} from '@/lib/pwa/reloadLatestVersion'
import { useNotificationsStore } from '@/store/notifications'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from 'lucide-react'

export default function SettingsPage() {
  const notify = useNotificationsStore((state) => state.notify)
  const [isReloading, setIsReloading] = useState(false)
  const [reloadingStep, setReloadingStep] = useState<string>('')
  const [isChecking, setIsChecking] = useState(false)
  const [updateResult, setUpdateResult] = useState<CheckUpdateResult | null>(null)

  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

  // Tự động kiểm tra bản mới một lần khi vào trang cài đặt
  useEffect(() => {
    let mounted = true
    checkForAppUpdate().then((res) => {
      if (mounted) {
        setUpdateResult(res)
      }
    }).catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  const handleCheckUpdate = async () => {
    setIsChecking(true)
    try {
      const res = await checkForAppUpdate()
      setUpdateResult(res)
      if (res.hasUpdate) {
        notify({
          type: 'info',
          title: 'Có bản cập nhật mới',
          description: `Máy chủ đã có bản mới: ${formatAppVersion(res.serverVersion)}`,
        })
      } else if (res.hasUpdate === false) {
        notify({
          type: 'success',
          title: 'Đang là bản mới nhất',
          description: 'Ứng dụng của bạn đang trùng khớp với mã nguồn mới nhất trên máy chủ.',
        })
      } else {
        notify({
          type: 'warning',
          title: 'Kiểm tra phiên bản',
          description: res.message,
        })
      }
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Lỗi kiểm tra bản mới',
        description: err?.message || 'Không thể kết nối đến máy chủ.',
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleReloadLatest = async () => {
    if (isReloading) return
    setIsReloading(true)
    setReloadingStep('Bắt đầu quy trình tải bản mới...')

    try {
      await reloadLatestVersion({
        onProgress: (step) => setReloadingStep(step),
      })
    } catch (err: any) {
      setIsReloading(false)
      setReloadingStep('')
      notify({
        type: 'error',
        title: 'Tải lại thất bại',
        description: err?.message || 'Có lỗi xảy ra khi xóa cache và tải bản mới từ máy chủ.',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cài đặt hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý phiên bản ứng dụng, nạp bản React mới từ máy chủ và các cấu hình tài khoản.
        </p>
      </div>

      {/* Card: Quản lý phiên bản & Tải lại bản mới nhất từ server */}
      <Card className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <HardDriveDownload className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Phiên bản React & Bộ nhớ đệm (Cache)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Tải trực tiếp bản mới từ máy chủ thay cho bộ nhớ cache đã lưu
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="border-emerald-300 bg-emerald-50/80 px-2.5 py-1 text-xs text-emerald-800">
              Bản trên máy: {formatAppVersion(currentVersion)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          <p className="text-sm text-slate-600 leading-relaxed">
            Nếu máy chủ đã được triển khai bản mới mà trình duyệt hoặc PWA của bạn vẫn đang chạy bản cũ do lưu cache,
            hãy nhấn nút dưới đây để <strong>xóa toàn bộ cache</strong> và <strong>tải ngay bản React mới nhất từ server</strong>.
          </p>

          {/* Thông báo trạng thái kiểm tra bản mới */}
          {updateResult && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-snug transition-all ${
                updateResult.hasUpdate
                  ? 'border-amber-200 bg-amber-50/90 text-amber-900'
                  : updateResult.hasUpdate === false
                  ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {updateResult.hasUpdate ? (
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : updateResult.hasUpdate === false ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{updateResult.message}</p>
                {updateResult.serverVersion && updateResult.hasUpdate && (
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Bản trên server: {formatAppVersion(updateResult.serverVersion)} · Bản hiện tại: {formatAppVersion(currentVersion)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Thanh trạng thái khi đang thực hiện reload */}
          {isReloading && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-100/60 p-3 text-sm text-emerald-900 animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              <div className="flex-1">
                <p className="font-medium">Đang cập nhật phiên bản mới nhất...</p>
                <p className="text-xs text-emerald-700">{reloadingStep}</p>
              </div>
            </div>
          )}

          {/* Nút thao tác */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={handleReloadLatest}
              disabled={isReloading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium"
            >
              {isReloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải bản mới...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tải lại phiên bản mới nhất
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleCheckUpdate}
              disabled={isChecking || isReloading}
              className="border-slate-300 hover:bg-slate-100"
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 text-slate-600" />
                  Kiểm tra bản mới trên server
                </>
              )}
            </Button>
          </div>

          <p className="text-[11px] text-slate-400">
            * Thao tác này chỉ xóa cache giao diện web và nạp lại mã nguồn từ server. Tài khoản và dữ liệu đã lưu của bạn được giữ nguyên an toàn.
          </p>
        </CardContent>
      </Card>

      {/* Các mục cấu hình khác */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Danh mục cài đặt
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Hồ sơ người dùng */}
          <Card className="group rounded-2xl border border-slate-200 bg-white/90 p-4 transition-all hover:border-slate-300 hover:shadow-md">
            <Link to="/settings/profile" className="flex flex-col justify-between h-full gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <User className="h-5 w-5" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Hồ sơ cá nhân
                </h3>
                <p className="text-xs text-muted-foreground">
                  Quản lý tên hiển thị và ảnh đại diện xuất hiện trên thanh điều hướng.
                </p>
              </div>
              <span className="text-xs font-medium text-blue-600">Xem hồ sơ &rarr;</span>
            </Link>
          </Card>

          {/* Tích hợp Telegram */}
          <Card className="group rounded-2xl border border-slate-200 bg-white/90 p-4 transition-all hover:border-slate-300 hover:shadow-md">
            <Link to="/settings/telegram" className="flex flex-col justify-between h-full gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition-colors">
                    <Send className="h-5 w-5" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
                  Liên kết Telegram
                </h3>
                <p className="text-xs text-muted-foreground">
                  Kết nối bot Telegram để ghi nhanh giao dịch thu chi qua tin nhắn.
                </p>
              </div>
              <span className="text-xs font-medium text-sky-600">Cấu hình Telegram &rarr;</span>
            </Link>
          </Card>

          {/* Bảng ngày báo cáo */}
          <Card className="group rounded-2xl border border-slate-200 bg-white/90 p-4 transition-all hover:border-slate-300 hover:shadow-md">
            <Link to="/settings/report-dates" className="flex flex-col justify-between h-full gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">
                  Bảng ngày báo cáo
                </h3>
                <p className="text-xs text-muted-foreground">
                  Quản lý các mốc ngày bắt đầu báo cáo cashflow và trading của bạn.
                </p>
              </div>
              <span className="text-xs font-medium text-purple-600">Quản lý ngày &rarr;</span>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
