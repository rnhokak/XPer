import { useAuthStore, type User, type AuthResponse } from '@/store/auth'

export type { User, AuthResponse }

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  const isOffline = useAuthStore((state) => state.isOffline)
  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)
  const signOut = useAuthStore((state) => state.signOut)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  return { user, loading, isOffline, signIn, signUp, signOut, checkAuth }
}
