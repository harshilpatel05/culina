import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

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

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)

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

  return NextResponse.json(data)
}