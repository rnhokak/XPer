import { create } from 'zustand'
import { apiClient } from '@/lib/api/client'

export interface User {
  id: string
  email: string
  display_name?: string
}

export interface AuthResponse {
  user: User
}

export const AUTH_STORAGE_KEY = 'xper:auth:user'

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    // ignore local storage errors
  }
}

interface AuthState {
  user: User | null
  loading: boolean
  isOffline: boolean
  setUser: (user: User | null) => void
  checkAuth: () => Promise<void>
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthResponse>
  signOut: () => Promise<void>
}

const initialUser = getStoredUser()

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  // If we already have a cached user, we don't need to block UI with a loading spinner
  loading: initialUser === null,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,

  setUser: (user) => {
    setStoredUser(user)
    set({ user })
  },

  checkAuth: async () => {
    // If browser reports offline, don't attempt network call; preserve stored user
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ isOffline: true, loading: false })
      return
    }

    try {
      const { data } = await apiClient.get<AuthResponse>('/auth/me')
      setStoredUser(data.user)
      set({ user: data.user, loading: false, isOffline: false })
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401) {
        // Genuine authentication expiration on server
        setStoredUser(null)
        set({ user: null, loading: false, isOffline: false })
      } else {
        // Network error / server down: keep existing cached user so offline works!
        set({ loading: false, isOffline: true })
      }
    }
  },

  signIn: async (email, password) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password })
    setStoredUser(data.user)
    set({ user: data.user, loading: false, isOffline: false })
    return data
  },

  signUp: async (email, password, displayName) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', {
      email,
      password,
      display_name: displayName,
    })
    setStoredUser(data.user)
    set({ user: data.user, loading: false, isOffline: false })
    return data
  },

  signOut: async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore network errors on logout
    }
    setStoredUser(null)
    set({ user: null, loading: false })
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.delete('xper-api-get-cache').catch(() => {})
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'xper:clear-api-cache' })
    }
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAuthStore.setState({ isOffline: false })
    void useAuthStore.getState().checkAuth()
  })
  window.addEventListener('offline', () => {
    useAuthStore.setState({ isOffline: true })
  })

  // Trigger non-blocking session check on startup
  void useAuthStore.getState().checkAuth()
}
