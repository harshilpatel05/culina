import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { generateJWT } from '@/utils/jwt'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get staff_id and password from request body
    const body = await req.json()
    const { staff_id, password } = body

    // Validation: Check if staff_id and password are provided
    if (!staff_id || !password) {
      return NextResponse.json(
        { error: 'Staff ID and password are required' },
        { status: 400 }
      )
    }

    // Query users table by staff_id
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id, staff_id, name, role, restaurant_id, password_hash, created_at')
      .eq('staff_id', staff_id)
      .single()

    if (queryError || !user) {
      return NextResponse.json(
        { error: 'Invalid staff ID or password' },
        { status: 401 }
      )
    }

    // Password validation using bcrypt
    if (user.password_hash) {
      const passwordMatch = await bcrypt.compare(password, user.password_hash)
      
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Invalid staff ID or password' },
          { status: 401 }
        )
      }
    } else {
      // If no password_hash is set, authentication fails
      return NextResponse.json(
        { error: 'User account is not properly configured' },
        { status: 401 }
      )
    }

    // Generate JWT token with user profile
    const jwtToken = generateJWT({
      id: user.id,
      staff_id: user.staff_id,
      name: user.name,
      role: user.role,
      restaurant_id: user.restaurant_id
    })

    // Set JWT in httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        staff_id: user.staff_id,
        name: user.name,
        role: user.role,
        restaurant_id: user.restaurant_id,
        created_at: user.created_at,
        authenticatedAt: new Date().toISOString()
      },
      message: `Login successful. Welcome ${user.name}`
    })

    // Set secure httpOnly cookie
    response.cookies.set({
      name: 'auth-token',
      value: jwtToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return response

  } catch (error) {
    console.error('Staff auth error:', error)
    return NextResponse.json(
      { error: 'An error occurred during authentication' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST for authentication' },
    { status: 405 }
  )
}
