import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const VALID_STATUS = ['active', 'holiday', 'inactive'] as const
const VALID_ROLES = ['manager', 'chef', 'waiter'] as const

function mapStaffRoleToUserRole(role: string) {
  return role === 'manager' ? 'manager' : 'staff'
}

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
  const staffId = typeof body.staff_id === 'string' ? body.staff_id.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const status = VALID_STATUS.includes(body.status) ? body.status : 'inactive'
  const role = VALID_ROLES.includes(body.role) ? body.role : null
  const password = typeof body.password === 'string' ? body.password : ''

  // Validate required fields
  if (!staffId || !name || !role || !password) {
    return NextResponse.json(
      { error: 'Missing required fields: staff_id, name, role, password' },
      { status: 400 }
    )
  }

  try {
    // Hash the password for user storage
    const passwordHash = await bcrypt.hash(password, 10)

    // Create staff record
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .insert({
        staff_id: staffId,
        restaurant_id: body.restaurant_id,
        name,
        role,
        salary: body.salary,
        status
      })
      .select()
      .single()

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    const userRole = mapStaffRoleToUserRole(role)

    const userPayload = {
      restaurant_id: body.restaurant_id,
      name,
      password_hash: passwordHash,
      role: userRole,
      staff_id: staffId
    }

    // Keep users profile synchronized with staff profile without requiring a DB upsert constraint.
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id')
      .eq('staff_id', staffId)
      .maybeSingle()

    if (existingUserError) {
      return NextResponse.json(
        { error: `User lookup failed: ${existingUserError.message}` },
        { status: 500 }
      )
    }

    let userData: unknown = null
    let userError: { message: string } | null = null

    if (existingUser?.id) {
      const result = await supabase
        .from('users')
        .update(userPayload)
        .eq('id', existingUser.id)
        .select()
        .single()

      userData = result.data
      userError = result.error
    } else {
      const result = await supabase
        .from('users')
        .insert(userPayload)
        .select()
        .single()

      userData = result.data
      userError = result.error
    }

    if (userError) {
      // If user creation fails, try to delete the staff record to maintain consistency
      const { error: rollbackError } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffData.id)

      if (rollbackError) {
        return NextResponse.json(
          {
            error: `User sync failed and rollback failed: ${userError.message}. Rollback error: ${rollbackError.message}`
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: `User sync failed: ${userError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      staff: staffData,
      user: userData
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}