import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildInvoiceNumber() {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `INV-${stamp}-${suffix}`
}

async function getSessionContext() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const payload = await verifyJWT(token)

  if (!payload?.restaurant_id) {
    return { error: NextResponse.json({ error: 'Invalid session context' }, { status: 401 }) }
  }

  return { cookieStore, supabase, payload }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const context = await getSessionContext()

  if ('error' in context) {
    return context.error
  }

  const { supabase, payload } = context

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const context = await getSessionContext()

  if ('error' in context) {
    return context.error
  }

  const { supabase, payload } = context

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, restaurant_id, total_amount')
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from('invoices')
    .select('id')
    .eq('order_id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (existingInvoiceError) {
    return NextResponse.json({ error: existingInvoiceError.message }, { status: 500 })
  }

  if (existingInvoice) {
    return NextResponse.json(
      { error: 'Invoice already exists for this order. Use update instead.' },
      { status: 409 }
    )
  }

  const subtotal = toNumber(body.subtotal, toNumber(order.total_amount, 0))
  const taxPercent = toNumber(body.tax_percent, 0)
  const taxAmount = toNumber(body.tax_amount, 0)
  const serviceChargePercent = toNumber(body.service_charge_percent, 0)
  const serviceChargeAmount = toNumber(body.service_charge_amount, 0)
  const discountPercent = toNumber(body.discount_percent, 0)
  const discountAmount = toNumber(body.discount_amount, 0)
  const grandTotal = toNumber(body.grand_total, subtotal + taxAmount + serviceChargeAmount - discountAmount)

  let createdByStaffId: string | null = null

  if (payload.staff_id) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('id')
      .eq('staff_id', payload.staff_id)
      .eq('restaurant_id', payload.restaurant_id)
      .maybeSingle()

    createdByStaffId = staffRow?.id ?? null
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      order_id: id,
      restaurant_id: payload.restaurant_id,
      invoice_number: buildInvoiceNumber(),
      issued_at: body.issued_at ?? new Date().toISOString(),
      due_at: body.due_at ?? null,
      subtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      service_charge_percent: serviceChargePercent,
      service_charge_amount: serviceChargeAmount,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      grand_total: grandTotal,
      notes: body.notes ?? null,
      created_by_staff_id: createdByStaffId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const context = await getSessionContext()

  if ('error' in context) {
    return context.error
  }

  const { supabase, payload } = context

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, total_amount')
    .eq('id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const subtotal = toNumber(body.subtotal, toNumber(order.total_amount, 0))
  const taxPercent = toNumber(body.tax_percent, 0)
  const taxAmount = toNumber(body.tax_amount, 0)
  const serviceChargePercent = toNumber(body.service_charge_percent, 0)
  const serviceChargeAmount = toNumber(body.service_charge_amount, 0)
  const discountPercent = toNumber(body.discount_percent, 0)
  const discountAmount = toNumber(body.discount_amount, 0)
  const grandTotal = toNumber(body.grand_total, subtotal + taxAmount + serviceChargeAmount - discountAmount)

  const { data, error } = await supabase
    .from('invoices')
    .update({
      issued_at: body.issued_at ?? undefined,
      due_at: body.due_at ?? null,
      subtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      service_charge_percent: serviceChargePercent,
      service_charge_amount: serviceChargeAmount,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      grand_total: grandTotal,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', id)
    .eq('restaurant_id', payload.restaurant_id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Invoice not found for this order' }, { status: 404 })
  }

  return NextResponse.json(data)
}
