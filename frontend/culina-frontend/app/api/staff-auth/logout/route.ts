import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    
    // Clear the auth token cookie
    cookieStore.delete('auth-token')

    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST for logout' },
    { status: 405 }
  )
}
