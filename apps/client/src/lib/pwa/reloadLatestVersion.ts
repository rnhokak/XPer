/**
 * Helper quản lý phiên bản và tải lại bản mới nhất của ứng dụng React từ máy chủ
 */

export interface VersionInfo {
  version: string
  buildTime: string
}

export interface CheckUpdateResult {
  hasUpdate: boolean | null
  serverVersion?: string
  currentVersion: string
  message: string
}

/**
 * Định dạng chuỗi phiên bản (ISO timestamp) thành ngày giờ tiếng Việt dễ đọc
 */
export function formatAppVersion(versionStr?: string): string {
  if (!versionStr) return 'Không xác định'
  try {
    const date = new Date(versionStr)
    if (Number.isNaN(date.getTime())) {
      return versionStr
    }
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return versionStr
  }
}

/**
 * Định dạng ngắn gọn cho thanh sidebar / footer
 */
export function formatAppVersionShort(versionStr?: string): string {
  if (!versionStr) return 'v0.0'
  try {
    const date = new Date(versionStr)
    if (Number.isNaN(date.getTime())) {
      return versionStr.slice(0, 10)
    }
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return versionStr.slice(0, 10)
  }
}

/**
 * Kiểm tra xem máy chủ có bản build React mới hơn bản đang chạy trên trình duyệt hay không
 */
export async function checkForAppUpdate(): Promise<CheckUpdateResult> {
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

  if (typeof window === 'undefined') {
    return {
      hasUpdate: false,
      currentVersion,
      message: 'Không khả dụng ở môi trường hiện tại.',
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      hasUpdate: null,
      currentVersion,
      message: 'Thiết bị đang ngoại tuyến (Offline), không thể kiểm tra bản mới từ server.',
    }
  }

  try {
    const basePath = window.location.pathname.startsWith('/app') ? '/app' : ''
    const versionUrl = `${window.location.origin}${basePath}/version.json?_t=${Date.now()}`

    const response = await fetch(versionUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    })

    if (!response.ok) {
      // Nếu file version.json chưa có trên server (ví dụ bản build cũ chưa có plugin này),
      // thử kiểm tra thẻ ETag hoặc Last-Modified của index.html
      const htmlUrl = `${window.location.origin}${basePath}/index.html?_t=${Date.now()}`
      const htmlRes = await fetch(htmlUrl, {
        method: 'HEAD',
        cache: 'no-store',
      })
      const lastModified = htmlRes.headers.get('last-modified') || htmlRes.headers.get('etag')
      
      return {
        hasUpdate: null,
        serverVersion: lastModified ?? undefined,
        currentVersion,
        message: 'Không lấy được tệp version.json, nhưng bạn vẫn có thể tải lại bản mới bất kỳ lúc nào.',
      }
    }

    const data: VersionInfo = await response.json()
    const serverVersion = data.version || data.buildTime
    const serverBuildTime = data.buildTime || ''
    const currentBuildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''

    if (!serverVersion) {
      return {
        hasUpdate: null,
        currentVersion,
        message: 'Máy chủ phản hồi nhưng không có thông tin phiên bản.',
      }
    }

    const hasUpdate =
      (Boolean(data.version) && data.version !== currentVersion) ||
      (Boolean(serverBuildTime) && Boolean(currentBuildTime) && serverBuildTime !== currentBuildTime)

    return {
      hasUpdate,
      serverVersion,
      currentVersion,
      message: hasUpdate
        ? `Đã có bản cập nhật mới trên server (${serverVersion})!`
        : `Bạn đang sử dụng phiên bản mới nhất (${currentVersion}).`,
    }
  } catch (err: any) {
    return {
      hasUpdate: null,
      currentVersion,
      message: `Lỗi khi kiểm tra máy chủ: ${err?.message || 'Không thể kết nối'}`,
    }
  }
}

export const RELOAD_FLAG_KEY = 'xper:app_reloaded_at'

/**
 * Tải lại phiên bản mới nhất của ứng dụng React từ server:
 * 1. Xóa toàn bộ CacheStorage của trình duyệt (Workbox precache, api cache, v.v.)
 * 2. Hủy đăng ký Service Worker cũ (unregister) để trình duyệt không nạp mã nguồn cũ
 * 3. Bỏ qua HTTP cache (cache: 'reload') khi tải index.html mới từ server
 * 4. Tải lại trang (hard reload) với timestamp chống cache để nạp bản React mới từ server
 */
export async function reloadLatestVersion(options?: {
  onProgress?: (step: string) => void
}): Promise<void> {
  if (typeof window === 'undefined') return

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Thiết bị đang ngoại tuyến. Vui lòng kết nối Internet để tải bản mới.')
  }

  try {
    options?.onProgress?.('Đang gửi tín hiệu dọn cache đến Service Worker...')

    // 1. Gửi tín hiệu đến Service Worker hiện tại (nếu có)
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'xper:clear-all-caches' })
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      } catch {
        // ignore
      }
    }

    // 2. Xóa toàn bộ CacheStorage của trình duyệt
    options?.onProgress?.('Đang xóa bộ nhớ đệm (CacheStorage)...')
    if ('caches' in window) {
      try {
        const cacheKeys = await window.caches.keys()
        await Promise.all(
          cacheKeys.map(async (key) => {
            try {
              await window.caches.delete(key)
            } catch (e) {
              console.warn(`Không thể xóa cache ${key}:`, e)
            }
          })
        )
      } catch (e) {
        console.warn('Lỗi khi truy cập window.caches:', e)
      }
    }

    // 3. Hủy đăng ký tất cả Service Workers đang hoạt động
    options?.onProgress?.('Đang hủy đăng ký Service Worker cũ...')
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations.map(async (reg) => {
            try {
              await reg.unregister()
            } catch (e) {
              console.warn('Không thể unregister Service Worker:', e)
            }
          })
        )
      } catch (e) {
        console.warn('Lỗi khi unregister Service Worker:', e)
      }
    }

    // 4. Xóa sessionStorage (giữ nguyên localStorage và cookie để bảo toàn phiên đăng nhập)
    try {
      sessionStorage.clear()
    } catch {
      // ignore
    }

    // 5. Tải trước index.html mới nhất từ máy chủ với header chống cache
    options?.onProgress?.('Đang tải mã nguồn React mới nhất từ server...')
    const basePath = window.location.pathname.startsWith('/app') ? '/app/' : '/'
    const freshUrl = `${window.location.origin}${basePath}?_nocache=${Date.now()}`

    try {
      await fetch(freshUrl, {
        method: 'GET',
        cache: 'reload',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
    } catch (e) {
      console.warn('Không thể pre-fetch HTML:', e)
    }

    // Đánh dấu thời điểm reload để sau khi reload sẽ hiển thị thông báo thành công
    try {
      localStorage.setItem(RELOAD_FLAG_KEY, Date.now().toString())
    } catch {
      // ignore
    }

    options?.onProgress?.('Đang tải lại trang...')

    // 6. Điều hướng tải lại trang với query param chống cache
    const targetUrl = new URL(window.location.href)
    targetUrl.searchParams.set('v_reload', Date.now().toString())
    window.location.replace(targetUrl.toString())
  } catch (err: any) {
    console.error('Lỗi khi tải lại phiên bản mới:', err)
    throw err
  }
}
