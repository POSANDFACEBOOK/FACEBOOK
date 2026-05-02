// GET /api/test-oauth/start
// Manual FB OAuth flow (no NextAuth) — แยกปัญหาว่า NextAuth พังหรือ FB พัง
// Redirects ไป FB OAuth dialog แล้วกลับมาที่ /api/test-oauth/callback
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  // ใช้ host จาก request จริงๆ (ไม่พึ่ง NEXTAUTH_URL ที่อาจมี whitespace)
  const origin = `https://${req.headers.get('host')}`
  const redirectUri = `${origin}/api/test-oauth/callback`

  const state = Math.random().toString(36).slice(2)

  const fbUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  fbUrl.searchParams.set('client_id', process.env.FACEBOOK_CLIENT_ID || '')
  fbUrl.searchParams.set('redirect_uri', redirectUri)
  fbUrl.searchParams.set('state', state)
  fbUrl.searchParams.set('scope', 'public_profile,email')
  // ตั้งใจใช้แค่ public_profile,email — scope ขั้นต่ำที่ทุกแอปต้องมี
  // เพื่อทดสอบว่า OAuth ใช้งานได้โดยไม่ติดเรื่อง permission review

  const res = NextResponse.redirect(fbUrl.toString())
  // เก็บ state ใน cookie เพื่อตรวจตอน callback
  res.cookies.set('test_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  res.cookies.set('test_oauth_redirect', redirectUri, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
