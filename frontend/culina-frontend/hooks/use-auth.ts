import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface User {
  id: string
  staff_id: string
  name: string
  role: string
  restaurant_id: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const verifySession = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/staff-auth/verify', {
        method: 'GET',
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Session verification error:', err)
      setError(err instanceof Error ? err.message : 'Failed to verify session')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      const response = await fetch('/api/staff-auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? 'Logout failed'
        throw new Error(message)
      }
      setUser(null)
      router.push('/staff-login')
    } catch (err) {
      console.error('Logout error:', err)
      throw err
    }
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({
          id: session.user.id,
          staff_id: '',
          name: session.user.user_metadata.name || session.user.email,
          role: session.user.user_metadata.role || 'manager',
          restaurant_id: session.user.user_metadata.restaurant_id || null,
        })
        setLoading(false)
      } else {
        verifySession()
      }
    })
    // eslint-disable-next-line
  }, [])

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    refreshSession: verifySession
  }
}