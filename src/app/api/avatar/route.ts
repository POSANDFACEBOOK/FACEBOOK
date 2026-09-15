// GET /api/avatar?k=<ตัวระบุบัญชี> → รูปโปรไฟล์ของตัวเอง (k ไม่ได้ใช้ฝั่ง server — มีไว้ให้ browser แยก cache ต่อบัญชี
//                                  ไม่งั้นมือถือเครื่องเดียวกันที่สลับบัญชี จะเห็นรูปของคนก่อนหน้า)
// GET /api/avatar?u=<users.id>    → รูปของลูกทีมในเพจที่ตัวเองเป็นเจ้าของ (หน้า "จัดการทีม")
//
// ลิงก์รูปโปรไฟล์ Facebook ที่ได้ตอนล็อกอินเป็นลิงก์ชั่วคราว หมดอายุภายในไม่กี่วัน
// แต่ session อยู่ได้ 60 วัน → รูปแตก จึงขอลิงก์ใหม่จาก Facebook ตอนแสดงผล (browser จำไว้ 1 ชม.)
// ไม่มีรูป / ไม่ใช่บัญชี Facebook → 404 ให้หน้าเว็บแสดงตัวอักษรย่อแทน
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'

const FB = 'https://graph.facebook.com/v19.0'

// ไม่มีรูปแน่ๆ → จำไว้ 10 นาที
const noPicture = () => new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, max-age=600' } })
// ยังตอบไม่ได้ตอนนี้ (ยังไม่ล็อกอิน / Facebook ขัดข้อง / ระบบผิดพลาด) → ห้ามจำนาน เดี๋ยวลองใหม่ได้
const tryLater = (status = 404, seconds = 0) => new NextResponse(null, {
  status,
  headers: { 'Cache-Control': seconds > 0 ? `private, max-age=${seconds}` : 'no-store' },
})

type PictureResult = { url: string } | 'none' | 'error'

async function fetchPicture(fbId: string, token: string): Promise<PictureResult> {
  try {
    const r = await fetch(
      `${FB}/${encodeURIComponent(fbId)}/picture?type=large&redirect=false&access_token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    )
    const d: any = await r.json()
    if (d?.error || !r.ok) return 'error'
    const url = d?.data?.url
    // รูปเงาคนสีเทาของ Facebook (ยังไม่ตั้งรูป) → ใช้ตัวอักษรย่อสวยกว่า
    if (typeof url !== 'string' || d?.data?.is_silhouette) return 'none'
    // พาไปได้เฉพาะ CDN รูปของ Facebook เท่านั้น
    const u = new URL(url)
    if (u.protocol !== 'https:' || !/(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname)) return 'none'
    return { url }
  } catch {
    return 'error'
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return tryLater(401)

    const requested = new URL(req.url).searchParams.get('u')
    const sessionFbId = (session as any).fbUserId as string | undefined
    const userToken = (session as any).accessToken as string | undefined
    const sb = supabaseAdmin()

    let fbId: string | undefined
    let self = true

    if (!requested) {
      // รูปตัวเอง: ใช้ Facebook ID จาก session ได้เลย (ไม่ต้องรอแถว users ถูกสร้างตอนล็อกอินครั้งแรก)
      fbId = sessionFbId
      if (!fbId) {
        const ctx = await getCurrentUserContext(session)
        if (!ctx) return tryLater()
        const { data: me } = await sb.from('users').select('facebook_id').eq('id', ctx.userId).maybeSingle()
        fbId = me?.facebook_id || undefined
      }
    } else {
      const ctx = await getCurrentUserContext(session)
      if (!ctx) return tryLater()
      self = requested === ctx.userId
      if (!self) {
        // ดูรูปคนอื่นได้เฉพาะลูกทีมในเพจที่ตัวเองเป็นเจ้าของ
        const owned = Array.from(ctx.ownedPageIds)
        if (owned.length === 0) return noPicture()
        const { data: shared } = await sb
          .from('page_members')
          .select('id')
          .eq('user_id', requested)
          .in('page_id', owned)
          .limit(1)
        if (!shared || shared.length === 0) return noPicture()
      }
      const { data: target } = await sb.from('users').select('facebook_id').eq('id', requested).maybeSingle()
      fbId = target?.facebook_id || undefined
    }

    // บัญชีอีเมล/รหัสผ่าน ไม่มีรูป Facebook
    if (!fbId) return noPicture()

    // token ของเจ้าตัวก่อน (ถ้าดูรูปตัวเอง) แล้วค่อยใช้ app token (ใช้ได้กับทุกคนที่เคยล็อกอินแอปนี้)
    const tokens: string[] = []
    if (self && userToken) tokens.push(userToken)
    if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
      tokens.push(`${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`)
    }

    let hadError = false
    for (const t of tokens) {
      const result = await fetchPicture(fbId, t)
      if (typeof result === 'object') {
        const res = NextResponse.redirect(result.url, 302)
        res.headers.set('Cache-Control', 'private, max-age=3600')
        return res
      }
      if (result === 'error') hadError = true
    }
    // Facebook ขัดข้อง/จำกัดการเรียก → ลองใหม่ในอีก 1 นาที (ไม่ยิงถี่จนโดนจำกัดหนักขึ้น)
    return hadError ? tryLater(404, 60) : noPicture()
  } catch {
    return tryLater()
  }
}
