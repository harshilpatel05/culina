'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    verifySession()
  }, [])

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
      await fetch('/api/staff-auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      router.push('/staff-login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    refreshSession: verifySession
  }
}
