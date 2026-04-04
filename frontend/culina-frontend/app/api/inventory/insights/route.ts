import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyJWT(token)

  if (!payload?.restaurant_id) {
    return NextResponse.json({ error: 'Invalid session context' }, { status: 401 })
  }

  const allowedRoles = ['manager', 'admin']
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const backendBaseUrl = (process.env.BACKEND_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')
  const secret = process.env.MONTH_CLOSE_JOB_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured: MONTH_CLOSE_JOB_SECRET missing' }, { status: 500 })
  }

  const response = await fetch(`${backendBaseUrl}/jobs/inventory-insights/run`, {
    method: 'POST',
    headers: {
      'x-job-secret': secret,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null)
    return NextResponse.json(
      { error: errorPayload?.error || `Insights generation failed (${response.status})` },
      { status: response.status }
    )
  }

  const csvText = await response.text()
  const dateStamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csvText, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory-insights-${dateStamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
