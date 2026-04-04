import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { hashPassword } from '@/utils/password'
import { generateJWT } from '@/utils/jwt'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Parse request body
    const body = await req.json()
    const {
      restaurant_name,
      restaurant_location,
      manager_name,
      manager_email,
      staff_id,
      password,
    } = body

    // Validation: Check if all required fields are provided
    if (
      !restaurant_name ||
      !restaurant_location ||
      !manager_name ||
      !manager_email ||
      !staff_id ||
      !password
    ) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(manager_email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate staff ID format (alphanumeric with optional hyphen)
    const staffIdRegex = /^[A-Z0-9]+-?[A-Z0-9]*$/
    if (!staffIdRegex.test(staff_id)) {
      return NextResponse.json(
        { error: 'Invalid staff ID format. Use format like "CUL-1024"' },
        { status: 400 }
      )
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if staff_id already exists in users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('staff_id', staff_id)
      .single()

    // If no error but data exists, staff_id is already taken
    if (!checkError && existingUser) {
      return NextResponse.json(
        { error: 'Staff ID already exists. Please choose a different one.' },
        { status: 409 }
      )
    }

    // Begin transaction: Create restaurant, staff, and user records
    // Note: Supabase doesn't have explicit transactions, so we'll do sequential inserts
    // and handle errors appropriately

    // 1. Create restaurant record
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert({
        name: restaurant_name,
        location: restaurant_location,
        timezone: 'Asia/Kolkata', // Default timezone
      })
      .select('id')
      .single()

    if (restaurantError || !restaurant) {
      console.error('Restaurant creation error:', restaurantError)
      return NextResponse.json(
        { error: 'Failed to create restaurant record' },
        { status: 500 }
      )
    }

    const restaurantId = restaurant.id

    // 2. Create staff record
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .insert({
        staff_id: staff_id,
        name: manager_name,
        role: 'manager',
        restaurant_id: restaurantId,
        status: 'active',
      })
      .select('id')
      .single()

    if (staffError || !staff) {
      console.error('Staff creation error:', staffError)
      // Rollback: Delete restaurant
      await supabase.from('restaurants').delete().eq('id', restaurantId)
      return NextResponse.json(
        { error: 'Failed to create staff record' },
        { status: 500 }
      )
    }

    // 3. Hash password
    const passwordHash = await hashPassword(password)

    // 4. Create user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        staff_id: staff_id,
        name: manager_name,
        email: manager_email,
        password_hash: passwordHash,
        role: 'manager',
        restaurant_id: restaurantId,
      })
      .select('id, staff_id, name, email, role, restaurant_id, created_at')
      .single()

    if (userError || !user) {
      console.error('User creation error:', userError)
      // Rollback: Delete staff and restaurant
      await supabase.from('staff').delete().eq('id', staff.id)
      await supabase.from('restaurants').delete().eq('id', restaurantId)
      return NextResponse.json(
        { error: 'Failed to create user record' },
        { status: 500 }
      )
    }

    // 5. Generate JWT token
    const jwtToken = await generateJWT({
      id: user.id,
      staff_id: user.staff_id,
      name: user.name,
      role: user.role,
      restaurant_id: user.restaurant_id,
    })

    // 6. Create response with JWT in httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        staff_id: user.staff_id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant_id: user.restaurant_id,
        created_at: user.created_at,
      },
      message: `Manager account created successfully. Welcome ${user.name}!`,
    }, { status: 201 })

    // Set secure httpOnly cookie
    response.cookies.set({
      name: 'auth-token',
      value: jwtToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error('Sign up error:', error)
    return NextResponse.json(
      { error: 'An error occurred during sign up' },
      { status: 500 }
    )
  }
}
