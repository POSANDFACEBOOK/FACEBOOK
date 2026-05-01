// GET /api/debug/token — diagnose why FB token keeps expiring
// Returns session info, token age, FB /me result, and debug_token (expires_at, scopes)
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const jwtToken: any = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const env = {
    hasClientId: !!process.env.FACEBOOK_CLIENT_ID,
    hasClientSecret: !!process.env.FACEBOOK_CLIENT_SECRET,
    hasNextauthSecret: !!process.env.NEXTAUTH_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL || null,
  }

  if (!session?.accessToken) {
    return NextResponse.json({
      ok: false,
      reason: 'no_session_token',
      env,
      session: !!session,
      jwt: jwtToken
        ? {
            hasAccessToken: !!jwtToken.accessToken,
            hasTokenIssuedAt: !!jwtToken.tokenIssuedAt,
            tokenAgeHours: jwtToken.tokenIssuedAt
              ? +((Date.now() - jwtToken.tokenIssuedAt) / 3600000).toFixed(2)
              : null,
          }
        : null,
    })
  }

  const userToken = session.accessToken as string

  // 1) ตรวจว่า token ใช้งานได้มั้ย
  let me: any = null
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${userToken}`)
    me = await r.json()
  } catch (e: any) {
    me = { fetch_error: e.message }
  }

  // 2) เรียก debug_token เพื่อดู expires_at, type, scopes
  let dbg: any = null
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    try {
      const appAccessToken = `${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`
      const r = await fetch(
        `https://graph.facebook.com/v19.0/debug_token?input_token=${userToken}&access_token=${appAccessToken}`
      )
      const j = await r.json()
      dbg = j.data || j
      // แปลง expires_at เป็นวันที่อ่านง่าย
      if (dbg?.expires_at) {
        dbg.expires_at_readable = new Date(dbg.expires_at * 1000).toISOString()
        dbg.expires_in_hours = +((dbg.expires_at * 1000 - Date.now()) / 3600000).toFixed(2)
      }
    } catch (e: any) {
      dbg = { fetch_error: e.message }
    }
  } else {
    dbg = { skipped: 'FACEBOOK_CLIENT_ID/SECRET not set' }
  }

  return NextResponse.json({
    ok: !me?.error && !!me?.id,
    env,
    jwt: {
      hasTokenIssuedAt: !!jwtToken?.tokenIssuedAt,
      tokenAgeHours: jwtToken?.tokenIssuedAt
        ? +((Date.now() - jwtToken.tokenIssuedAt) / 3600000).toFixed(2)
        : null,
      tokenIssuedAtReadable: jwtToken?.tokenIssuedAt
        ? new Date(jwtToken.tokenIssuedAt).toISOString()
        : null,
    },
    fbMe: me,
    fbDebugToken: dbg,
  })
}
