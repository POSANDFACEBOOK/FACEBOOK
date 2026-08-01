// POST /api/inbox/mark-read — เคลียร์ unread (อ่านทั้งหมด) ของช่องทาง/เพจที่เลือก
// Body: { channel?: 'facebook'|'line', pageId?: string }
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channel, pageId } = await req.json().catch(() => ({}))
    const sb = supabaseAdmin()
    const accessible = Array.from(ctx.accessiblePageIds)
    if (accessible.length === 0) return NextResponse.json({ success: true, cleared: 0 })

    // จำกัดเพจตามช่องทาง/เพจที่ส่งมา (ยังอยู่ในขอบเขตที่เข้าถึงได้)
    let pageIds = accessible
    if (pageId) {
      pageIds = ctx.accessiblePageIds.has(pageId) ? [pageId] : []
    } else if (channel === 'facebook' || channel === 'line') {
      const { data: pages } = await sb
        .from('connected_pages')
        .select('id')
        .in('id', accessible)
        .eq('channel', channel)
      pageIds = (pages || []).map((p: any) => p.id)
    }
    if (pageIds.length === 0) return NextResponse.json({ success: true, cleared: 0 })

    // ไม่แตะแชทที่จัดเก็บไว้ — ให้ตรงกับตัวเลขที่ UI นับ (นับเฉพาะ is_archived=false)
    const { error } = await sb
      .from('conversations')
      .update({ unread_count: 0 })
      .in('page_id', pageIds)
      .gt('unread_count', 0)
      .eq('is_archived', false)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
