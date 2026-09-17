// DELETE /api/inbox/messages/[id] — ลบ "ข้อความที่ส่งไม่สำเร็จ" ออกจากแชท
// ลบได้เฉพาะข้อความขาออกที่ Facebook ไม่ได้รับ (delivery_status = failed, ไม่มี fb_message_id)
// → ข้อความจริงที่ลูกค้าเห็นแล้วลบไม่ได้ ในระบบจะแสดงตรงกับ Facebook
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: msg } = await sb
      .from('inbox_messages')
      .select('id, direction, delivery_status, fb_message_id, conversations!inner(page_id)')
      .eq('id', params.id)
      .maybeSingle()
    const pageId = (msg as any)?.conversations?.page_id
    if (!msg || !pageId || !ctx.accessiblePageIds.has(pageId)) {
      return NextResponse.json({ error: 'ไม่พบข้อความ' }, { status: 404 })
    }
    if (msg.direction !== 'outbound' || msg.delivery_status !== 'failed' || msg.fb_message_id) {
      return NextResponse.json({ error: 'ลบได้เฉพาะข้อความที่ส่งไม่สำเร็จ' }, { status: 400 })
    }

    const { error } = await sb
      .from('inbox_messages')
      .delete()
      .eq('id', msg.id)
      .eq('delivery_status', 'failed')
      .is('fb_message_id', null)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
