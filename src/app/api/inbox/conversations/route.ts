// GET /api/inbox/conversations
// Query: ?pageId=<connected_pages.id>&filter=unread|all|archived&q=<search>&limit=50
//
// ตัวกรอง/ตัวเลขที่แอดมินเห็น (ไม่ซ้อนกัน):
// - "ใหม่" (unread)           = ยังไม่ได้เปิดอ่าน → unread_count > 0
// - "ยังไม่ตอบ" (needs_reply) = เปิดอ่านแล้วแต่ยังไม่ตอบ → unread_count = 0 และข้อความล่าสุดเป็นของลูกค้า
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ conversations: [], pages: [] })
    }

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ conversations: [], pages: [] })

    const accessible = Array.from(ctx.accessiblePageIds)
    if (accessible.length === 0) {
      return NextResponse.json({ conversations: [], pages: [], totalUnread: 0, totalNeedsReply: 0, unreadByPage: {}, needsReplyByPage: {} })
    }

    const { searchParams } = new URL(req.url)
    const pageId = searchParams.get('pageId') || ''
    const filter = searchParams.get('filter') || 'all'
    const q = (searchParams.get('q') || '').trim()
    const limit = Math.min(Number(searchParams.get('limit') || 50), 500)
    // client ขอเพจที่เข้าไม่ได้แล้ว (ถูกถอนสิทธิ์ / ช่องทางถูกซ่อน เช่น LINE) → ไม่ดึงแชท
    // แต่ยังส่งรายชื่อเพจ + ตัวเลขกลับไป ให้หน้าเว็บล้างตัวเลือกเพจเก่าแล้วกลับไป "ทุกเพจ" เอง
    const stalePage = !!pageId && !ctx.accessiblePageIds.has(pageId)

    const sb = supabaseAdmin()

    // ยิงทุก query พร้อมกัน (เดิมยิงทีละตัว 6 รอบ → สลับเพจช้า)
    // ตัวเลขทั้งหมดไม่ขึ้นกับเพจ/ตัวกรองที่เลือก — นับทุกเพจที่เข้าถึงได้
    const pagesQuery = sb
      .from('connected_pages')
      .select('id, page_id, page_name, page_picture, nickname, channel')
      .in('id', accessible)
      .eq('is_active', true)

    let convQuery = sb
      .from('conversations')
      .select(`
        id, fb_psid, customer_name, customer_picture,
        last_message, last_message_at, last_sender, unread_count,
        ai_category, ai_sentiment, is_archived, is_resolved, is_starred, tags,
        send_block_code,
        page_id,
        connected_pages!inner(id, page_name, page_picture, nickname, channel)
      `)
      .in('page_id', accessible)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (pageId) convQuery = convQuery.eq('page_id', pageId)
    if (filter === 'unread') convQuery = convQuery.gt('unread_count', 0).eq('is_archived', false)
    else if (filter === 'archived') convQuery = convQuery.eq('is_archived', true)
    else if (filter === 'starred') convQuery = convQuery.eq('is_starred', true).eq('is_archived', false)
    else if (filter === 'unresolved') convQuery = convQuery.eq('is_resolved', false).eq('is_archived', false)
    else if (filter === 'needs_reply') convQuery = convQuery.eq('last_sender', 'customer').lte('unread_count', 0).eq('is_archived', false)
    else convQuery = convQuery.eq('is_archived', false)  // default = active

    if (q) {
      // ต้อง quote ค่า ไม่งั้นคำที่มีลูกน้ำ/วงเล็บ (เช่น "ข้าวผัด,ต้มยำ") จะทำให้ PostgREST parse ไม่ผ่าน → 500
      const safe = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      convQuery = convQuery.or(`customer_name.ilike."%${safe}%",last_message.ilike."%${safe}%"`)
    }

    // นับ unread รวม (สำหรับ badge)
    const totalUnreadQuery = sb
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .in('page_id', accessible)
      .gt('unread_count', 0)
      .eq('is_archived', false)

    // นับ needs_reply (อ่านแล้วแต่ยังไม่ตอบ — ไม่นับแชทที่ยังไม่ได้เปิด ซึ่งอยู่ใน "ใหม่" แล้ว)
    const totalNeedsReplyQuery = sb
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .in('page_id', accessible)
      .eq('last_sender', 'customer')
      .lte('unread_count', 0)
      .eq('is_archived', false)

    // นับ unread ต่อเพจ — นับ "จำนวนแชท" ที่มีข้อความค้าง (ให้ตรงกับ totalUnread
    // ที่นับจำนวนแชทเช่นกัน) ไม่ใช่บวกจำนวนข้อความ เพื่อให้ผลรวมท้ายเพจ = ตัวเลข "ทุกเพจ"
    const unreadRowsQuery = sb
      .from('conversations')
      .select('page_id')
      .in('page_id', accessible)
      .gt('unread_count', 0)
      .eq('is_archived', false)

    // นับ needs_reply ต่อเพจ (อ่านแล้ว ลูกค้าทักล่าสุด ยังไม่ตอบ)
    const needsReplyRowsQuery = sb
      .from('conversations')
      .select('page_id')
      .in('page_id', accessible)
      .eq('last_sender', 'customer')
      .lte('unread_count', 0)
      .eq('is_archived', false)

    const [
      { data: pages },
      convResult,
      { count: totalUnread },
      { count: totalNeedsReply },
      { data: unreadRows },
      { data: needsReplyRows },
    ] = await Promise.all([
      pagesQuery,
      stalePage ? Promise.resolve({ data: [], error: null }) : convQuery,
      totalUnreadQuery,
      totalNeedsReplyQuery,
      unreadRowsQuery,
      needsReplyRowsQuery,
    ])

    const { data: conversations, error } = convResult as { data: any[] | null; error: any }
    if (error) {
      console.error('[inbox/conversations] query error:', error)
      throw error
    }

    const unreadByPage: Record<string, number> = {}
    for (const r of (unreadRows || []) as Array<{ page_id: string }>) {
      unreadByPage[r.page_id] = (unreadByPage[r.page_id] || 0) + 1
    }
    const needsReplyByPage: Record<string, number> = {}
    for (const r of (needsReplyRows || []) as Array<{ page_id: string }>) {
      needsReplyByPage[r.page_id] = (needsReplyByPage[r.page_id] || 0) + 1
    }

    return NextResponse.json({
      conversations: conversations || [],
      pages: pages || [],
      totalUnread: totalUnread || 0,
      totalNeedsReply: totalNeedsReply || 0,
      unreadByPage,
      needsReplyByPage,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, conversations: [], pages: [] }, { status: 500 })
  }
}
