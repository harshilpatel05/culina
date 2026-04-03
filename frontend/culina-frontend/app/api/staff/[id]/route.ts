import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const VALID_STATUS = ['active', 'holiday', 'inactive'] as const
const VALID_ROLES = ['manager', 'chef', 'waiter'] as const

function mapStaffRoleToUserRole(role: string) {
  return role === 'manager' ? 'manager' : 'staff'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('staff')
    .select('*, restaurants(name)')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const staffId = typeof body.staff_id === 'string' ? body.staff_id.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const status = VALID_STATUS.includes(body.status) ? body.status : 'inactive'
  const role = VALID_ROLES.includes(body.role) ? body.role : null

  if (!staffId || !name || !role) {
    return NextResponse.json(
      { error: 'Missing required fields: staff_id, name, role' },
      { status: 400 }
    )
  }

  const updatePayload: {
    staff_id: string | null
    name: string | null
    role: string | null
    salary: number | null
    status: string
  } = {
    staff_id: staffId,
    name,
    role,
    salary: body.salary,
    status
  }

  try {
    // Capture current staff_id so a rename can update the matching users row.
    const { data: existingStaff, error: existingStaffError } = await supabase
      .from('staff')
      .select('staff_id')
      .eq('id', id)
      .single()

    if (existingStaffError) {
      return NextResponse.json({ error: existingStaffError.message }, { status: 500 })
    }

    const previousStaffId = existingStaff.staff_id ?? null

    // Update staff record
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    const userRole = mapStaffRoleToUserRole(role)

    // Prepare user update payload
    const userUpdatePayload: {
      staff_id: string
      restaurant_id: string | null
      name: string
      role: string
      password_hash?: string
    } = {
      staff_id: staffId,
      restaurant_id: body.restaurant_id ?? null,
      name,
      role: userRole
    }

    // Hash and update password if provided
    if (body.password) {
      userUpdatePayload.password_hash = await bcrypt.hash(body.password, 10)
    }

    // Update user record using previous staff_id if it changed.
    const userLookupStaffId = previousStaffId ?? staffId
    const { data: updatedUsers, error: userError } = await supabase
      .from('users')
      .update(userUpdatePayload)
      .eq('staff_id', userLookupStaffId)
      .select('id')

    if (userError) {
      return NextResponse.json(
        { error: `User update failed: ${userError.message}` },
        { status: 500 }
      )
    }

    if (!updatedUsers || updatedUsers.length === 0) {
      if (!body.password) {
        return NextResponse.json(
          {
            error:
              'User profile is missing for this staff member. Provide a password to recreate the staff-auth user.'
          },
          { status: 400 }
        )
      }

      const { error: recreateUserError } = await supabase.from('users').insert({
        restaurant_id: body.restaurant_id ?? null,
        name,
        role: userRole,
        staff_id: staffId,
        password_hash: userUpdatePayload.password_hash
      })

      if (recreateUserError) {
        return NextResponse.json(
          { error: `User recreation failed: ${recreateUserError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(staffData)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  try {
    // Get staff record to find staff_id for user deletion
    const { data: staffData, error: getError } = await supabase
      .from('staff')
      .select('staff_id')
      .eq('id', id)
      .single()

    if (getError) {
      return NextResponse.json({ error: getError.message }, { status: 500 })
    }

    // Delete staff record
    const { error: staffError } = await supabase
      .from('staff')
      .delete()
      .eq('id', id)

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    // Delete corresponding user record by staff_id
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('staff_id', staffData.staff_id)

    if (userError) {
      return NextResponse.json(
        { error: `User deletion failed: ${userError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
