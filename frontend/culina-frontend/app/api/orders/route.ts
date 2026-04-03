import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

type CreateOrderItemInput = {
  dish_id: string
  quantity: number
}

export async function GET() {
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

  let query = supabase
    .from('orders')
    .select('*, customers(name), restaurant_tables(table_number), staff(name), restaurants(name), order_items(quantity, price, dishes(name))')
    .eq('restaurant_id', payload.restaurant_id)

  // Waiter/staff dashboards should only see their own active tables.
  if (payload.role === 'staff' || payload.role === 'waiter') {
    const { data: staffRecord, error: staffLookupError } = await supabase
      .from('staff')
      .select('id')
      .eq('staff_id', payload.staff_id)
      .eq('restaurant_id', payload.restaurant_id)
      .single()

    if (staffLookupError || !staffRecord?.id) {
      return NextResponse.json(
        { error: 'Staff profile not found for current session' },
        { status: 400 }
      )
    }

    query = query
      .eq('taken_by', staffRecord.id)
      .in('status', ['placed', 'preparing', 'served'])
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyJWT(token)

  if (!payload?.restaurant_id || !payload.staff_id) {
    return NextResponse.json({ error: 'Invalid session context' }, { status: 401 })
  }

  const { data: staffRecord, error: staffLookupError } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', payload.staff_id)
    .eq('restaurant_id', payload.restaurant_id)
    .single()

  if (staffLookupError || !staffRecord?.id) {
    return NextResponse.json(
      { error: 'Staff profile not found for current session' },
      { status: 400 }
    )
  }

  const allowedRoles = ['staff', 'manager', 'admin', 'waiter']
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!body.table_id) {
    return NextResponse.json({ error: 'table_id is required' }, { status: 400 })
  }

  const items = Array.isArray(body.items) ? (body.items as CreateOrderItemInput[]) : []

  if (items.length === 0) {
    return NextResponse.json({ error: 'At least one order item is required' }, { status: 400 })
  }

  const normalizedItems = items
    .map((item) => ({
      dish_id: item?.dish_id,
      quantity: Math.max(1, Number(item?.quantity) || 0)
    }))
    .filter((item) => item.dish_id)

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: 'Invalid order items payload' }, { status: 400 })
  }

  const activeStatuses = ['placed', 'preparing', 'served']
  const { data: tableConflict, error: tableConflictError } = await supabase
    .from('orders')
    .select('id')
    .eq('table_id', body.table_id)
    .eq('restaurant_id', payload.restaurant_id)
    .in('status', activeStatuses)
    .limit(1)

  if (tableConflictError) {
    return NextResponse.json({ error: tableConflictError.message }, { status: 500 })
  }

  if (tableConflict && tableConflict.length > 0) {
    return NextResponse.json(
      { error: 'This table already has an active order' },
      { status: 409 }
    )
  }

  const dishIds = normalizedItems.map((item) => item.dish_id)
  const { data: dishes, error: dishesError } = await supabase
    .from('dishes')
    .select('id, name, price, is_active')
    .eq('restaurant_id', payload.restaurant_id)
    .in('id', dishIds)

  if (dishesError) {
    return NextResponse.json({ error: dishesError.message }, { status: 500 })
  }

  if (!dishes || dishes.length !== dishIds.length) {
    return NextResponse.json(
      { error: 'One or more dish items are invalid for this restaurant' },
      { status: 400 }
    )
  }

  const dishMap = new Map(
    dishes.map((dish) => [dish.id, { price: Number(dish.price || 0), is_active: dish.is_active }])
  )

  const inactiveDish = normalizedItems.find((item) => !dishMap.get(item.dish_id)?.is_active)
  if (inactiveDish) {
    return NextResponse.json(
      { error: 'One or more selected dishes are inactive' },
      { status: 400 }
    )
  }

  const orderItemsPayload = normalizedItems.map((item) => {
    const dish = dishMap.get(item.dish_id)
    const price = dish?.price ?? 0
    return {
      dish_id: item.dish_id,
      quantity: item.quantity,
      price,
      total: price * item.quantity,
      prep_time: null
    }
  })

  const totalAmount = orderItemsPayload.reduce((sum, item) => sum + item.total, 0)

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: payload.restaurant_id,
      customer_id: body.customer_id ?? null,
      table_id: body.table_id,
      taken_by: staffRecord.id,
      status: 'placed',
      payment_status: body.payment_status || 'pending',
      num_people: Math.max(1, Number(body.num_people) || 1),
      total_amount: totalAmount
    })
    .select()
    .single()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  const itemsWithOrderId = orderItemsPayload.map((item) => ({
    order_id: orderData.id,
    dish_id: item.dish_id,
    quantity: item.quantity,
    price: item.price,
    total: item.total,
    prep_time: item.prep_time
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsWithOrderId)
    .select('id, dish_id, quantity, price, total')

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderData.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const { error: statusLogError } = await supabase.from('order_status_logs').insert({
    order_id: orderData.id,
    status: 'placed'
  })

  if (statusLogError) {
    await supabase.from('order_items').delete().eq('order_id', orderData.id)
    await supabase.from('orders').delete().eq('id', orderData.id)
    return NextResponse.json({ error: statusLogError.message }, { status: 500 })
  }

  const { error: tableUpdateError } = await supabase
    .from('restaurant_tables')
    .update({ status: 'occupied' })
    .eq('id', body.table_id)
    .eq('restaurant_id', payload.restaurant_id)

  if (tableUpdateError) {
    await supabase.from('order_items').delete().eq('order_id', orderData.id)
    await supabase.from('orders').delete().eq('id', orderData.id)
    return NextResponse.json({ error: tableUpdateError.message }, { status: 500 })
  }

  return NextResponse.json({
    order: orderData,
    items: insertedItems
  })
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
