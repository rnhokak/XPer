import axios from 'axios'
import { API_BASE_URL, APP_BASE_PATH } from '@/lib/env'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (typeof error.config & { _retry?: boolean })
    const status = error.response?.status

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }

    if (typeof original.url === 'string' && original.url.includes('/auth/')) {
      return Promise.reject(error)
    }

    original._retry = true
    window.location.href = `${APP_BASE_PATH}/auth/login`
    return Promise.reject(error)
  }
)
