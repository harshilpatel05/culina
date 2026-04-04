import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

type SnapshotType = 'opening' | 'closing'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('inventory_snapshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(Array.isArray(data) ? data : [])
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const snapshotType = body?.snapshot_type as SnapshotType | undefined
  const note = typeof body?.note === 'string' ? body.note.trim() : null

  if (!snapshotType || !['opening', 'closing'].includes(snapshotType)) {
    return NextResponse.json(
      { error: "snapshot_type is required and must be 'opening' or 'closing'" },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventory')
    .select('id, ingredient_id, current_stock, reorder_level, wastage_qty, ingredients(name, unit)')

  if (inventoryError) {
    return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  }

  const normalizedRows = Array.isArray(inventoryRows) ? inventoryRows : []

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('inventory_snapshots')
    .insert({
      snapshot_type: snapshotType,
      note: note || null,
      item_count: normalizedRows.length,
      captured_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (snapshotError || !snapshotRow) {
    return NextResponse.json({ error: snapshotError?.message ?? 'Could not create snapshot' }, { status: 500 })
  }

  const itemRows = normalizedRows.map((row: any) => ({
    snapshot_id: snapshotRow.id,
    inventory_id: row.id,
    ingredient_id: row.ingredient_id,
    ingredient_name: row.ingredients?.name ?? null,
    unit: row.ingredients?.unit ?? null,
    current_stock: Number(row.current_stock ?? 0),
    reorder_level: Number(row.reorder_level ?? 0),
    wastage_qty: Number(row.wastage_qty ?? 0),
    captured_at: snapshotRow.captured_at,
  }))

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from('inventory_snapshot_items')
      .insert(itemRows)

    if (itemsError) {
      await supabase.from('inventory_snapshots').delete().eq('id', snapshotRow.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }
  }

  return NextResponse.json(snapshotRow)
}
