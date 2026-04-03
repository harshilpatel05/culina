import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

const ALLOWED_STATUSES = ['placed', 'preparing', 'served', 'completed', 'cancelled'] as const

const TRANSITION_RULES: Record<string, string[]> = {
  placed: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: []
}

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
    .select('id')
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
    .from('order_status_logs')
    .select('*')
    .eq('order_id', id)
    .order('timestamp', { ascending: false })

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
  const { status } = await req.json()
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

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  const { data: existingOrder, error: existingOrderError } = await supabase
    .from('orders')
    .select('id, status, table_id')
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .single()

  if (existingOrderError) {
    return NextResponse.json({ error: existingOrderError.message }, { status: 500 })
  }

  const validNextStatuses = TRANSITION_RULES[existingOrder.status] || []
  if (!validNextStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${existingOrder.status} to ${status}` },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data, error: logError } = await supabase
    .from('order_status_logs')
    .insert({
      order_id: id,
      status
    })
    .select()

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  const tableStatus = status === 'completed' || status === 'cancelled' ? 'available' : 'occupied'

  const { error: tableError } = await supabase
    .from('restaurant_tables')
    .update({ status: tableStatus })
    .eq('id', existingOrder.table_id)
    .eq('restaurant_id', payload.restaurant_id)

  if (tableError) {
    return NextResponse.json({ error: tableError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}