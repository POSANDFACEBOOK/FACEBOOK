// POST /api/inbox/sync
// Body: { pageId?: string }   ← ถ้าไม่ส่ง = sync ทุกเพจของ user
// Sync conversations + messages จาก Facebook (ใช้ตอนแรก หรือ webhook ตก)
// + auto-subscribe page to webhook
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner } from '@/lib/team'
import {
  listConversationsWithMessages,
  getUserProfilesBatch,
  subscribePageToWebhook,
} from '@/lib/messenger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FB_API = 'https://graph.facebook.com/v19.0'

/**
 * ดึง page_access_tokens สดใหม่จาก FB ผ่าน /me/accounts ของ user_token
 * → return Map<page_id, page_access_token>
 * ใช้เมื่อ page tokens ใน DB หมดอายุ (FB error code 190)
 */
async function fetchFreshPageTokens(userToken: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    let nextUrl: string | undefined =
      `${FB_API}/me/accounts?fields=id,access_token&limit=100&access_token=${userToken}`
    while (nextUrl) {
      const res: Response = await fetch(nextUrl)
      const data: any = await res.json()
      if (data.error) {
        console.error('[sync] /me/accounts failed:', data.error.message)
        break
      }
      for (const p of (data.data || []) as any[]) {
        if (p.id && p.access_token) map.set(p.id, p.access_token)
      }
      nextUrl = data.paging?.next
    }
  } catch (e: any) {
    console.error('[sync] fetchFreshPageTokens threw:', e.message)
  }
  return map
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const og = assertOwner(ctx)
    if (!og.ok) return NextResponse.json({ error: og.error }, { status: og.status })

    const userId = ctx.userId

    const body = await req.json().catch(() => ({}))
    const onlyPageId: string | undefined = body.pageId

    const sb = supabaseAdmin()

    // sync เฉพาะเพจที่ user เป็น owner
    const ownedIds = Array.from(ctx.ownedPageIds)
    let pageQuery = sb
      .from('connected_pages')
      .select('id, page_id, page_name, page_access_token, page_picture')
      .in('id', ownedIds)
      .eq('is_active', true)

    if (onlyPageId) {
      if (!ctx.ownedPageIds.has(onlyPageId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      pageQuery = pageQuery.eq('id', onlyPageId)
    }

    const { data: pages } = await pageQuery
    if (!pages || pages.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No pages to sync' })
    }

    // ── Lazy token refresh: ดึง tokens ใหม่เฉพาะตอนเจอ error (memoized 1 ครั้ง) ──
    // เร็วกว่าเดิม — ไม่ต้องยิง /me ทุกเพจก่อน sync (ตัด N calls ออกจาก hot path)
    let freshTokensPromise: Promise<Map<string, string>> | null = null
    const refreshToken = async (page: any): Promise<boolean> => {
      if (!freshTokensPromise) freshTokensPromise = fetchFreshPageTokens(session.accessToken as string)
      const fresh = await freshTokensPromise
      const nt = fresh.get(page.page_id)
      if (nt && nt !== page.page_access_token) {
        await sb.from('connected_pages').update({ page_access_token: nt }).eq('id', page.id)
        page.page_access_token = nt
        return true
      }
      return false
    }

    // ── Subscribe webhook ทุกเพจ (จำกัด 6 พร้อมกัน) ──
    const subResults: Record<string, boolean> = {}
    await mapLimit(pages, 6, async (page) => {
      try {
        const sub = await subscribePageToWebhook(page.page_id, page.page_access_token)
        subResults[page.page_id] = sub.success
        if (!sub.success) console.warn(`[sync] subscribe failed ${page.page_name}: ${sub.error}`)
      } catch {
        subResults[page.page_id] = false
      }
    })

    // ── Sync เพจ (จำกัด 6 พร้อมกัน — เร็วขึ้นสำหรับ user ทั่วไป, ยัง bounded ตอนเพจเยอะ) ──
    const summary: any[] = []
    await mapLimit(pages, 6, async (page) => {
      const r = await syncOnePage(sb, userId, page, subResults[page.page_id] ?? false, refreshToken)
      summary.push(r)
    })

    return NextResponse.json({ success: true, summary })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── จำกัด concurrency ของงาน async ──
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0
  const n = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const cur = idx++
      await fn(items[cur])
    }
  }))
}

// ── parse attachments จาก FB message → รูปแบบที่เก็บใน DB (ข้าม entry ที่ไม่มี url) ──
function parseMsgAttachments(m: any): any[] {
  const list: any[] = []
  if (m.sticker) list.push({ type: 'image', url: m.sticker, name: 'sticker' })
  for (const s of (m.shares?.data || []) as any[]) {
    if (s.link) list.push({ type: 'file', url: s.link, name: s.description || 'ลิงก์' })
  }
  for (const a of (m.attachments?.data || []) as any[]) {
    const url = a.image_data?.url || a.file_url || a.video_data?.url || a.audio_data?.url || a.payload?.url
    if (!url) continue  // ไม่มี url → ข้าม เพื่อให้ row เหลือ [] แล้ว repair จับได้
    const isImage = a.mime_type?.startsWith('image/') || !!a.image_data || a.type === 'image'
    list.push({ type: isImage ? 'image' : 'file', url, name: a.name || (isImage ? 'รูปภาพ' : 'ไฟล์แนบ') })
  }
  return list
}

// หาข้อความใหม่สุดใน conversation → ใช้ตัดสิน last_sender
function newestMessage(conv: any): any | null {
  const msgs = (conv.messages?.data || []) as any[]
  let newest: any = null
  for (const m of msgs) {
    if (!newest || new Date(m.created_time).getTime() > new Date(newest.created_time).getTime()) newest = m
  }
  return newest
}

// ── Sync เพจเดียว: ดึง conversations+messages inline (1 call) + bulk upsert ──
async function syncOnePage(
  sb: any,
  userId: string,
  page: any,
  subscribed: boolean,
  refreshToken: (page: any) => Promise<boolean>,
) {
  const pageResult: any = {
    page_id: page.page_id,
    page_name: page.page_name,
    conversations: 0,
    messages: 0,
    webhook_subscribed: subscribed,
    errors: [] as string[],
  }
  try {
    // ดึง conversations+messages; ถ้า token หมดอายุ → refresh แล้ว retry 1 ครั้ง
    let fbConvs: any[] = []
    try {
      fbConvs = await listConversationsWithMessages(page.page_id, page.page_access_token, 40, 10, 2)
    } catch (e: any) {
      const refreshed = await refreshToken(page)
      if (!refreshed) throw e
      fbConvs = await listConversationsWithMessages(page.page_id, page.page_access_token, 40, 10, 2)
    }

    // จับคู่ conv กับลูกค้า + dedupe ตาม psid (เก็บอันที่ใหม่สุด) กัน insert ชนกันเองในรอบเดียว
    const byPsid = new Map<string, { conv: any; customer: any }>()
    for (const c of fbConvs) {
      const customer = (c.participants?.data || []).find((p: any) => p.id !== page.page_id)
      if (!customer) continue
      const prev = byPsid.get(customer.id)
      if (!prev || new Date(c.updated_time).getTime() > new Date(prev.conv.updated_time).getTime()) {
        byPsid.set(customer.id, { conv: c, customer })
      }
    }
    const convCustomers = Array.from(byPsid.values())
    const psids = convCustomers.map(x => x.customer.id)

    // หา conv ที่มีอยู่แล้ว (id + last_message_at) ในครั้งเดียว
    const existing = new Map<string, { id: string; lastAt: string | null }>()
    if (psids.length > 0) {
      const { data: rows } = await sb
        .from('conversations')
        .select('id, fb_psid, last_message_at')
        .eq('fb_page_id', page.page_id)
        .in('fb_psid', psids)
      for (const r of (rows || []) as any[]) existing.set(r.fb_psid, { id: r.id, lastAt: r.last_message_at })
    }

    // ดึงโปรไฟล์เฉพาะ conv ใหม่ แบบ batch (1 call/เพจ แทน N)
    const newPsids = psids.filter(p => !existing.has(p))
    const profiles = newPsids.length > 0
      ? await getUserProfilesBatch(newPsids, page.page_access_token)
      : new Map<string, { name?: string; profile_pic?: string }>()

    const msgRows: any[] = []

    await mapLimit(convCustomers, 8, async ({ conv, customer }) => {
      const psid = customer.id
      const newest = newestMessage(conv)
      const lastSender: 'page' | 'customer' = newest
        ? (newest.from?.id === page.page_id ? 'page' : 'customer')
        : 'customer'
      const lastMsg = conv.snippet || newest?.message || ''

      const known = existing.get(psid)
      let convId = known?.id
      if (!convId) {
        // upsert (กัน race กับ webhook ที่อาจ insert แทรก) — คืน id เสมอ
        const profile = profiles.get(psid)
        const { data: up, error: upErr } = await sb
          .from('conversations')
          .upsert(
            {
              user_id: userId,
              page_id: page.id,
              fb_page_id: page.page_id,
              fb_conversation_id: conv.id,
              fb_psid: psid,
              customer_name: customer.name || profile?.name || 'ลูกค้า',
              customer_picture: profile?.profile_pic,
              last_message: lastMsg,
              last_message_at: conv.updated_time,
              last_sender: lastSender,
              unread_count: conv.unread_count || 0,
            },
            { onConflict: 'fb_page_id,fb_psid' },
          )
          .select('id')
          .single()
        if (upErr || !up) {
          // เผื่อ upsert คืน null (เช่น RLS) → ลอง select กลับ
          const { data: re } = await sb
            .from('conversations')
            .select('id')
            .eq('fb_page_id', page.page_id)
            .eq('fb_psid', psid)
            .single()
          if (!re) { pageResult.errors.push(`conv ${psid}: ${upErr?.message || 'no id'}`); return }
          convId = re.id as string
        } else {
          convId = up.id as string
          pageResult.conversations++
        }
        existing.set(psid, { id: convId, lastAt: conv.updated_time })
      } else {
        // อัปเดตเฉพาะเมื่อ FB มีข้อมูลใหม่กว่า — กันเขียนทับ webhook/สถานะอ่านแล้ว
        const fbNewer = !known?.lastAt || new Date(conv.updated_time).getTime() > new Date(known.lastAt).getTime()
        if (fbNewer) {
          await sb
            .from('conversations')
            .update({
              fb_conversation_id: conv.id,
              last_message: lastMsg,
              last_message_at: conv.updated_time,
              last_sender: lastSender,
              unread_count: conv.unread_count || 0,
            })
            .eq('id', convId)
        }
      }

      for (const m of (conv.messages?.data || []) as any[]) {
        if (!m.from?.id) continue  // system message ไม่มี from → ข้าม
        const isFromPage = m.from.id === page.page_id
        msgRows.push({
          conversation_id: convId,
          fb_message_id: m.id,
          fb_sender_id: m.from.id,
          direction: isFromPage ? 'outbound' : 'inbound',
          message_text: m.message || null,
          attachments: parseMsgAttachments(m),
          sent_by: isFromPage ? 'page_user' : 'customer',
          delivery_status: 'delivered',
          created_at: m.created_time,
        })
      }
    })

    // Bulk upsert ข้อความทั้งเพจ (insert ใหม่เท่านั้น; ของเก่าให้ repair เติม)
    let inserted = 0
    for (let i = 0; i < msgRows.length; i += 500) {
      const { error } = await sb
        .from('inbox_messages')
        .upsert(msgRows.slice(i, i + 500), { onConflict: 'fb_message_id', ignoreDuplicates: true })
      if (error) pageResult.errors.push(`upsert batch ${i}: ${error.message}`)
      else inserted += Math.min(500, msgRows.length - i)
    }
    pageResult.messages = inserted
  } catch (e: any) {
    pageResult.errors.push(`Sync: ${e?.message || e}`)
  }
  return pageResult
}
