import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/manager-dash'
  const safeNext = next.startsWith('/') ? next : '/manager-dash'

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/staff-login`)
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/staff-login?error=google_auth_failed`,
    )
  }

  return NextResponse.redirect(`${requestUrl.origin}${safeNext}`)
}