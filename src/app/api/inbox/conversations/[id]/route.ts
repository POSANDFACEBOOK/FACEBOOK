// GET /api/inbox/conversations/[id]   → conversation detail + messages
// PATCH                                  → update flags (mark read, archive, resolve, star, tags)
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = supabaseAdmin()

    const { data: conversation } = await sb
      .from('conversations')
      .select(`
        *,
        connected_pages!inner(id, page_id, page_name, page_picture, nickname, channel)
      `)
      .eq('id', params.id)
      .single()

    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!ctx.accessiblePageIds.has(conversation.page_id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // ต้องเอา "200 อันล่าสุด" ไม่ใช่ 200 อันแรก — ไม่งั้นแชทที่คุยกันยาว
    // แอดมินจะเห็นแต่ข้อความเก่าสุด และข้อความที่เพิ่งตอบจะไม่โผล่เลย
    const { data: latest } = await sb
      .from('inbox_messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: false })
      .limit(200)
    const messages = (latest || []).slice().reverse()  // กลับเป็นเก่า→ใหม่ เพื่อแสดงผล

    // Fallback: แชทเก่าที่มี last_message แต่ message row หาย (webhook freeze ก่อน fix)
    // → สร้าง message สังเคราะห์จาก last_message ให้แอดมินเห็นว่าลูกค้าพิมพ์อะไร
    let outMessages = messages || []
    if (outMessages.length === 0 && conversation.last_message) {
      outMessages = [{
        id: `synthetic-${conversation.id}`,
        conversation_id: conversation.id,
        direction: conversation.last_sender === 'page' ? 'outbound' : 'inbound',
        message_text: conversation.last_message,
        attachments: [],
        sent_by: conversation.last_sender === 'page' ? 'page_user' : 'customer',
        delivery_status: 'delivered',
        created_at: conversation.last_message_at || conversation.created_at,
      }]
    }

    // Mark conversation as read (reset unread count)
    if (conversation.unread_count > 0) {
      await sb
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', params.id)
    }

    return NextResponse.json({ conversation, messages: outMessages })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = supabaseAdmin()

    // ensure access
    const { data: conv } = await sb
      .from('conversations')
      .select('id, page_id')
      .eq('id', params.id)
      .single()
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!ctx.accessiblePageIds.has(conv.page_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const allowed: Record<string, any> = {}
    for (const k of ['is_archived', 'is_resolved', 'is_starred', 'unread_count', 'tags', 'ai_category', 'ai_sentiment', 'ai_summary']) {
      if (k in body) allowed[k] = body[k]
    }

    const { error } = await sb
      .from('conversations')
      .update(allowed)
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
