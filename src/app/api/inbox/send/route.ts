// POST /api/inbox/send
// Body: { conversationId: string, text: string }
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'
import { sendTextMessage, sendSenderAction, sendAttachment } from '@/lib/messenger'
import { pushLineMessage, pushLineImage } from '@/lib/line'

export const dynamic = 'force-dynamic'
// ส่งข้อความต้องรอ Graph API ของ Facebook หลายจังหวะ (ส่ง + อ่านสถานะ)
// ถ้าใช้ค่าเริ่มต้นสั้นๆ ของ Vercel ตอนเน็ต Facebook ช้า จะถูกตัดกลางคัน แอดมินเห็น "ส่งไม่สำเร็จ" ทั้งที่ส่งไปแล้ว
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversationId, text, imageUrl } = await req.json()
    const hasText = typeof text === 'string' && text.trim().length > 0
    const hasImage = typeof imageUrl === 'string' && imageUrl.length > 0
    if (!conversationId || (!hasText && !hasImage)) {
      return NextResponse.json({ error: 'Missing conversationId or content' }, { status: 400 })
    }
    // ค่าที่ใช้บันทึก/แสดง
    const msgText = hasImage ? null : text.trim()
    const attachments = hasImage ? [{ type: 'image', url: imageUrl }] : []
    const lastMsg = hasImage ? '📷 รูปภาพ' : text.trim()

    const sb = supabaseAdmin()

    // หา conversation + ตรวจสิทธิ์เพจ
    const { data: conv } = await sb
      .from('conversations')
      .select('id, fb_psid, page_id, fb_page_id')
      .eq('id', conversationId)
      .single()

    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    if (!ctx.accessiblePageIds.has(conv.page_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // อนุญาตเฉพาะรูปจาก storage ของเราเอง + ผูกกับ conversation นี้ (กัน SSRF + ใช้รูปข้ามแชท)
    if (hasImage) {
      let okUrl = false
      try {
        const u = new URL(imageUrl)
        const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
        const prefix = `/storage/v1/object/public/chat-uploads/${conv.page_id}/${conversationId}/`
        okUrl = u.protocol === 'https:' && u.origin === base.origin && u.pathname.startsWith(prefix)
      } catch { okUrl = false }
      if (!okUrl) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
      }
    }

    const { data: page } = await sb
      .from('connected_pages')
      .select('page_access_token, channel')
      .eq('id', conv.page_id)
      .single()

    if (!page?.page_access_token) {
      return NextResponse.json({ error: 'Page token not found' }, { status: 400 })
    }

    // ── LINE: ส่งด้วย push API (ไม่มีกฎ 24 ชม. แบบ FB แต่กิน push quota) ──
    if (page.channel === 'line') {
      const lineRes = hasImage
        ? await pushLineImage(page.page_access_token, conv.fb_psid, imageUrl)
        : await pushLineMessage(page.page_access_token, conv.fb_psid, text.trim())
      if (!lineRes.success) {
        const userError = '⚠️ LINE ส่งไม่สำเร็จ: ' + (lineRes.error || '') +
          (lineRes.errorCode === 429 ? ' (เกินโควต้า push ของเดือนนี้)' : '')
        const { data: failedRow } = await sb.from('inbox_messages').insert({
          conversation_id: conv.id, fb_sender_id: conv.fb_page_id, direction: 'outbound',
          message_text: msgText, attachments, sent_by: 'page_user', sent_by_user_id: ctx.userId,
          delivery_status: 'failed', error_message: userError,
        }).select('*').single()
        return NextResponse.json({ error: userError, message: failedRow || undefined }, { status: 500 })
      }
      const { data: saved } = await sb
        .from('inbox_messages')
        .insert({
          conversation_id: conv.id, fb_sender_id: conv.fb_page_id, direction: 'outbound',
          message_text: msgText, attachments, sent_by: 'page_user', sent_by_user_id: ctx.userId,
          delivery_status: 'sent',
        })
        .select('*')
        .single()
      await sb.from('conversations').update({
        last_message: lastMsg, last_message_at: new Date().toISOString(),
        last_sender: 'page', unread_count: 0, is_resolved: false,
        send_block_code: null, send_block_at: null,
      }).eq('id', conv.id)
      return NextResponse.json({ success: true, message: saved })
    }

    // ── Facebook: ตามเดิม ──
    // แถวข้อความที่ส่งไม่สำเร็จ — client ใช้ id จริงของแถวนี้ไปกด "ส่งอีกครั้ง"/"ลบ" (ห้ามเปลี่ยนรูปแบบที่ส่งกลับ)
    const saveFailed = async (userError: string) => {
      const { data } = await sb.from('inbox_messages').insert({
        conversation_id: conv.id,
        fb_sender_id: conv.fb_page_id,
        direction: 'outbound',
        message_text: msgText,
        attachments,
        sent_by: 'page_user',
        sent_by_user_id: ctx.userId,
        delivery_status: 'failed',
        error_message: userError,
      }).select('*').single()
      return data || undefined
    }

    // Messenger รับข้อความยาวได้ไม่เกิน 2,000 ตัวอักษร — บอกก่อนส่ง ไม่ต้องรอ FB ปฏิเสธด้วย error อังกฤษ
    // (เช็คเฉพาะฝั่ง Facebook — LINE รับได้ 5,000 จึงอยู่คนละ branch)
    const FB_TEXT_LIMIT = 2000
    if (msgText && msgText.length > FB_TEXT_LIMIT) {
      const parts = Math.ceil(msgText.length / FB_TEXT_LIMIT)
      const userError = `⚠️ ข้อความยาว ${msgText.length} ตัวอักษร เกินที่ Facebook รับได้ (สูงสุด 2,000) — แบ่งส่งเป็น ${parts} ข้อความสั้นลง`
      return NextResponse.json({ error: userError, message: await saveFailed(userError) }, { status: 400 })
    }

    // optimistic typing indicator
    sendSenderAction(page.page_access_token, conv.fb_psid, 'typing_on').catch(() => {})

    // 1) ส่งแบบ RESPONSE (ภายใน 24 ชม. ของข้อความล่าสุดลูกค้า)
    const fbSend = (mt: 'RESPONSE' | 'MESSAGE_TAG', tag?: string) =>
      hasImage
        ? sendAttachment(page.page_access_token, conv.fb_psid, 'image', imageUrl, mt, tag)
        : sendTextMessage(page.page_access_token, conv.fb_psid, text.trim(), mt, tag)

    // code 10 ของ Facebook เป็น error รวม (หมดหน้าต่าง 24 ชม. / สิทธิ์แอปไม่พอ) — ต้องแยกให้ออก
    // ไม่งั้นแอดมินเห็น "เกิน 24 ชม." ทั้งที่ลูกค้าเพิ่งทักมาเมื่อกี้
    // subcode 2018278 = เกิน 24 ชม., 2018065 = เกิน 7 วัน (HUMAN_AGENT) — ถ้า helper ยังไม่ส่ง subcode มา ก็ดูจากข้อความของ FB แทน
    const isOutsideWindow = (r: any) =>
      r?.errorCode === 10 && (
        r?.errorSubcode === 2018278 || r?.errorSubcode === 2018065 ||
        /outside of allowed window|outside the allowed window|24[-\s]?hour/i.test(r?.error || '')
      )

    // จับเวลา "ก่อน" คุยกับ Facebook แล้วปัดลงเป็นวินาที — เวลาของ Facebook ละเอียดแค่วินาที
    // ถ้าเราบันทึกเวลาหลังส่งเสร็จ (ช้ากว่าหลายวินาที) ข้อความที่ลูกค้าทักเข้ามาระหว่างนั้นจะถูกซิงก์ข้ามถาวร
    const sentAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString()
    const first = await fbSend('RESPONSE')
    let result = first

    // 2) เกิน 24 ชม. → ลองซ้ำด้วย HUMAN_AGENT tag (ขยายหน้าต่างเป็น 7 วัน เมื่อ FB App ผ่าน App Review แล้ว)
    //    ไม่ลองซ้ำกรณี 551 — ลูกค้าปิดรับข้อความอยู่ ยิงซ้ำก็ไม่ถึง แถม error ของรอบ 2 จะทับสาเหตุจริง
    let usedHumanAgent = false
    if (!first.success && isOutsideWindow(first)) {
      usedHumanAgent = true
      result = await fbSend('MESSAGE_TAG', 'HUMAN_AGENT')
    }

    if (!result.success) {
      // ดูสาเหตุจาก "ครั้งแรก" เสมอ — ครั้งที่ 2 เป็นการลอง HUMAN_AGENT ซึ่ง error คนละเรื่องกัน
      const code = first.errorCode
      const raw = first.error || ''
      console.warn('[inbox/send] facebook error', { code, raw, retryCode: usedHumanAgent ? result.errorCode : undefined })
      let userError: string
      let blockCode: number | null = null
      if (first.timedOut || result.timedOut) {
        userError = '⏳ Facebook ตอบช้าผิดปกติ — ไม่แน่ใจว่าข้อความถึงลูกค้าแล้วหรือยัง เปิดดูในแชทก่อนกดส่งซ้ำ (กันลูกค้าได้ข้อความ 2 ครั้ง)'
      } else if (code === 551 || result.errorCode === 551) {
        // 551 = ลูกค้าไม่พร้อมรับข้อความ (ปิดรับ/บล็อกเพจ หรือเลิกใช้บัญชี) — ฝั่งลูกค้า บังคับไม่ได้
        userError = '⚠️ ลูกค้าปิดรับข้อความหรือบล็อกเพจอยู่ (Facebook #551) — ส่งไม่ได้ในขณะนี้ ต้องรอลูกค้าทักกลับมาก่อน'
        blockCode = 551
      } else if (usedHumanAgent) {
        // เกิน 24 ชม. จริง — ผลของรอบ HUMAN_AGENT บอกว่าติดตรงไหน
        blockCode = 10
        userError = isOutsideWindow(result)
          ? '⚠️ ลูกค้าทักมาเกิน 7 วันแล้ว — Facebook ห้ามตอบทุกกรณี ต้องรอลูกค้าทักกลับมาก่อน'
          : '⚠️ ลูกค้าทักมาเกิน 24 ชม. — ระบบนี้ยังตอบต่อไม่ได้ (Facebook ยังไม่อนุมัติ Human Agent ให้แอป) ตอบผ่านแอป Facebook/Business Suite ไปก่อน'
      } else if (code === 190) {
        userError = '⚠️ การเชื่อมต่อเพจหมดอายุ — ให้เจ้าของเพจเข้าสู่ระบบด้วย Facebook ใหม่อีกครั้ง แล้วส่งใหม่'
      } else if (code === 613 || code === 4 || code === 32 || /rate limit/i.test(raw)) {
        userError = '⚠️ ส่งถี่เกินไป Facebook จำกัดชั่วคราว — รอสัก 1–2 นาทีแล้วกดส่งอีกครั้ง'
      } else if (code === 100 && /Length of param|less than or equal to 2000/i.test(raw)) {
        userError = '⚠️ ข้อความยาวเกินที่ Facebook รับได้ (สูงสุด 2,000 ตัวอักษร) — แบ่งส่งเป็นหลายข้อความ'
      } else if (code === 100 && /fetch the file|Failed to fetch/i.test(raw)) {
        userError = '⚠️ Facebook โหลดรูปนี้ไม่ได้ — เลือกรูปใหม่แล้วส่งอีกครั้ง'
      } else if (code === 100 && ((first as any).errorSubcode === 2018001 || /No matching user/i.test(raw))) {
        userError = '⚠️ ไม่พบบัญชีลูกค้าคนนี้ใน Facebook แล้ว (ปิดหรือลบบัญชีไป) — ส่งข้อความไม่ได้'
      } else if (code === 200) {
        userError = '⚠️ แอปยังไม่มีสิทธิ์ส่งข้อความแทนเพจนี้ (#200) — ให้เจ้าของเพจเข้าสู่ระบบด้วย Facebook แล้วกดเชื่อมเพจใหม่อีกครั้ง'
      } else if (code === 10) {
        // code 10 ที่ไม่ใช่เรื่องหน้าต่างเวลา = สิทธิ์แอป — ห้าม mark ว่าแชทนี้ "รอลูกค้าทัก"
        userError = '⚠️ Facebook ไม่ยอมให้ตอบแชทนี้ตอนนี้ (#10) — สิทธิ์ของแอปยังไม่ครบ ตอบผ่านแอป Facebook/Business Suite ไปก่อน แล้วแจ้งผู้ดูแลระบบ'
      } else if (!code) {
        userError = '⚠️ ต่อ Facebook ไม่ได้ในตอนนี้ — ตรวจอินเทอร์เน็ตแล้วกดส่งอีกครั้ง'
      } else {
        userError = `⚠️ Facebook ไม่รับข้อความนี้ (#${code}) — ลองส่งใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ`
      }
      const failedRow = await saveFailed(userError)
      // mark แชทว่าส่งไม่ได้ (ลูกค้าไม่พร้อม/เกินเวลาจริงเท่านั้น) → โชว์ป้ายเตือนให้แอดมิน
      if (blockCode) {
        await sb.from('conversations')
          .update({ send_block_code: blockCode, send_block_at: new Date().toISOString() })
          .eq('id', conv.id)
      }
      return NextResponse.json({
        error: userError,
        blockCode: blockCode || undefined,
        uncertain: first.timedOut || result.timedOut || undefined,   // หน้าเว็บจะได้ไม่ชวนให้กดส่งซ้ำทันที
        message: failedRow,
      }, { status: 500 })
    }

    // บันทึก message สำเร็จ — sent_by_user_id = agent's id (audit trail)
    const { data: saved } = await sb
      .from('inbox_messages')
      .insert({
        conversation_id: conv.id,
        fb_message_id: result.message_id,
        fb_sender_id: conv.fb_page_id,
        direction: 'outbound',
        message_text: msgText,
        attachments,
        sent_by: 'page_user',
        sent_by_user_id: ctx.userId,
        delivery_status: 'sent',
      })
      .select('*')
      .single()

    // อัปเดต conversation last message
    await sb
      .from('conversations')
      .update({
        last_message: lastMsg,
        last_message_at: sentAt,
        last_sender: 'page',
        unread_count: 0,
        is_resolved: false,
        send_block_code: null,
        send_block_at: null,
      })
      .eq('id', conv.id)

    return NextResponse.json({ success: true, message: saved })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
