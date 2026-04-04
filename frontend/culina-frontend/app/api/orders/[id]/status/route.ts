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

async function deductInventoryForOrder(
  supabase: ReturnType<typeof createClient>,
  orderId: string
) {
  const { data: orderItems, error: orderItemsError } = await supabase
    .from('order_items')
    .select('dish_id, quantity')
    .eq('order_id', orderId)

  if (orderItemsError) {
    throw new Error(orderItemsError.message)
  }

  if (!orderItems || orderItems.length === 0) {
    return
  }

  const dishIds = Array.from(new Set(orderItems.map((item) => item.dish_id).filter(Boolean)))
  if (dishIds.length === 0) {
    return
  }

  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('dish_id, ingredient_id, quantity')
    .in('dish_id', dishIds)

  if (recipesError) {
    throw new Error(recipesError.message)
  }

  if (!recipes || recipes.length === 0) {
    return
  }

  const orderQtyByDish = new Map<string, number>()
  orderItems.forEach((item) => {
    if (!item.dish_id) {
      return
    }

    const dishId = String(item.dish_id)
    const qty = Math.max(0, Number(item.quantity) || 0)
    orderQtyByDish.set(dishId, (orderQtyByDish.get(dishId) || 0) + qty)
  })

  const ingredientUsage = new Map<string, number>()
  recipes.forEach((recipe) => {
    if (!recipe.ingredient_id || !recipe.dish_id) {
      return
    }

    const dishQty = orderQtyByDish.get(String(recipe.dish_id)) || 0
    if (dishQty <= 0) {
      return
    }

    const perDishQty = Math.max(0, Number(recipe.quantity) || 0)
    const usage = perDishQty * dishQty
    if (usage <= 0) {
      return
    }

    const ingredientId = String(recipe.ingredient_id)
    ingredientUsage.set(ingredientId, (ingredientUsage.get(ingredientId) || 0) + usage)
  })

  if (ingredientUsage.size === 0) {
    return
  }

  const ingredientIds = Array.from(ingredientUsage.keys())

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventory')
    .select('id, ingredient_id, current_stock')
    .in('ingredient_id', ingredientIds)

  if (inventoryError) {
    throw new Error(inventoryError.message)
  }

  if (!inventoryRows || inventoryRows.length === 0) {
    return
  }

  for (const row of inventoryRows) {
    if (!row.ingredient_id) {
      continue
    }

    const ingredientId = String(row.ingredient_id)
    const usedQty = ingredientUsage.get(ingredientId)
    if (!usedQty || usedQty <= 0) {
      continue
    }

    const currentStock = Number(row.current_stock) || 0
    const nextStock = Math.max(0, currentStock - usedQty)

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ current_stock: nextStock })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }
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

  // UI labels "Dish Ready" as `preparing`. Deduct recipe ingredient usage on that transition.
  if (existingOrder.status === 'placed' && status === 'preparing') {
    try {
      await deductInventoryForOrder(supabase, id)
    } catch (deductionError) {
      const errorMessage = deductionError instanceof Error ? deductionError.message : 'Failed to deduct inventory'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
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