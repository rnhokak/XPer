import { apiClient } from './client'

export type Profile = {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type ReportRun = {
  id: string
  user_id: string
  type: 'cashflow' | 'trading' | 'funding'
  report_date: string
  note: string | null
  created_at: string
  updated_at: string
}

export type TelegramLink = {
  telegram_user_id: number
  telegram_chat_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  created_at: string | null
  updated_at: string | null
}

export type LinkCode = {
  code: string
  expires_at: string
}

// Profile API
export async function getProfile(): Promise<Profile> {
  const response = await apiClient.get<Profile>('/settings/profile')
  return response.data
}

export async function updateProfile(values: { display_name?: string | null; avatar_url?: string | null }): Promise<Profile> {
  const response = await apiClient.put<Profile>('/settings/profile', values)
  return response.data
}

export async function uploadAvatar(file: File): Promise<{ publicUrl: string }> {
  const formData = new FormData()
  formData.append('avatar', file)
  const response = await apiClient.post<{ publicUrl: string }>('/settings/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

// Report Dates API
export async function getReportRuns(): Promise<ReportRun[]> {
  const response = await apiClient.get<ReportRun[]>('/settings/report-runs')
  return response.data
}

export async function createReportRun(values: { type: string; report_date: string; note?: string | null }): Promise<ReportRun> {
  const response = await apiClient.post<ReportRun>('/settings/report-runs', values)
  return response.data
}

export async function updateReportRun(id: string, values: { type: string; report_date: string; note?: string | null }): Promise<ReportRun> {
  const response = await apiClient.put<ReportRun>('/settings/report-runs', { id, ...values })
  return response.data
}

export async function deleteReportRun(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>('/settings/report-runs', {
    data: { id },
  })
  return response.data
}

// Telegram API
export async function getTelegramLink(): Promise<TelegramLink | null> {
  const response = await apiClient.get<TelegramLink | null>('/settings/telegram/link')
  return response.data
}

export async function generateTelegramLinkCode(): Promise<LinkCode> {
  const response = await apiClient.post<LinkCode>('/settings/telegram/link-code')
  return response.data
}

export async function unlinkTelegram(): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>('/settings/telegram/link')
  return response.data
}
