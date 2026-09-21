// GET /api/inbox/conversations
// Query: ?pageId=<connected_pages.id>&filter=unread|all|archived&q=<search>&limit=50
//
// ตัวกรอง/ตัวเลขที่แอดมินเห็น (ไม่ซ้อนกัน):
// - "ใหม่" (unread)           = ยังไม่ได้เปิดอ่าน → unread_count > 0
// - "ยังไม่ตอบ" (needs_reply) = เปิดอ่านแล้วแต่ยังไม่ตอบ → unread_count = 0 และข้อความล่าสุดเป็นของลูกค้า
//
// แชทที่ "จัดเก็บ" ไว้ ถ้าลูกค้าทักกลับมาใหม่ (unread_count > 0) ต้องกลับเข้ากล่องข้อความ + นับใน "ใหม่"
// ไม่งั้นออเดอร์ของลูกค้าเก่าจะหายเงียบ (ไม่มีตัวเลข ไม่มี badge ไม่มีในลิสต์)
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin, ensureFbUser } from '@/lib/supabase'
import { getCurrentUserContext, contextErrorStatus } from '@/lib/team'

export const dynamic = 'force-dynamic'

/**
 * นับ "จำนวนแชท" ใหม่/ยังไม่ตอบ แยกตามเพจ — นับในฐานข้อมูล ไม่ใช่ดึงทุกแถวมานับใน JS
 * (PostgREST ตัดผลลัพธ์ที่ 1000 แถว → ร้านที่แชทเยอะ ตัวเลขรายเพจจะขาดและไม่ตรงกับยอดรวม)
 * ยอดรวมคิดจากผลเดียวกัน ตัวเลขบนชิปกับบนการ์ดเพจจะได้ตรงกันเสมอ
 * การนับเป็นแบบ "ได้ก็ดี" — นับไม่สำเร็จห้ามทำให้รายการแชทพัง (ผู้เรียกดัก error แล้วส่งลิสต์ต่อ)
 */
async function pageCounts(sb: any, ids: string[]) {
  const unreadByPage: Record<string, number> = {}
  const needsReplyByPage: Record<string, number> = {}

  const { data, error } = await sb.rpc('inbox_page_counts', { p_page_ids: ids })
  if (!error && Array.isArray(data)) {
    for (const r of data as Array<{ page_id: string; unread: number; needs_reply: number }>) {
      unreadByPage[r.page_id] = Number(r.unread) || 0
      needsReplyByPage[r.page_id] = Number(r.needs_reply) || 0
    }
  } else {
    // ยังไม่ได้รัน supabase/migration_inbox_counts.sql → นับด้วย count query รายเพจแทน
    // (count ไม่โดนลิมิต 1000 แถว และผู้ใช้หนึ่งคนมีไม่กี่เพจ)
    const rows = await Promise.all(ids.map(async pid => {
      const [u, n] = await Promise.all([
        sb.from('conversations').select('id', { count: 'exact', head: true })
          .eq('page_id', pid).gt('unread_count', 0),
        sb.from('conversations').select('id', { count: 'exact', head: true })
          .eq('page_id', pid).eq('last_sender', 'customer').lte('unread_count', 0).eq('is_archived', false),
      ])
      return { pid, u, n }
    }))
    for (const r of rows) {
      // นับเพจนี้ไม่ได้ (query timeout / คอนเนกชันเต็ม) → ข้ามเพจนั้นไป ห้ามโยน error ออกไป
      // ไม่งั้นตัวเลขบน badge ตัวเดียวทำให้รายการแชททั้งกล่องพัง ทั้งที่ดึงแชทมาได้แล้ว
      if (r.u.error || r.n.error) {
        console.error('[inbox/conversations] count error (page %s):', r.pid, r.u.error || r.n.error)
        continue
      }
      unreadByPage[r.pid] = r.u.count || 0
      needsReplyByPage[r.pid] = r.n.count || 0
    }
  }

  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0)
  return { unreadByPage, needsReplyByPage, totalUnread: sum(unreadByPage), totalNeedsReply: sum(needsReplyByPage) }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    // ล็อกอินหลุด → ต้องตอบ 401 ให้หน้าเว็บขึ้นกล่อง "เซสชันหมดอายุ"
    // ถ้าตอบ 200 + ลิสต์ว่าง หน้าจอจะล้างเพจ/แชท/ตัวเลขทิ้ง แอดมินนึกว่าเพจหลุดแล้วไปเชื่อมใหม่
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let ctx = await getCurrentUserContext(session)
    // ล็อกอิน Facebook ครั้งแรกยังไม่มีบัญชีในระบบ → สร้างให้ (เหมือน /api/me) ไม่ใช่เซสชันหมดอายุ
    if (!ctx && (session as any).accessToken && await ensureFbUser(session)) {
      ctx = await getCurrentUserContext(session)
    }
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    // เรียงตามลำดับที่เชื่อมเพจไว้เสมอ — ไม่งั้นพอแก้ชื่อเล่น/ต่ออายุ token แถวจะถูกเขียนใหม่
    // แล้วการ์ดเพจสลับตำแหน่ง แอดมินกดตามความเคยชินจะเข้าผิดเพจ
    const pagesQuery = sb
      .from('connected_pages')
      .select('id, page_id, page_name, page_picture, nickname, channel')
      .in('id', accessible)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    let convQuery = sb
      .from('conversations')
      .select(`
        id, fb_psid, fb_page_id, customer_name, customer_picture,
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
    // แชทที่จัดเก็บไว้แต่มีข้อความใหม่ = ลูกค้าเก่ากลับมาทัก → ต้องเห็นทั้งใน "ทั้งหมด" และ "ใหม่"
    // (ตอนกด "จัดเก็บ" เลขข้อความใหม่ถูกเคลียร์ใน PATCH แล้ว แชทที่จัดเก็บจริงๆ จึงไม่โผล่กลับมา)
    if (filter === 'unread') convQuery = convQuery.gt('unread_count', 0)
    else if (filter === 'archived') convQuery = convQuery.eq('is_archived', true)
    else if (filter === 'starred') convQuery = convQuery.eq('is_starred', true).eq('is_archived', false)
    else if (filter === 'unresolved') convQuery = convQuery.eq('is_resolved', false).eq('is_archived', false)
    else if (filter === 'needs_reply') convQuery = convQuery.eq('last_sender', 'customer').lte('unread_count', 0).eq('is_archived', false)
    else convQuery = convQuery.or('is_archived.eq.false,unread_count.gt.0')  // default = active

    if (q) {
      // ต้อง quote ค่า ไม่งั้นคำที่มีลูกน้ำ/วงเล็บ (เช่น "ข้าวผัด,ต้มยำ") จะทำให้ PostgREST parse ไม่ผ่าน → 500
      const safe = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      convQuery = convQuery.or(`customer_name.ilike."%${safe}%",last_message.ilike."%${safe}%"`)
    }

    const [pagesResult, convResult, counts] = await Promise.all([
      pagesQuery,
      stalePage ? Promise.resolve({ data: [], error: null }) : convQuery,
      // ตัวเลข badge เป็นของแถม — นับไม่สำเร็จก็ยังต้องส่งรายการแชทให้แอดมินตอบลูกค้าได้
      // (ถ้าฐานข้อมูลล่ม/สิทธิ์หลุดจริง query รายการแชทข้างบนจะพังเองแล้วตอบ error อยู่ดี)
      pageCounts(sb, accessible).catch(e => {
        console.error('[inbox/conversations] count error (ไม่กระทบรายการแชท):', e)
        return null
      }),
    ])

    const { data: pages, error: pagesError } = pagesResult as { data: any[] | null; error: any }
    const { data: conversations, error } = convResult as { data: any[] | null; error: any }
    // query ไหนพังก็ต้องตอบ error — ถ้าปล่อยผ่าน จะได้ pages: [] / ตัวเลข 0 แบบ 200
    // หน้าเว็บจะล้างการ์ดเพจกับ badge ทิ้งทั้งที่ยังมีแชทค้างอยู่
    if (error || pagesError) {
      console.error('[inbox/conversations] query error:', error || pagesError)
      throw error || pagesError
    }

    // นับไม่สำเร็จ → ไม่ส่งคีย์ตัวเลขเลย (ห้ามส่ง 0) หน้าเว็บจะได้คงตัวเลขเดิมไว้
    // ส่ง 0 แย่กว่าไม่ส่ง เพราะแอดมินจะนึกว่าไม่มีลูกค้ารอตอบทั้งที่มี
    return NextResponse.json({
      conversations: conversations || [],
      pages: pages || [],
      ...(counts ? {
        totalUnread: counts.totalUnread,
        totalNeedsReply: counts.totalNeedsReply,
        unreadByPage: counts.unreadByPage,
        needsReplyByPage: counts.needsReplyByPage,
      } : {}),
    })
  } catch (err: any) {
    // ไม่ส่ง conversations/pages ว่างกลับตอน error — หน้าเว็บจะได้เก็บของเดิมบนจอไว้
    return NextResponse.json({ error: err.message }, { status: contextErrorStatus(err) })
  }
}
