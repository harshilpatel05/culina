import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { hashPassword } from '@/utils/password'
import { generateJWT } from '@/utils/jwt'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  try {
    const body = await req.json()

    let {
      restaurant_name,
      restaurant_location,
      manager_name,
      staff_id,
      password,
    } = body

    // ✅ Normalize staff_id (CRITICAL)
    staff_id = staff_id?.trim().toUpperCase()

    // ✅ Validation
    if (
      !restaurant_name ||
      !restaurant_location ||
      !manager_name ||
      !staff_id ||
      !password
    ) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    const staffIdRegex = /^[A-Z0-9]+-?[A-Z0-9]*$/
    if (!staffIdRegex.test(staff_id)) {
      return NextResponse.json(
        { error: 'Invalid staff ID format. Use format like "CUL-1024"' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // 🔹 1. Create restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert({
        name: restaurant_name,
        location: restaurant_location,
        timezone: 'Asia/Kolkata',
      })
      .select('id')
      .single()

    if (restaurantError || !restaurant) {
      console.error('Restaurant error:', restaurantError)
      return NextResponse.json(
        { error: 'Failed to create restaurant' },
        { status: 500 }
      )
    }

    const restaurantId = restaurant.id

    // 🔹 2. Create staff
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .insert({
        staff_id,
        name: manager_name,
        role: 'manager',
        restaurant_id: restaurantId,
        status: 'active',
      })
      .select('id')
      .single()

    if (staffError || !staff) {
      console.error('Staff error:', staffError)

      // rollback
      await supabase.from('restaurants').delete().eq('id', restaurantId)

      return NextResponse.json(
        { error: 'Failed to create staff' },
        { status: 500 }
      )
    }

    // 🔹 3. Hash password
    const passwordHash = await hashPassword(password)

    // 🔹 4. Create user (🔥 handles duplicates safely)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        staff_id,
        name: manager_name,
        password_hash: passwordHash,
        role: 'manager',
        restaurant_id: restaurantId,
      })
      .select('id, staff_id, name, role, restaurant_id, created_at')
      .single()

    if (userError) {
      console.error('User error:', userError)

      // ✅ HANDLE DUPLICATE (THIS FIXES YOUR ISSUE)
      if (userError.code === '23505') {
        await supabase.from('staff').delete().eq('id', staff.id)
        await supabase.from('restaurants').delete().eq('id', restaurantId)

        return NextResponse.json(
          { error: 'Staff ID already exists' },
          { status: 409 }
        )
      }

      // rollback for any other error
      await supabase.from('staff').delete().eq('id', staff.id)
      await supabase.from('restaurants').delete().eq('id', restaurantId)

      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // 🔹 5. Generate JWT
    const jwtToken = await generateJWT({
      id: user.id,
      staff_id: user.staff_id,
      name: user.name,
      role: user.role,
      restaurant_id: user.restaurant_id,
    })

    // 🔹 6. Response
    const response = NextResponse.json(
      {
        success: true,
        user,
        message: `Manager account created successfully. Welcome ${user.name}!`,
      },
      { status: 201 }
    )

    response.cookies.set({
      name: 'auth-token',
      value: jwtToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}