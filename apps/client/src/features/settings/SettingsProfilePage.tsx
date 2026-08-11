import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/hooks/useSettingsData'
import { useNotificationsStore } from '@/store/notifications'
import { Loader2 } from 'lucide-react'

export default function SettingsProfilePage() {
  const { user } = useAuth()
  const notify = useNotificationsStore((state) => state.notify)
  const { data: profile, isLoading } = useProfile()
  const updateProfileMutation = useUpdateProfile()
  const uploadAvatarMutation = useUploadAvatar()
  
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(profile?.display_name ?? null)

  const form = useForm({
    defaultValues: {
      displayName: profile?.display_name ?? '',
    },
  })

  const displayName = form.watch('displayName')

  useMemo(() => {
    if (profile) {
      setAvatarUrl(profile.avatar_url ?? null)
      setCurrentDisplayName(profile.display_name ?? null)
      form.reset({ displayName: profile.display_name ?? '' })
    }
  }, [profile, form])

  const uploadAvatar = async (file: File) => {
    try {
      await uploadAvatarMutation.mutateAsync(file)
      notify({
        type: 'success',
        title: 'Avatar updated',
        description: 'Your avatar has been successfully updated.',
      })
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Failed to upload avatar',
        description: err?.message ?? 'There was an error uploading your avatar.',
      })
    }
  }

  const onSubmit = async (values: { displayName: string }) => {
    try {
      await updateProfileMutation.mutateAsync({
        display_name: values.displayName.trim() === '' ? null : values.displayName.trim(),
      })
      setCurrentDisplayName(values.displayName.trim() === '' ? null : values.displayName.trim())
      notify({
        type: 'success',
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      })
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Failed to update profile',
        description: err?.message ?? 'There was an error updating your profile.',
      })
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ người dùng</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Quản lý tên hiển thị và avatar của bạn. Hệ thống sẽ dùng tên hiển thị thay cho email ở thanh topbar nếu có.
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.65fr,1.35fr]">
        <Card className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border bg-muted">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
                {(currentDisplayName ?? user?.email ?? 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="font-semibold">{currentDisplayName || user?.email}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadAvatar(file)
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploadAvatarMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadAvatarMutation.isPending ? 'Đang tải...' : 'Đổi avatar'}
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin hồ sơ</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="displayName">Tên hiển thị</Label>
                <Input
                  id="displayName"
                  {...form.register('displayName')}
                  value={displayName ?? ''}
                  onChange={(e) => {
                    form.setValue('displayName', e.target.value)
                    setCurrentDisplayName(e.target.value)
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting || updateProfileMutation.isPending}>
                  {form.formState.isSubmitting || updateProfileMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.reset({ displayName: profile?.display_name ?? '' })
                    setCurrentDisplayName(profile?.display_name ?? null)
                  }}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
