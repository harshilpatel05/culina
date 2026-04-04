import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

export async function GET(
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

  if (!payload?.restaurant_id) {
    return NextResponse.json({ error: 'Invalid session context' }, { status: 401 })
  }

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('id, table_id')
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  if (!orderData) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { amount, method } = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyJWT(token)

  if (!payload?.restaurant_id) {
    return NextResponse.json({ error: 'Invalid session context' }, { status: 401 })
  }

  const allowedRoles = ['staff', 'manager', 'admin', 'waiter']
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('id, table_id')
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  if (!orderData) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data, error: paymentError } = await supabase
    .from('payments')
    .insert({
      order_id: id,
      amount,
      method
    })
    .select()

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', status: 'completed' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (orderData.table_id) {
    const { error: tableUpdateError } = await supabase
      .from('restaurant_tables')
      .update({ status: 'unoccupied' })
      .eq('id', orderData.table_id)
      .eq('restaurant_id', payload.restaurant_id)

    if (tableUpdateError) {
      return NextResponse.json({ error: tableUpdateError.message }, { status: 500 })
    }
  }

  return NextResponse.json(data)
}