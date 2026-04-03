import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('staff')
    .select('*, restaurants(name)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const validStatus = ['active', 'holiday', 'inactive']
  const validRoles = ['manager', 'chef', 'waiter']
  const status = validStatus.includes(body.status) ? body.status : 'inactive'
  const role = validRoles.includes(body.role) ? body.role : null

  // Validate required fields
  if (!body.staff_id || !body.name || !role || !body.password) {
    return NextResponse.json(
      { error: 'Missing required fields: staff_id, name, role, password' },
      { status: 400 }
    )
  }

  try {
    // Hash the password for user storage
    const passwordHash = await bcrypt.hash(body.password, 10)

    // Create staff record
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .insert({
        staff_id: body.staff_id,
        restaurant_id: body.restaurant_id,
        name: body.name,
        role,
        salary: body.salary,
        status
      })
      .select()

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    // Map staff role to user role
    const userRoleMap: Record<string, string> = {
      manager: 'manager',
      chef: 'staff',
      waiter: 'staff'
    }
    const userRole = userRoleMap[role] || 'staff'

    // Create corresponding user record for authentication
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        restaurant_id: body.restaurant_id,
        name: body.name,
        password_hash: passwordHash,
        role: userRole,
        staff_id: body.staff_id
      })
      .select()

    if (userError) {
      // If user creation fails, try to delete the staff record to maintain consistency
      await supabase.from('staff').delete().eq('id', staffData[0].id)
      return NextResponse.json(
        { error: `User creation failed: ${userError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      staff: staffData[0],
      user: userData[0]
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}