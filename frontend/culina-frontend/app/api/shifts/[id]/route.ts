import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

async function getShiftSessionContext() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const payload = await verifyJWT(token)

  if (!payload?.staff_id || !payload.restaurant_id) {
    return { error: NextResponse.json({ error: 'Invalid session context' }, { status: 401 }) }
  }

  const { data: staffRecord, error: staffError } = await supabase
    .from('staff')
    .select('id, role, restaurant_id')
    .eq('staff_id', payload.staff_id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (staffError) {
    return { error: NextResponse.json({ error: staffError.message }, { status: 500 }) }
  }

  if (!staffRecord?.id) {
    return { error: NextResponse.json({ error: 'Staff profile not found for session' }, { status: 404 }) }
  }

  return {
    error: null,
    payload,
    supabase,
    staffRecord,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const context = await getShiftSessionContext()

  if (context.error) {
    return context.error
  }

  const { supabase, payload, staffRecord } = context

  let query = supabase
    .from('shifts')
    .select('*, staff!inner(id, name, role, restaurant_id)')
    .eq('id', id)
    .eq('staff.restaurant_id', payload.restaurant_id)

  if (payload.role === 'staff' || payload.role === 'waiter') {
    query = query.eq('staff_id', staffRecord.id)
  }

  const { data, error } = await query.single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const context = await getShiftSessionContext()

  if (context.error) {
    return context.error
  }

  const { supabase, payload } = context

  if (payload.role !== 'manager' && payload.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: accessibleShift, error: accessibleShiftError } = await supabase
    .from('shifts')
    .select('id, staff!inner(restaurant_id)')
    .eq('id', id)
    .eq('staff.restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (accessibleShiftError) {
    return NextResponse.json({ error: accessibleShiftError.message }, { status: 500 })
  }

  if (!accessibleShift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('shifts')
    .update({
      staff_id: body.staff_id,
      start_time: body.start_time,
      end_time: body.end_time
    })
    .eq('id', id)
    .select('*, staff(name, role, restaurant_id)')

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
  const context = await getShiftSessionContext()

  if (context.error) {
    return context.error
  }

  const { supabase, payload } = context

  if (payload.role !== 'manager' && payload.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: accessibleShift, error: accessibleShiftError } = await supabase
    .from('shifts')
    .select('id, staff!inner(restaurant_id)')
    .eq('id', id)
    .eq('staff.restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (accessibleShiftError) {
    return NextResponse.json({ error: accessibleShiftError.message }, { status: 500 })
  }

  if (!accessibleShift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
