// GET /api/inbox/avatar/[conversationId] → รูปโปรไฟล์ลูกค้า (302 ไปรูปถาวรใน Storage)
//
// หน้าเว็บเรียกเฉพาะแชทที่ customer_picture ยังไม่ใช่รูปในระบบเรา (แชทเก่าที่ลิงก์ FB หมดอายุ)
// route นี้ดึงรูปใหม่จาก Facebook มาเก็บ แล้วบันทึกลง DB → รอบถัดไปรายการแชทได้ URL ถาวรตรงๆ ไม่ผ่านที่นี่อีก
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'
import { ensureCustomerPicture, isHostedAvatar, isFacebookCdnUrl, isNoAvatar } from '@/lib/customer-avatar'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

const noPicture = (status = 404, cache = 'private, max-age=3600') =>
  new NextResponse(null, { status, headers: { 'Cache-Control': cache } })

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return noPicture(401, 'no-store')
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return noPicture(404, 'no-store')

    const sb = supabaseAdmin()
    const { data: conv } = await sb
      .from('conversations')
      .select('id, fb_psid, page_id, customer_picture, connected_pages!inner(id, channel, page_access_token)')
      .eq('id', params.id)
      .maybeSingle()
    if (!conv || !ctx.accessiblePageIds.has(conv.page_id)) return noPicture()

    const page: any = conv.connected_pages
    let url: string | null = null
    if (page?.channel === 'line') {
      // LINE ให้ URL รูปถาวรอยู่แล้ว
      url = conv.customer_picture && !isNoAvatar(conv.customer_picture) ? conv.customer_picture : null
    } else if (page?.page_access_token) {
      url = await ensureCustomerPicture(sb, conv, page.page_access_token)
    } else if (isHostedAvatar(conv.customer_picture)) {
      url = conv.customer_picture
    }
    if (!url) return noPicture()

    // พาไปได้เฉพาะรูปในระบบเรา หรือ CDN ของ Facebook/LINE เท่านั้น (ค่าใน DB มาจากภายนอก)
    let maxAge = 86400
    if (!isHostedAvatar(url)) {
      const isLineCdn = (() => { try { const u = new URL(url!); return u.protocol === 'https:' && /(^|\.)line-scdn\.net$/.test(u.hostname) } catch { return false } })()
      if (!isFacebookCdnUrl(url) && !isLineCdn) return noPicture()
      maxAge = 3600  // ลิงก์ชั่วคราว — ให้ browser ถามใหม่เร็วขึ้น จะได้เก็บลงระบบในรอบหน้า
    }
    const res = NextResponse.redirect(url, 302)
    res.headers.set('Cache-Control', `private, max-age=${maxAge}`)
    return res
  } catch {
    return noPicture(404, 'no-store')
  }
}
