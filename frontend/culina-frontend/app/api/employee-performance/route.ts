import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/utils/jwt'

type CsvRow = Record<string, string>
type GeminiCallResult = {
  ok: boolean
  text?: string
  errorStatus?: number
  errorBody?: string
}

type EmployeeInsightSummary = {
  staffCount: number
  averageScore: number
  excellentCount: number
  goodCount: number
  averageCount: number
  needsImprovementCount: number
  topPerformers: Array<{ employeeId: string; score: number }>
  supportNeeded: Array<{ employeeId: string; score: number }>
  totalOrders: number
}

function normalizeInsightText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function isUsableInsightText(text: string): boolean {
  const normalized = normalizeInsightText(text)
  if (normalized.length < 24) {
    return false
  }

  // Ensure we have readable prose, not just symbols/placeholders.
  return /[a-zA-Z]/.test(normalized)
}

function parseNumber(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null
  }

  const numeric = Number(rawValue)
  return Number.isFinite(numeric) ? numeric : null
}

function getFirstStringValue(row: CsvRow, candidateKeys: string[]): string | null {
  const lowerMap = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[key.toLowerCase()] = key
    return acc
  }, {})

  for (const key of candidateKeys) {
    const resolved = lowerMap[key.toLowerCase()]
    if (!resolved) {
      continue
    }
    const value = (row[resolved] || '').trim()
    if (value) {
      return value
    }
  }

  return null
}

function getFirstNumericValue(row: CsvRow, candidateKeys: string[]): number | null {
  const lowerMap = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[key.toLowerCase()] = key
    return acc
  }, {})

  for (const key of candidateKeys) {
    const resolved = lowerMap[key.toLowerCase()]
    if (!resolved) {
      continue
    }
    const numeric = parseNumber(row[resolved])
    if (numeric != null) {
      return numeric
    }
  }

  return null
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: CsvRow = {}

    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })

    return row
  })
}

function summarizeEmployeeRows(rows: CsvRow[]): EmployeeInsightSummary {
  const normalizedRows = rows
    .map((row) => ({
      employeeId: getFirstStringValue(row, ['employee_id', 'staff_id', 'id']) || 'Unknown staff',
      score: getFirstNumericValue(row, ['score', 'performance_score']) || 0,
      category: (getFirstStringValue(row, ['category']) || '').toLowerCase(),
      totalOrders: getFirstNumericValue(row, ['total_orders', 'orders_completed']) || 0,
    }))
    .sort((a, b) => b.score - a.score)

  const averageScore =
    normalizedRows.length > 0
      ? normalizedRows.reduce((sum, row) => sum + row.score, 0) / normalizedRows.length
      : 0

  const excellentCount = normalizedRows.filter((row) => row.category === 'excellent').length
  const goodCount = normalizedRows.filter((row) => row.category === 'good').length
  const averageCount = normalizedRows.filter((row) => row.category === 'average').length
  const needsImprovementCount = normalizedRows.filter((row) => row.category.includes('needs')).length

  return {
    staffCount: normalizedRows.length,
    averageScore,
    excellentCount,
    goodCount,
    averageCount,
    needsImprovementCount,
    topPerformers: normalizedRows.slice(0, 3).map((row) => ({ employeeId: row.employeeId, score: row.score })),
    supportNeeded: normalizedRows
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((row) => ({ employeeId: row.employeeId, score: row.score })),
    totalOrders: normalizedRows.reduce((sum, row) => sum + row.totalOrders, 0),
  }
}

function buildDeterministicInsight(
  summary: EmployeeInsightSummary,
  context: { requestedEmployeeId?: string; requestedEmployeeName?: string }
): string {
  const displayName = context.requestedEmployeeName || context.requestedEmployeeId || 'this staff member'

  if (summary.staffCount === 1) {
    const categoryLabel =
      summary.excellentCount > 0
        ? 'Excellent'
        : summary.goodCount > 0
          ? 'Good'
          : summary.averageCount > 0
            ? 'Average'
            : 'Needs Improvement'

    return normalizeInsightText(
      `${displayName} currently has a performance score of ${summary.averageScore.toFixed(1)} in the ${categoryLabel} range, with ${summary.totalOrders.toFixed(0)} completed orders in the analyzed period. For next week, keep this employee on clearly defined peak-hour responsibilities and track order pacing at mid-shift and end-shift checkpoints. If order volume remains low, use focused coaching on speed, handoff quality, and communication instead of adding more shift pressure. A simple weekly target with two measurable goals, such as faster table turnaround and fewer order delays, will make progress easier to track and support consistent improvement.`
    )
  }

  const topPerformers =
    summary.topPerformers.length > 0
      ? summary.topPerformers.map((item) => `${item.employeeId} (${item.score.toFixed(1)})`).join(', ')
      : 'your leading staff members'

  const supportNeeded =
    summary.supportNeeded.length > 0
      ? summary.supportNeeded.map((item) => `${item.employeeId} (${item.score.toFixed(1)})`).join(', ')
      : 'no one in particular'

  return normalizeInsightText(
    `Team performance for ${summary.staffCount} staff members is currently stable with an average score of ${summary.averageScore.toFixed(1)} and ${summary.totalOrders.toFixed(0)} completed orders in this cycle. Your strongest contributors are ${topPerformers}, so keep them scheduled during peak hours and use them to mentor newer team members. Focus this week on coaching ${supportNeeded} with short, practical goals like order accuracy, pacing, and shift handoff discipline. Since ${summary.needsImprovementCount} staff are in the needs-improvement range, run quick end-of-shift check-ins and rebalance floor assignments to prevent service bottlenecks while keeping morale and consistency high.`
  )
}

async function generateGeminiInsightWithFallbacks(
  apiKey: string,
  requestedModel: string,
  systemPrompt: string,
  prompt: string
): Promise<GeminiCallResult> {
  const modelCandidates = Array.from(
    new Set([requestedModel, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'])
  )
  const versionCandidates = ['v1beta', 'v1']

  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 220,
    },
  })

  let lastStatus: number | undefined
  let lastBody = ''

  for (const version of versionCandidates) {
    for (const model of modelCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
        cache: 'no-store',
      })

      if (response.ok) {
        const payload = await response.json().catch(() => null)
        const text = payload?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part?.text || '')
          .join('\n')
          .trim()

        if (text) {
          return { ok: true, text }
        }

        lastStatus = 502
        lastBody = 'Gemini returned an empty response payload'
        continue
      }

      const errorBody = await response.text().catch(() => '')
      lastStatus = response.status
      lastBody = errorBody.slice(0, 400)

      if (response.status === 404) {
        continue
      }

      return {
        ok: false,
        errorStatus: response.status,
        errorBody: lastBody,
      }
    }
  }

  return {
    ok: false,
    errorStatus: lastStatus,
    errorBody: lastBody,
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value || cookieStore.get('auth_token')?.value

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
  const secret = (
    process.env.EMPLOYEE_PERFORMANCE_JOB_SECRET ||
    process.env.INVENTORY_INSIGHTS_JOB_SECRET ||
    process.env.MONTH_CLOSE_JOB_SECRET ||
    ''
  ).trim()

  if (!secret) {
    return NextResponse.json(
      {
        error:
          'Server misconfigured: EMPLOYEE_PERFORMANCE_JOB_SECRET, INVENTORY_INSIGHTS_JOB_SECRET, or MONTH_CLOSE_JOB_SECRET missing',
      },
      { status: 500 }
    )
  }

  const requestBody = await request.json().catch(() => ({}))

  const requestedEmployeeId =
    typeof requestBody?.employeeId === 'string' ? requestBody.employeeId.trim() : ''

  const requestedEmployeeName =
    typeof requestBody?.employeeName === 'string' ? requestBody.employeeName.trim() : ''

  const response = await fetch(`${backendBaseUrl}/jobs/employee-performance/run`, {
    method: 'POST',
    headers: {
      'x-job-secret': secret,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null)
    return NextResponse.json(
      { error: errorPayload?.error || `Employee performance generation failed (${response.status})` },
      { status: response.status }
    )
  }

  const csvText = await response.text()

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'Employee insights source returned empty data' }, { status: 502 })
  }

  const rows = parseCsv(csvText)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not enough shift data to generate employee insights' }, { status: 422 })
  }

  const scopedRows = requestedEmployeeId
    ? rows.filter((row) => {
        const rowEmployeeId =
          getFirstStringValue(row, ['employee_id', 'staff_id', 'id']) || ''
        return rowEmployeeId.toLowerCase() === requestedEmployeeId.toLowerCase()
      })
    : rows

  if (scopedRows.length === 0) {
    return NextResponse.json(
      {
        error: requestedEmployeeId
          ? `No employee performance records found for ${requestedEmployeeId}`
          : 'No employee performance records found',
      },
      { status: 404 }
    )
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!geminiApiKey) {
    return NextResponse.json({ error: 'Server misconfigured: GEMINI_API_KEY missing' }, { status: 500 })
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim()
  const dataSummary = summarizeEmployeeRows(scopedRows)
  const sampledRows = scopedRows.slice(0, 12)
  const samplePayload = JSON.stringify(sampledRows, null, 2)
  const summaryPayload = JSON.stringify(dataSummary, null, 2)

  const prompt = [
    'You are helping a restaurant manager who is not technical.',
    'Write exactly one clear, user-friendly paragraph (110-170 words).',
    'Use simple language, avoid jargon, and explain what to do next in practical terms.',
    requestedEmployeeId
      ? 'This request is for one employee only. Include: current performance level for that employee, key strengths/risks, and 2-3 specific actions for the next week.'
      : 'Include: team performance level, strongest contributors, and 2-3 specific actions for the next week.',
    'Call out where coaching is needed without sounding harsh.',
    'Do not use markdown, bullet points, labels, or placeholders.',
    'Return complete prose only.',
    `Restaurant ID: ${payload.restaurant_id}.`,
    `Rows available: ${scopedRows.length}.`,
    requestedEmployeeId ? `Employee ID in focus: ${requestedEmployeeId}.` : 'Employee scope: All staff.',
    requestedEmployeeName ? `Employee name: ${requestedEmployeeName}.` : '',
    'Computed summary:',
    summaryPayload,
    'Sample rows:',
    samplePayload,
  ].join('\n')

  const systemPrompt = [
    'You are a senior restaurant operations analyst assistant.',
    'Do the needful: convert technical employee performance signals into clear, practical guidance for a manager.',
    requestedEmployeeId
      ? 'When an employee ID is provided, write only about that employee and do not generalize to the entire team.'
      : 'If no employee is specified, summarize the team.',
    'Always provide understandable, actionable advice in plain English and avoid jargon.',
    'Never return placeholders, fragments, or incomplete sentences.',
  ].join(' ')

  const geminiResult = await generateGeminiInsightWithFallbacks(geminiApiKey, model, systemPrompt, prompt)
  const fallbackInsight = buildDeterministicInsight(dataSummary, {
    requestedEmployeeId,
    requestedEmployeeName,
  })

  if (!geminiResult.ok) {
    return NextResponse.json(
      {
        insightText: fallbackInsight,
        generatedAt: new Date().toISOString(),
        rowCount: scopedRows.length,
        employeeId: requestedEmployeeId || null,
        usedFallback: true,
        fallbackReason: `Gemini generation failed (${geminiResult.errorStatus || 502})${geminiResult.errorBody ? `: ${geminiResult.errorBody}` : ''}`,
      },
      { status: 200 }
    )
  }

  const insightText = normalizeInsightText(geminiResult.text || '')

  if (!isUsableInsightText(insightText) || insightText.length < 60) {
    const expansionPrompt = [
      'Rewrite and expand this employee insight into one complete paragraph (90-150 words).',
      'Keep it practical, manager-friendly, and specific to the same employee context.',
      'Do not use bullets, markdown, or labels.',
      'Draft to improve:',
      insightText || '(empty)',
      'Data summary:',
      summaryPayload,
    ].join('\n')

    const expandedResult = await generateGeminiInsightWithFallbacks(
      geminiApiKey,
      model,
      systemPrompt,
      expansionPrompt
    )

    const expandedText = normalizeInsightText(expandedResult.text || '')
    if (expandedResult.ok && isUsableInsightText(expandedText)) {
      return NextResponse.json({
        insightText: expandedText,
        generatedAt: new Date().toISOString(),
        rowCount: scopedRows.length,
        employeeId: requestedEmployeeId || null,
      })
    }

    // If expansion failed but the first response is short-yet-usable, prefer it over deterministic fallback.
    if (isUsableInsightText(insightText)) {
      return NextResponse.json({
        insightText,
        generatedAt: new Date().toISOString(),
        rowCount: scopedRows.length,
        employeeId: requestedEmployeeId || null,
      })
    }

    return NextResponse.json({
      insightText: fallbackInsight,
      generatedAt: new Date().toISOString(),
      rowCount: scopedRows.length,
      employeeId: requestedEmployeeId || null,
      usedFallback: true,
      fallbackReason: 'Gemini returned incomplete insight text after retry expansion',
    })
  }

  return NextResponse.json({
    insightText,
    generatedAt: new Date().toISOString(),
    rowCount: scopedRows.length,
    employeeId: requestedEmployeeId || null,
  })
}
