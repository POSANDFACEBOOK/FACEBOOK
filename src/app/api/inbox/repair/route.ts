// POST /api/inbox/repair — refetch ข้อความใน DB ที่ message_text=null + attachments=[]
// (มัก เกิดจาก sync เก่าที่ไม่ดึง sticker URL)
// Body: { pageId?: string }  ถ้าไม่ส่ง = ทำทุกเพจของ user
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner } from '@/lib/team'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FB_API = 'https://graph.facebook.com/v19.0'

// Allow GET ด้วย (เปิด URL ตรงได้ ไม่ต้องใช้ console paste)
export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ctx = await getCurrentUserContext(session)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const og = assertOwner(ctx)
  if (!og.ok) return NextResponse.json({ error: og.error }, { status: og.status })

  // รับ pageId จาก body (POST) หรือ query (GET)
  const url = new URL(req.url)
  const queryPageId = url.searchParams.get('pageId') || undefined
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const onlyPageId: string | undefined = body.pageId || queryPageId

  if (onlyPageId && !ctx.ownedPageIds.has(onlyPageId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = supabaseAdmin()
  const fields = 'id,message,sticker,shares,attachments{id,mime_type,name,type,image_data,file_url,video_data,audio_data,payload}'
  const result: any[] = []
  let repaired = 0
  let totalFound = 0
  const start = Date.now()
  const BUDGET_MS = 45 * 1000

  // วนหลายรอบเพื่อ drain คิว empty ที่เกิน 100 — หยุดเมื่อไม่มี / ไม่มีความคืบหน้า / หมดเวลา
  for (let round = 0; round < 8; round++) {
    if (Date.now() - start > BUDGET_MS) break

    const { data: emptyMsgs, error } = await sb
      .from('inbox_messages')
      .select('id, fb_message_id, conversation_id, conversations!inner(page_id)')
      .is('message_text', null)
      .or('attachments.is.null,attachments.eq.[]')
      .not('fb_message_id', 'is', null)
      .order('created_at', { ascending: false })  // ใหม่สุดก่อน (ที่ user เห็น) + deterministic
      .limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const filtered = (emptyMsgs || []).filter((m: any) => {
      const pid = m.conversations?.page_id
      if (!pid || !ctx.ownedPageIds.has(pid)) return false
      if (onlyPageId && pid !== onlyPageId) return false
      return true
    })
    if (filtered.length === 0) break
    totalFound += filtered.length

    // page tokens
    const pageIds = Array.from(new Set(filtered.map((m: any) => m.conversations.page_id)))
    const { data: pages } = await sb
      .from('connected_pages').select('id, page_access_token').in('id', pageIds)
    const tokenMap = new Map((pages || []).map((p: any) => [p.id, p.page_access_token]))

    let roundRepaired = 0
    // refetch แบบขนาน (ครั้งละ 6) ลด latency จาก sequential
    for (let i = 0; i < filtered.length; i += 6) {
      await Promise.all(filtered.slice(i, i + 6).map(async (m: any) => {
        if (String(m.fb_message_id || '').startsWith('line_')) { result.push({ id: m.id, status: 'skipped_line' }); return }  // LINE ไม่ refetch ผ่าน FB Graph
        const token = tokenMap.get(m.conversations.page_id)
        if (!token) { result.push({ id: m.id, status: 'no_token' }); return }
        try {
          const r = await fetch(`${FB_API}/${m.fb_message_id}?fields=${fields}&access_token=${token}`)
          const data: any = await r.json()
          if (data.error) { result.push({ id: m.id, status: 'fb_error', error: data.error.message?.slice(0, 80) }); return }
          const newText = data.message || null
          const attachments: any[] = []
          const seen = new Set<string>()
          const add = (item: any) => { if (item.url && !seen.has(item.url)) { seen.add(item.url); attachments.push(item) } }
          const isSticker = !!data.sticker
          if (isSticker) add({ type: 'image', url: data.sticker, name: 'sticker' })
          for (const s of (data.shares?.data || []) as any[]) {
            if (s.link) add({ type: 'file', url: s.link, name: s.description || 'ลิงก์' })
          }
          for (const a of (data.attachments?.data || []) as any[]) {
            const url = a.image_data?.url || a.file_url || a.video_data?.url || a.audio_data?.url || a.payload?.url
            if (!url) continue
            const isImage = a.mime_type?.startsWith('image/') || !!a.image_data || a.type === 'image'
            if (isSticker && isImage) continue  // สติ๊กเกอร์ไม่เก็บรูปซ้ำ
            add({ type: isImage ? 'image' : 'file', url, name: a.name || (isImage ? 'รูปภาพ' : 'ไฟล์แนบ') })
          }
          if (!newText && attachments.length === 0) { result.push({ id: m.id, status: 'still_empty' }); return }
          await sb.from('inbox_messages').update({ message_text: newText, attachments }).eq('id', m.id)
          result.push({ id: m.id, status: 'repaired', attachmentCount: attachments.length })
          repaired++
          roundRepaired++
        } catch (e: any) {
          result.push({ id: m.id, status: 'threw', error: e.message?.slice(0, 80) })
        }
      }))
    }

    // ไม่มีความคืบหน้า (ที่เหลือซ่อมไม่ได้) → หยุด กัน loop ไม่จบ
    if (roundRepaired === 0) break
  }

  if (totalFound === 0) {
    return NextResponse.json({ repaired: 0, total: 0, message: 'no empty messages found' })
  }
  return NextResponse.json({ repaired, total: totalFound, result })
}
