import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

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

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('restaurant_id', payload.restaurant_id)
    .order('issued_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(Array.isArray(data) ? data : [])
}
