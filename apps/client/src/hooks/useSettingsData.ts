import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  getReportRuns,
  createReportRun,
  updateReportRun,
  deleteReportRun,
  getTelegramLink,
  generateTelegramLinkCode,
  unlinkTelegram,
} from '@/lib/api/settings'

// Profile hooks
const profileQueryKey = ['settings', 'profile']

export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: getProfile,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: { display_name?: string | null; avatar_url?: string | null }) =>
      updateProfile(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey })
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey })
    },
  })
}

// Report Dates hooks
const reportRunsQueryKey = ['settings', 'report-runs']

export function useReportRuns() {
  return useQuery({
    queryKey: reportRunsQueryKey,
    queryFn: getReportRuns,
  })
}

export function useCreateReportRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: { type: string; report_date: string; note?: string | null }) =>
      createReportRun(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportRunsQueryKey })
    },
  })
}

export function useUpdateReportRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: { type: string; report_date: string; note?: string | null } }) =>
      updateReportRun(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportRunsQueryKey })
    },
  })
}

export function useDeleteReportRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteReportRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportRunsQueryKey })
    },
  })
}

// Telegram hooks
const telegramLinkQueryKey = ['settings', 'telegram-link']

export function useTelegramLink() {
  return useQuery({
    queryKey: telegramLinkQueryKey,
    queryFn: getTelegramLink,
  })
}

export function useGenerateTelegramLinkCode() {
  return useMutation({
    mutationFn: generateTelegramLinkCode,
  })
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telegramLinkQueryKey })
    },
  })
}
