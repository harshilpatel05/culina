import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

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
    password?: string
  } = {
    staff_id: body.staff_id ?? null,
    name: body.name,
    role,
    salary: body.salary,
    status
  }

  if (body.password) {
    updatePayload.password = body.password
  }

  const { data, error } = await supabase
    .from('staff')
    .update(updatePayload)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
