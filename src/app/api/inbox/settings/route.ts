// GET /api/inbox/settings?pageId=<id>   → ดึง settings ของเพจที่ user เข้าถึงได้
// PUT  /api/inbox/settings              → upsert (agent ก็แก้ได้ แต่ user_id ใน row คือ owner)
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertPageAccess, getOwnerUserIdOfPage, contextErrorStatus } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // ทุกกรณีที่ "โหลดไม่ได้" ต้องไม่ตอบ settings: [] เพราะหน้าตั้งค่าจะแปลว่า "ยังไม่เคยตั้งค่า"
    // แล้วเติมค่า default ลงฟอร์ม — กด "บันทึก" ทีเดียวข้อมูลร้าน (knowledge_base) หายถาวร
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accessible = Array.from(ctx.accessiblePageIds)
    if (accessible.length === 0) return NextResponse.json({ settings: [] })

    const { searchParams } = new URL(req.url)
    const pageId = searchParams.get('pageId')

    const sb = supabaseAdmin()
    let q = sb.from('inbox_settings').select('*').in('page_id', accessible)
    if (pageId) {
      if (!ctx.accessiblePageIds.has(pageId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูการตั้งค่าของเพจนี้' }, { status: 403 })
      }
      q = q.eq('page_id', pageId)
    }
    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ settings: data || [] })
  } catch (err: any) {
    console.error('[inbox/settings] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: contextErrorStatus(err) })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { pageId, ...rest } = body
    if (!pageId) return NextResponse.json({ error: 'Missing pageId' }, { status: 400 })

    const g = assertPageAccess(ctx, pageId)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    // settings row.user_id ต้องเป็น owner ของเพจเสมอ (UNIQUE user_id,page_id = 1 row ต่อเพจ)
    const ownerId = getOwnerUserIdOfPage(ctx, pageId)
    if (!ownerId) return NextResponse.json({ error: 'Page has no owner' }, { status: 500 })

    const allowed: any = { user_id: ownerId, page_id: pageId }
    for (const k of [
      'ai_assist_enabled', 'ai_auto_categorize', 'ai_tone',
      'auto_reply_enabled', 'auto_reply_message',
      'business_hours_enabled', 'business_hours', 'off_hours_message',
      'knowledge_base',
    ]) {
      if (k in rest) allowed[k] = rest[k]
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('inbox_settings')
      .upsert(allowed, { onConflict: 'user_id,page_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, settings: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: contextErrorStatus(err) })
  }
}
