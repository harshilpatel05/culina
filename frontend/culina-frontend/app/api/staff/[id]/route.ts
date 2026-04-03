import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

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
  const validStatus = ['active', 'holiday', 'inactive']
  const validRoles = ['manager', 'chef', 'waiter']
  const status = validStatus.includes(body.status) ? body.status : 'inactive'
  const role = validRoles.includes(body.role) ? body.role : null
  const updatePayload: {
    staff_id: string | null
    name: string | null
    role: string | null
    salary: number | null
    status: string
  } = {
    staff_id: body.staff_id ?? null,
    name: body.name,
    role,
    salary: body.salary,
    status
  }

  try {
    // Update staff record
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .update(updatePayload)
      .eq('id', id)
      .select()

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    // Prepare user update payload
    const userUpdatePayload: {
      name: string | null
      role?: string
      password_hash?: string
    } = {
      name: body.name
    }

    // Map staff role to user role if role changed
    if (role) {
      const userRoleMap: Record<string, string> = {
        manager: 'manager',
        chef: 'staff',
        waiter: 'staff'
      }
      userUpdatePayload.role = userRoleMap[role] || 'staff'
    }

    // Hash and update password if provided
    if (body.password) {
      userUpdatePayload.password_hash = await bcrypt.hash(body.password, 10)
    }

    // Update user record by staff_id
    const { error: userError } = await supabase
      .from('users')
      .update(userUpdatePayload)
      .eq('staff_id', body.staff_id ?? staffData[0]?.staff_id)

    if (userError) {
      return NextResponse.json(
        { error: `User update failed: ${userError.message}` },
        { status: 500 }
      )
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
