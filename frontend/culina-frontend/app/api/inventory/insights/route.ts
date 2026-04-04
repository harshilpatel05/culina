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

function normalizeInsightText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
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

type InsightDataSummary = {
  totalItems: number
  immediateReorderCount: number
  activeConsumptionCount: number
  totalSuggestedReorder: number
  topReorderItems: Array<{ ingredient: string; qty: number }>
  topConsumptionItems: Array<{ ingredient: string; consumption: number }>
}

function summarizeInsightRows(rows: CsvRow[]): InsightDataSummary {
  const reorderRows = rows
    .map((row) => ({
      ingredient:
        getFirstStringValue(row, ['ingredient_name', 'ingredient', 'name', 'item_name']) || 'Unnamed ingredient',
      reorderQty:
        getFirstNumericValue(row, ['recommended_reorder_qty', 'reorder_qty', 'reorder_quantity']) || 0,
      predictedConsumption:
        getFirstNumericValue(row, ['predicted_consumption', 'consumption', 'forecast_consumption']) || 0,
    }))
    .filter((row) => row.reorderQty > 0)
    .sort((a, b) => b.reorderQty - a.reorderQty)

  const consumptionRows = rows
    .map((row) => ({
      ingredient:
        getFirstStringValue(row, ['ingredient_name', 'ingredient', 'name', 'item_name']) || 'Unnamed ingredient',
      reorderQty:
        getFirstNumericValue(row, ['recommended_reorder_qty', 'reorder_qty', 'reorder_quantity']) || 0,
      predictedConsumption:
        getFirstNumericValue(row, ['predicted_consumption', 'consumption', 'forecast_consumption']) || 0,
    }))
    .filter((row) => row.predictedConsumption > 0)
    .sort((a, b) => b.predictedConsumption - a.predictedConsumption)

  return {
    totalItems: rows.length,
    immediateReorderCount: reorderRows.length,
    activeConsumptionCount: consumptionRows.length,
    totalSuggestedReorder: reorderRows.reduce((sum, row) => sum + row.reorderQty, 0),
    topReorderItems: reorderRows.slice(0, 3).map((row) => ({ ingredient: row.ingredient, qty: row.reorderQty })),
    topConsumptionItems: consumptionRows.slice(0, 3).map((row) => ({ ingredient: row.ingredient, consumption: row.predictedConsumption })),
  }
}

function buildDeterministicInsight(summary: InsightDataSummary): string {
  const reorderList =
    summary.topReorderItems.length > 0
      ? summary.topReorderItems.map((item) => `${item.ingredient} (${item.qty.toFixed(1)})`).join(', ')
      : null

  const consumptionList =
    summary.topConsumptionItems.length > 0
      ? summary.topConsumptionItems.map((item) => `${item.ingredient} (${item.consumption.toFixed(1)})`).join(', ')
      : null

  if (summary.immediateReorderCount === 0) {
    return normalizeInsightText(
      `Good news: based on the latest inventory analysis, there are no ingredients that need urgent reordering right now. You still have ${summary.activeConsumptionCount} ingredients with active near-term usage, so keep an eye on daily movement for ${consumptionList || 'your fastest-moving items'} and continue regular stock checks to avoid sudden stockouts. Since suggested reorder quantity is currently low (${summary.totalSuggestedReorder.toFixed(1)} total), this is a good window to reduce overstock risk by rotating older stock first and tightening portion control for ingredients that usually drive wastage.`
    )
  }

  return normalizeInsightText(
    `Your inventory forecast shows ${summary.immediateReorderCount} ingredients that should be prioritized for replenishment soon, with an estimated total reorder need of ${summary.totalSuggestedReorder.toFixed(1)} units. Start with ${reorderList || 'the top recommended ingredients'} to prevent service disruption, then monitor high-usage ingredients like ${consumptionList || 'your fastest-moving items'} through the week. For better cost control, pair this restock plan with first-in-first-out usage and small-batch prep on slower-moving ingredients so stock stays fresh and wastage remains under control.`
  )
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

      // Retry different model/version only for not-found style responses.
      if (response.status === 404) {
        continue
      }

      // For non-404 errors (auth/quota/etc), fail fast with details.
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

export async function POST() {
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
  const secret = (process.env.INVENTORY_INSIGHTS_JOB_SECRET || process.env.MONTH_CLOSE_JOB_SECRET || '').trim()

  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured: INVENTORY_INSIGHTS_JOB_SECRET or MONTH_CLOSE_JOB_SECRET missing' }, { status: 500 })
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

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'Insights source returned empty data' }, { status: 502 })
  }

  const rows = parseCsv(csvText)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not enough historical data to generate insights' }, { status: 422 })
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!geminiApiKey) {
    return NextResponse.json({ error: 'Server misconfigured: GEMINI_API_KEY missing' }, { status: 500 })
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim()
  const dataSummary = summarizeInsightRows(rows)
  const sampledRows = rows.slice(0, 12)
  const samplePayload = JSON.stringify(sampledRows, null, 2)
  const summaryPayload = JSON.stringify(dataSummary, null, 2)

  const prompt = [
    'You are helping a restaurant manager who is not technical.',
    'Write exactly one clear, user-friendly paragraph (110-170 words).',
    'Use simple language, avoid jargon, and explain what to do next in practical terms.',
    'Include: current risk level, whether urgent reordering is needed, and 2-3 specific actions for this week.',
    'If reorder need is low, explicitly reassure the manager and focus on monitoring + wastage prevention.',
    'Do not use markdown, bullet points, labels, or placeholders.',
    'Return complete prose only.',
    `Restaurant ID: ${payload.restaurant_id}.`,
    `Rows available: ${rows.length}.`,
    'Computed summary:',
    summaryPayload,
    'Sample rows:',
    samplePayload,
  ].join('\n')

  const systemPrompt = [
    'You are a senior restaurant inventory analyst assistant.',
    'Do the needful: convert technical inventory signals into clear, practical guidance for a manager.',
    'Always provide understandable, actionable advice in plain English and avoid jargon.',
    'Never return placeholders, fragments, or incomplete sentences.',
  ].join(' ')

  const geminiResult = await generateGeminiInsightWithFallbacks(geminiApiKey, model, systemPrompt, prompt)
  const fallbackInsight = buildDeterministicInsight(dataSummary)

  if (!geminiResult.ok) {
    return NextResponse.json(
      {
        insightText: fallbackInsight,
        generatedAt: new Date().toISOString(),
        rowCount: rows.length,
        usedFallback: true,
        fallbackReason: `Gemini generation failed (${geminiResult.errorStatus || 502})`,
      },
      { status: 200 }
    )
  }

  const insightText = normalizeInsightText(geminiResult.text || '')

  // Protect UI against very short or partial model output.
  if (!insightText || insightText.length < 100 || !/[.!?]$/.test(insightText)) {
    return NextResponse.json({
      insightText: fallbackInsight,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      usedFallback: true,
      fallbackReason: 'Gemini returned incomplete insight text',
    })
  }

  return NextResponse.json({
    insightText,
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
  })
}
