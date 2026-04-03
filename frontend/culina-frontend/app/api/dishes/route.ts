import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url)
  const menuId = searchParams.get('menu_id')
  const isActiveParam = searchParams.get('is_active')

  let query = supabase
    .from('dishes')
    .select('*, restaurants(name), menus(name)')
    .eq('restaurant_id', payload.restaurant_id)

  if (menuId) {
    query = query.eq('menu_id', menuId)
  }

  if (isActiveParam === 'true') {
    query = query.eq('is_active', true)
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

  const { data, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: body.restaurant_id,
      menu_id: body.menu_id,
      name: body.name,
      category: body.category,
      price: body.price,
      cost: body.cost,
      is_active: body.is_active !== false
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}