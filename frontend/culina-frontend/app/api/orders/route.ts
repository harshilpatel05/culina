import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name), restaurant_tables(table_number), staff(name), restaurants(name)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('orders')
    .insert({
      restaurant_id: body.restaurant_id,
      customer_id: body.customer_id,
      table_id: body.table_id,
      taken_by: body.taken_by,
      status: body.status || 'placed',
      payment_status: body.payment_status || 'pending',
      num_people: body.num_people,
      total_amount: body.total_amount || 0
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('orders')
    .update({
      customer_id: body.customer_id,
      table_id: body.table_id,
      taken_by: body.taken_by,
      status: body.status,
      payment_status: body.payment_status,
      num_people: body.num_people,
      total_amount: body.total_amount
    })
    .eq('id', body.id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
