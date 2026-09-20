// CRUD quick replies
// GET — page member ทุก role อ่านได้ (agent ใช้ quick replies ของ owner)
// POST/DELETE — owner-only
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner, getOwnerUserIdOfPage, assertPageAccess, contextErrorStatus } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ replies: [] })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ replies: [] })

    if (ctx.memberships.length === 0) return NextResponse.json({ replies: [] })

    const sb = supabaseAdmin()

    // หน้าเว็บส่ง ?pageId ของเพจที่กำลังเปิดอยู่มาด้วย
    // ลูกทีมที่ช่วยดูแลให้เจ้าของ 2 ร้าน จะได้ไม่เห็นข้อความตอบเร็วของอีกร้านปนมาในเพจนี้
    const { searchParams } = new URL(req.url)
    const pageId = searchParams.get('pageId') || ''

    let ownerIds: string[]
    let accessiblePages: string[]
    if (pageId) {
      const pg = assertPageAccess(ctx, pageId)
      if (!pg.ok) return NextResponse.json({ error: pg.error, replies: [] }, { status: pg.status })
      const ownerId = getOwnerUserIdOfPage(ctx, pageId)
      ownerIds = ownerId ? [ownerId] : []
      accessiblePages = [pageId]
    } else {
      ownerIds = Array.from(new Set(ctx.memberships.map(m => m.ownerUserId).filter(Boolean)))
      accessiblePages = Array.from(ctx.accessiblePageIds)
    }

    // 2 queries แล้ว merge — ดู readable + ปลอดภัยกับ empty arrays
    const pageScoped = accessiblePages.length > 0
      ? (await sb.from('quick_replies').select('*').in('page_id', accessiblePages)).data || []
      : []
    const globalForOwners = ownerIds.length > 0
      ? (await sb.from('quick_replies').select('*').is('page_id', null).in('user_id', ownerIds)).data || []
      : []

    const seen = new Set<string>()
    const merged = [...pageScoped, ...globalForOwners]
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
      .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))

    // can_delete = ข้อความที่ตัวเองสร้าง (ของ owner เพจอื่นที่เราเป็นลูกทีม ลบไม่ได้)
    // ส่งไปให้หน้าเว็บซ่อนปุ่มลบ แอดมินจะได้ไม่กดแล้วเจอ error
    return NextResponse.json({ replies: merged.map(r => ({ ...r, can_delete: ctx.isOwner && r.user_id === ctx.userId })) })
  } catch (err: any) {
    // ระบบขัดข้อง (503) vs bug จริง (500) — ทั้งคู่ไม่ใช่ "ไม่มีสิทธิ์"
    return NextResponse.json({ error: err.message, replies: [] }, { status: contextErrorStatus(err) })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const og = assertOwner(ctx)
    if (!og.ok) return NextResponse.json({ error: og.error }, { status: og.status })

    const { shortcut, title, message, pageId } = await req.json()
    if (!shortcut || !title || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // ถ้าผูกกับเพจ → ต้องเป็นเพจที่ user เป็น owner
    let user_id = ctx.userId
    if (pageId) {
      const pg = assertPageAccess(ctx, pageId, 'owner')
      if (!pg.ok) return NextResponse.json({ error: pg.error }, { status: pg.status })
      user_id = getOwnerUserIdOfPage(ctx, pageId) || ctx.userId
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('quick_replies')
      .insert({ user_id, page_id: pageId || null, shortcut, title, message })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, reply: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: contextErrorStatus(err) })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const og = assertOwner(ctx)
    if (!og.ok) return NextResponse.json({ error: og.error }, { status: og.status })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const sb = supabaseAdmin()
    // ต้องเช็คว่าลบได้จริง — ข้อความตอบเร็วของ owner เพจอื่น (ที่เราเป็นลูกทีม) จะไม่เข้าเงื่อนไข user_id
    // ถ้าตอบ success ไปเฉยๆ หน้าเว็บจะเอาออกจากจอ แล้วมันโผล่กลับมาตอนเปิดตั้งค่าใหม่
    const { data: deleted, error } = await sb
      .from('quick_replies')
      .delete()
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .select('id')
    if (error) throw error
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'ลบได้เฉพาะข้อความตอบเร็วที่คุณสร้างเองเท่านั้น' }, { status: 403 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: contextErrorStatus(err) })
  }
}
