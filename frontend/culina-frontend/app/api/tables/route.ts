import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

const ALLOWED_TABLE_STATUSES = ['available', 'occupied'] as const

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*, restaurants(name)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const status = body.status ?? 'available'

  if (!ALLOWED_TABLE_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid table status' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert({
      restaurant_id: body.restaurant_id,
      table_number: body.table_number,
      capacity: body.capacity,
      status
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}