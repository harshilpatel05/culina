import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(name, unit, id)')
    .eq('dish_id', dishId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params
  const body = await request.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      dish_id: dishId,
      ingredient_id: body.ingredient_id,
      quantity: body.quantity
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}