import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

function ensureTimezone(timestamp: string | null) {
  if (!timestamp) {
    return timestamp
  }

  // Some DB timestamp columns may return values without timezone offsets.
  // Treat them as UTC to avoid local offset drift (e.g. +05:30 in IST).
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(timestamp)) {
    return timestamp
  }

  return `${timestamp}Z`
}

export async function GET() {
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

  const { data, error } = await supabase
    .from('shifts')
    .select('id, staff_id, start_time, end_time')
    .eq('staff_id', staffRecord.id)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const normalizedShift = data
    ? {
        ...data,
        start_time: ensureTimezone(data.start_time),
        end_time: ensureTimezone(data.end_time),
      }
    : null

  return NextResponse.json({ activeShift: normalizedShift })
}
