'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'staff' | 'manager' | 'admin'
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter()
  const { user, loading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Redirect to login if not authenticated
      router.push('/staff-login')
      return
    }

    if (!loading && isAuthenticated && requiredRole) {
      // Check if user has required role
      if (requiredRole === 'manager' || requiredRole === 'admin') {
        if (user?.role !== 'manager' && user?.role !== 'admin') {
          // Redirect to waiter dash if not a manager/admin
          router.push('/waiter-dash')
          return
        }
      } else if (user?.role !== requiredRole && user?.role !== 'admin') {
        // User doesn't have required role
        router.push('/staff-login')
        return
      }
    }
  }, [isAuthenticated, loading, router, user, requiredRole])

  // Show loading state while verifying authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // Show nothing while redirecting if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
