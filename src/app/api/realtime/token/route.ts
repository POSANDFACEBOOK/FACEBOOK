// GET /api/realtime/token — มินต์ Supabase JWT (scoped ตาม user) ให้ client ใช้ subscribe Realtime
// ต้องตั้ง env SUPABASE_JWT_SECRET (Supabase Dashboard → Settings → API → JWT Secret)
// ถ้าไม่ได้ตั้ง → คืน 503 → client fallback ไป polling
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// JWT (HS256) ที่ Supabase ยอมรับ: sub = user uuid → auth.uid() ใน RLS = user uuid
function signSupabaseJwt(userId: string, secret: string, ttlSec = 8 * 3600): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(JSON.stringify({
    sub: userId, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + ttlSec,
  }))
  const data = `${header}.${payload}`
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const secret = process.env.SUPABASE_JWT_SECRET
    if (!secret) {
      // ยังไม่ได้ตั้ง → ไม่ใช่ error ร้ายแรง client จะใช้ polling แทน
      return NextResponse.json({ token: null, configured: false }, { status: 200 })
    }

    const token = signSupabaseJwt(ctx.userId, secret)
    return NextResponse.json({ token, configured: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, token: null }, { status: 500 })
  }
}
