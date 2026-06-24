// LINE Messaging API webhook
// ตั้งค่า Webhook URL = https://YOUR_DOMAIN/api/webhooks/line ใน LINE Developers Console
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyLineSignature, getLineUserProfile, describeLineMessage } from '@/lib/line'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature')

  let body: { destination?: string; events?: any[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const destination = body.destination
  if (!destination) {
    return NextResponse.json({ ok: true })  // verify ping / no destination
  }

  const sb = supabaseAdmin()
  // หา connected_pages (channel=line) จาก bot userId (destination)
  const { data: page } = await sb
    .from('connected_pages')
    .select('id, user_id, page_id, page_access_token, line_channel_secret')
    .eq('page_id', destination)
    .eq('channel', 'line')
    .single()

  if (!page) {
    console.warn('[line webhook] unknown destination', destination)
    return NextResponse.json({ ok: true })
  }

  // verify signature ด้วย channel secret ของ OA นี้ — fail-closed (ไม่มี secret = ปฏิเสธ)
  if (!verifyLineSignature(page.line_channel_secret || '', rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // process events (fire-and-forget per event)
  for (const event of body.events || []) {
    processLineEvent(page, event).catch(err => console.error('[line webhook] event error:', err?.message))
  }

  return NextResponse.json({ ok: true })
}

async function processLineEvent(page: any, event: any) {
  if (event?.type !== 'message') return
  if (event?.source?.type !== 'user') return  // รองรับเฉพาะแชท 1:1 (ไม่ใช่ group/room)

  const lineUserId = event?.source?.userId as string
  const lineMsgId = event?.message?.id as string
  if (!lineUserId || !lineMsgId) return  // กัน data ไม่ครบ / 'line_undefined'

  const sb = supabaseAdmin()
  const { text, attachments } = describeLineMessage(event.message)
  const ts = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString()

  // หา conversation เดิม
  let { data: conv } = await sb
    .from('conversations')
    .select('id, unread_count')
    .eq('fb_page_id', page.page_id)
    .eq('fb_psid', lineUserId)
    .single()

  let isNewConv = false
  if (!conv) {
    const profile = await getLineUserProfile(page.page_access_token, lineUserId)
    if (!profile) console.warn('[line webhook] profile fetch failed for', lineUserId)
    // upsert กัน race (webhook 2 อันพร้อมกัน) — onConflict (fb_page_id, fb_psid)
    const { data: up, error } = await sb
      .from('conversations')
      .upsert(
        {
          user_id: page.user_id, page_id: page.id,
          fb_page_id: page.page_id, fb_psid: lineUserId,
          customer_name: profile?.name || 'ลูกค้า LINE',
          customer_picture: profile?.picture || null,
          last_message: text || '(ไฟล์แนบ)', last_message_at: ts,
          last_sender: 'customer', unread_count: 1,
        },
        { onConflict: 'fb_page_id,fb_psid' },
      )
      .select('id, unread_count')
      .single()
    if (up) { conv = up; isNewConv = true }
    else {
      // เผื่อ upsert คืน null → re-select
      const { data: re } = await sb.from('conversations').select('id, unread_count')
        .eq('fb_page_id', page.page_id).eq('fb_psid', lineUserId).single()
      conv = re
    }
  }
  if (!conv) return

  // บันทึกข้อความ (dedup ด้วย fb_message_id) — select เพื่อรู้ว่าเป็นข้อความใหม่จริงไหม
  const { data: inserted } = await sb
    .from('inbox_messages')
    .upsert(
      {
        conversation_id: conv.id,
        fb_message_id: `line_${lineMsgId}`,
        fb_sender_id: lineUserId,
        direction: 'inbound',
        message_text: text,
        attachments,
        sent_by: 'customer',
        delivery_status: 'delivered',
        created_at: ts,
      },
      { onConflict: 'fb_message_id', ignoreDuplicates: true },
    )
    .select('id')
  const isNewMsg = !!(inserted && inserted.length > 0)

  // อัปเดต conv เฉพาะ conv เดิม + ข้อความใหม่จริง (กัน unread เด้งซ้ำตอน LINE replay webhook)
  if (!isNewConv && isNewMsg) {
    await sb
      .from('conversations')
      .update({
        last_message: text || '(ไฟล์แนบ)', last_message_at: ts,
        last_sender: 'customer', unread_count: (conv.unread_count || 0) + 1,
        send_block_code: null, send_block_at: null,  // ลูกค้าทักกลับ → ล้างป้าย
      })
      .eq('id', conv.id)
  }
}
