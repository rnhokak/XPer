import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'

export interface User {
  id: string
  email: string
  display_name?: string
}

export interface AuthResponse {
  user: User
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const boot = async () => {
      try {
        const { data } = await apiClient.get<AuthResponse>('/auth/me')
        if (isMounted) {
          setUser(data.user)
        }
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
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
      setUser(data.user)
      return data
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    await apiClient.post('/auth/logout')
    setUser(null)
  }

  return { user, loading, signIn, signUp, signOut }
}
