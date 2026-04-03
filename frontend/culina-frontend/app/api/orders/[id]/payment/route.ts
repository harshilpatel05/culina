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
    .update({ payment_status: 'paid' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}