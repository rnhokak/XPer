import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'

export interface User {
  id: string
  email: string
  display_name?: string
}

export interface AuthResponse {
  user: User
  token?: string
  session?: {
    access_token?: string
    refresh_token?: string
  }
}

const AUTH_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

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

const getTokenExpiry = (token: string) => {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const exp = typeof payload?.exp === 'number' ? payload.exp : null
    return exp
  } catch {
    return null
  }
}

const isTokenExpiring = (token: string, skewSeconds = 60) => {
  const exp = getTokenExpiry(token)
  if (!exp) return false
  const now = Math.floor(Date.now() / 1000)
  return now >= exp - skewSeconds
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const boot = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY)
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

      if (refreshToken && (!token || isTokenExpiring(token))) {
        try {
          const { data } = await apiClient.post<AuthResponse>('/auth/refresh', {
            refresh_token: refreshToken,
          })
          setTokensFromSession(data.session)
          if (isMounted) {
            setUser(data.user)
            setLoading(false)
          }
          return
        } catch {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          if (isMounted) {
            setUser(null)
            setLoading(false)
          }
          return
        }
      }

      if (token) {
        try {
          const { data } = await apiClient.get('/auth/me')
          if (isMounted) {
            setUser(data.user)
          }
        } catch {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          if (isMounted) {
            setUser(null)
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
        return
      }

      if (isMounted) {
        setLoading(false)
      }
    }

    boot()
    return () => {
      isMounted = false
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password })
      const token = data.token ?? data.session?.access_token
      const refreshToken = data.session?.refresh_token
      setTokensFromSession(data.session ?? { access_token: token, refresh_token: refreshToken })
      setUser(data.user)
      return data
    } catch (error) {
      throw error
    }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', {
        email,
        password,
        display_name: displayName
      })
      const token = data.token ?? data.session?.access_token
      const refreshToken = data.session?.refresh_token
      setTokensFromSession(data.session ?? { access_token: token, refresh_token: refreshToken })
      setUser(data.user)
      return data
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    await apiClient.post('/auth/logout')
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    setUser(null)
  }

  return { user, loading, signIn, signUp, signOut }
}
