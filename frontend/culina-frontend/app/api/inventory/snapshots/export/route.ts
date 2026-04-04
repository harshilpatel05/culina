import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

function escapeCsv(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('inventory_snapshot_items')
    .select(`
      id,
      snapshot_id,
      inventory_id,
      ingredient_id,
      ingredient_name,
      unit,
      current_stock,
      reorder_level,
      wastage_qty,
      captured_at,
      inventory_snapshots (
        snapshot_type,
        note,
        item_count,
        captured_at,
        created_at
      )
    `)
    .order('captured_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = Array.isArray(data) ? data : []

  const headers = [
    'snapshot_id',
    'snapshot_type',
    'snapshot_captured_at',
    'snapshot_created_at',
    'snapshot_note',
    'snapshot_item_count',
    'snapshot_item_row_id',
    'item_captured_at',
    'inventory_id',
    'ingredient_id',
    'ingredient_name',
    'unit',
    'current_stock',
    'reorder_level',
    'wastage_qty',
  ]

  const lines = [headers.join(',')]

  rows.forEach((row: any) => {
    const snapshot = row.inventory_snapshots ?? {}
    const line = [
      escapeCsv(row.snapshot_id),
      escapeCsv(snapshot.snapshot_type),
      escapeCsv(snapshot.captured_at),
      escapeCsv(snapshot.created_at),
      escapeCsv(snapshot.note),
      escapeCsv(snapshot.item_count),
      escapeCsv(row.id),
      escapeCsv(row.captured_at),
      escapeCsv(row.inventory_id),
      escapeCsv(row.ingredient_id),
      escapeCsv(row.ingredient_name),
      escapeCsv(row.unit),
      escapeCsv(row.current_stock),
      escapeCsv(row.reorder_level),
      escapeCsv(row.wastage_qty),
    ]

    lines.push(line.join(','))
  })

  const csv = lines.join('\n')
  const dateStamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory-historical-snapshots-${dateStamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
