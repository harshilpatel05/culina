import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { searchParams } = new URL(request.url)
  const ingredientId = searchParams.get('ingredient_id')
  const limitParam = Number(searchParams.get('limit') ?? 50)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 50

  let query = supabase
    .from('restocks')
    .select('id, ingredient_id, restock_time, restocked_qty, created_at, ingredients(name, unit)')
    .order('restock_time', { ascending: false })
    .limit(limit)

  if (ingredientId) {
    query = query.eq('ingredient_id', ingredientId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(Array.isArray(data) ? data : [])
}
