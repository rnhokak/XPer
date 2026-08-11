import axios from 'axios'
import { API_BASE_URL, APP_BASE_PATH } from '@/lib/env'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const AUTH_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

const setTokensFromSession = (session?: { access_token?: string; refresh_token?: string }) => {
  const accessToken = session?.access_token
  const refreshToken = session?.refresh_token
  if (accessToken) {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken)
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
  return accessToken ?? null
}

// Request interceptor for adding auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (typeof error.config & { _retry?: boolean })
    const status = error.response?.status

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }

    if (typeof original.url === 'string' && original.url.includes('/auth/refresh')) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      window.location.href = `${APP_BASE_PATH}/auth/login`
      return Promise.reject(error)
    }

    original._retry = true
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

    if (!refreshToken) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      window.location.href = `${APP_BASE_PATH}/auth/login`
      return Promise.reject(error)
    }

    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = apiClient
        .post('/auth/refresh', { refresh_token: refreshToken })
        .then(({ data }) => {
          return setTokensFromSession(data.session)
        })
        .catch(() => {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          return null
        })
        .finally(() => {
          isRefreshing = false
        })
    }

    const newToken = await refreshPromise
    if (!newToken) {
      window.location.href = `${APP_BASE_PATH}/auth/login`
      return Promise.reject(error)
    }

    original.headers = original.headers ?? {}
    original.headers.Authorization = `Bearer ${newToken}`
    return apiClient(original)
  }
)
