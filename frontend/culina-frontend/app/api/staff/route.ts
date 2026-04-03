import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('staff')
    .select('*, restaurants(name)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const validStatus = ['active', 'holiday', 'inactive']
  const validRoles = ['manager', 'chef', 'waiter']
  const status = validStatus.includes(body.status) ? body.status : 'inactive'
  const role = validRoles.includes(body.role) ? body.role : null

  const { data, error } = await supabase
    .from('staff')
    .insert({
      restaurant_id: body.restaurant_id,
      name: body.name,
      role,
      salary: body.salary,
      status
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}