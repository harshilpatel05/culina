import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyJWT(token)

  if (!payload?.staff_id || !payload.restaurant_id) {
    return NextResponse.json({ error: 'Invalid session context' }, { status: 401 })
  }

  if (payload.role !== 'staff' && payload.role !== 'waiter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: staffRecord, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', payload.staff_id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (staffError) {
    return NextResponse.json({ error: staffError.message }, { status: 500 })
  }

  if (!staffRecord?.id) {
    return NextResponse.json({ error: 'Staff profile not found for session' }, { status: 404 })
  }

  const { data: shiftRecord, error: shiftLookupError } = await supabase
    .from('shifts')
    .select('id, staff_id, start_time, end_time')
    .eq('id', id)
    .eq('staff_id', staffRecord.id)
    .maybeSingle()

  if (shiftLookupError) {
    return NextResponse.json({ error: shiftLookupError.message }, { status: 500 })
  }

  if (!shiftRecord) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (shiftRecord.end_time) {
    return NextResponse.json({ error: 'Shift is already ended' }, { status: 409 })
  }

  const nowIso = new Date().toISOString()

  if (new Date(nowIso).getTime() <= new Date(shiftRecord.start_time).getTime()) {
    return NextResponse.json({ error: 'Invalid shift end time' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('shifts')
    .update({ end_time: nowIso })
    .eq('id', id)
    .eq('staff_id', staffRecord.id)
    .select('id, staff_id, start_time, end_time')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ shift: data })
}
