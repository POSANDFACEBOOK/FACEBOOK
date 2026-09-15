// POST /api/pages/connect — เชื่อมเพจ Facebook เข้ากล่องข้อความ
// Body: { pageId: string }  (FB Page ID)
//
// เดิมเพจ FB ถูกบันทึกลงระบบได้ทางเดียวคือตอน "สร้างแอด" — ตอนนี้ตัดฟังก์ชันแอดออกแล้ว
// จึงต้องมีทางเชื่อมเพจโดยตรง
//
// ความปลอดภัย: ไม่รับ page token จาก client เด็ดขาด — ดึงรายชื่อเพจจาก Facebook ด้วย
// token ของผู้ใช้ที่ล็อกอินอยู่ แล้วเช็คว่าเพจที่ขอเชื่อมอยู่ในรายการที่เขาดูแลจริง
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin, ensureFbUser } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'
import { subscribePageToWebhook } from '@/lib/messenger'
import { fetchManagedPages, canConnectPage } from '@/lib/fb-pages'

export const dynamic = 'force-dynamic'

// รายชื่อเพจดึงจาก Graph API หลายรอบ (มีหลาย Business) — เผื่อเวลาไว้
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userToken = (session as any)?.accessToken as string | undefined
    // ต้องล็อกอินด้วย Facebook — แอดมินที่เข้าด้วยอีเมล/รหัสผ่านไม่มีสิทธิ์เชื่อมเพจ
    if (!session || !userToken) {
      return NextResponse.json({ error: 'ต้องเข้าสู่ระบบด้วย Facebook ก่อนจึงจะเชื่อมเพจได้' }, { status: 401 })
    }
    // เจ้าของเพจที่เพิ่งล็อกอินครั้งแรกยังไม่มีแถว users → สร้างให้เลย
    const userId = await ensureFbUser(session)
    if (!userId) return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้ — ลองออกจากระบบแล้วเข้าใหม่' }, { status: 401 })
    // ลูกทีม (มีสิทธิ์ในเพจคนอื่นแต่ไม่ได้เป็นเจ้าของเพจไหน) ไม่มีสิทธิ์เชื่อมช่องทาง
    const ctx = await getCurrentUserContext(session)
    if (ctx?.isAgentOnly) {
      return NextResponse.json({ error: 'บัญชีลูกทีมเชื่อมเพจไม่ได้ — ให้เจ้าของเพจเป็นคนเชื่อม' }, { status: 403 })
    }

    const { pageId } = await req.json().catch(() => ({}))
    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json({ error: 'ไม่ได้ระบุเพจ' }, { status: 400 })
    }

    const { pages: managed } = await fetchManagedPages(userToken)
    const page = managed.get(pageId)
    if (!page) {
      return NextResponse.json({ error: 'คุณไม่ได้เป็นผู้ดูแลเพจนี้ หรือสิทธิ์ Facebook หมดอายุ — ลองออกจากระบบแล้วเข้าใหม่' }, { status: 403 })
    }
    if (!page.access_token || !canConnectPage(page)) {
      return NextResponse.json({ error: 'บทบาทของคุณในเพจนี้ตอบแชทไม่ได้ — ต้องเป็นผู้ดูแล/ผู้ตรวจสอบ หรือมีสิทธิ์ข้อความ' }, { status: 403 })
    }

    const sb = supabaseAdmin()

    // เพจนี้ถูกเชื่อมโดยบัญชีอื่นอยู่แล้วหรือยัง (กันแชทเพจเดียวแตกเป็น 2 เจ้าของ)
    const { data: samePage, error: dupErr } = await sb
      .from('connected_pages')
      .select('id, user_id')
      .eq('page_id', pageId)
      .eq('channel', 'facebook')
    if (dupErr) throw dupErr
    if ((samePage || []).some((r: any) => r.user_id !== userId)) {
      return NextResponse.json({ error: 'เพจนี้ถูกเชื่อมโดยบัญชีอื่นอยู่แล้ว — ให้เจ้าของเดิมเพิ่มคุณเป็นทีมในเมนู "จัดการทีม" แทน' }, { status: 409 })
    }

    const { data: saved, error } = await sb
      .from('connected_pages')
      .upsert(
        {
          user_id: userId,
          channel: 'facebook',
          page_id: pageId,
          page_name: page.name || pageId,
          page_picture: page.picture?.data?.url || null,
          page_access_token: page.access_token,
          is_active: true,
        },
        { onConflict: 'user_id,page_id' },
      )
      .select('id, page_id, page_name, page_picture, channel')
      .single()
    if (error) throw error

    // รับข้อความใหม่แบบเรียลไทม์ (ถ้าไม่สำเร็จ ระบบ sync สำรองยังดึงให้อยู่)
    const sub = await subscribePageToWebhook(pageId, page.access_token)

    return NextResponse.json({ success: true, page: saved, webhookSubscribed: sub.success })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'เชื่อมเพจไม่สำเร็จ' }, { status: 500 })
  }
}
