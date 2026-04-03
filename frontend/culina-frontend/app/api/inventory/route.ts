import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // First check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('inventory')
      .select('*')

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      }, { status: 500 })
    }

    return NextResponse.json({
      data,
      count: data?.length || 0,
      authenticated: !!user
    })
  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('inventory')
    .insert({
      ingredient_id: body.ingredient_id,
      current_stock: body.current_stock || 0,
      reorder_level: body.reorder_level || 0,
      wastage_qty: body.wastage_qty || 0
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
