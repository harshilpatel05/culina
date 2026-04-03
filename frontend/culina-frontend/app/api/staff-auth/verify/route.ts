import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      )
    }

    // Verify JWT token
    const payload = await verifyJWT(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Token is valid, return user info
    return NextResponse.json({
      success: true,
      user: {
        id: payload.id,
        staff_id: payload.staff_id,
        name: payload.name,
        role: payload.role,
        restaurant_id: payload.restaurant_id
      },
      message: 'Session verified'
    })

  } catch (error) {
    console.error('Session verification error:', error)
    return NextResponse.json(
      { error: 'An error occurred during session verification' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to verify session' },
    { status: 405 }
  )
}
