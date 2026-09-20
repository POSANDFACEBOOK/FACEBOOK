// POST /api/inbox/sync
// Body: { pageId?: string }   ← ถ้าไม่ส่ง = sync ทุกเพจของ user
// Sync conversations + messages จาก Facebook (ตอนนี้เป็นทางเดียวที่ข้อความลูกค้าเข้าระบบ
// เพราะ Facebook ยังไม่ส่ง webhook ให้แอปที่ยังไม่เผยแพร่)
// + auto-subscribe page to webhook
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'
import { hostProfilePic, ensureCustomerPicture, avatarIsFresh } from '@/lib/customer-avatar'
import { canConnectPage, type FbManagedPage } from '@/lib/fb-pages'
import { FB_SYSTEM_SENT_BY, isFbAdminTagged, isFbAutoReplyText, isFbSystemGraphMessage, isFbSystemRow, isFbSystemText, fbSystemLastMessageFilter } from '@/lib/fb-system-messages'
import {
  listConversations,
  listConversationMessagesUntil,
  getConversationUpdateTimes,
  getConversationsWithMessagesByIds,
  getUserProfilesBatch,
  subscribePageToWebhook,
  isFbAuthError,
} from '@/lib/messenger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FB_API = 'https://graph.facebook.com/v19.0'

// ── ค่าคงที่ของรอบซิงก์ ──
const RUN_BUDGET_MS = 45 * 1000      // เผื่อเวลาเขียนฐานข้อมูลก่อน Vercel ตัดที่ 60 วิ
const SYNC_LOCK_MS = 90 * 1000       // จองสิทธิ์ซิงก์ค้างเกินนี้ = runner ตายไปแล้ว ให้แย่งได้
const SYNC_FRESH_MS = 45 * 1000      // เพิ่งซิงก์ไปเมื่อครู่ → ข้าม (สั้นกว่ารอบ poll ของแอป)
const WEBHOOK_RESUB_MS = 24 * 60 * 60 * 1000
const MSG_LIMIT = 20                 // ข้อความต่อแชทต่อรอบ (Graph ให้รายละเอียดราว 20 ข้อความล่าสุด)
const ALWAYS_FETCH_TOP = 10          // แชทที่เคลื่อนไหวล่าสุด — ดึงข้อความเสมอ แม้เวลาบอกว่าไม่มีอะไรใหม่
const GAP_BACKFILL_MAX = 5           // แชทที่ตามเก็บข้อความย้อนหลังได้ต่อรอบ
const PIC_BACKFILL_MAX = 8           // รูปลูกค้าที่เติมได้ต่อรอบ (ต้องเบา — ตอนนี้ Facebook ยังไม่ให้สิทธิ์ดูรูป)
const PIC_SCAN_LIMIT = 40            // แชทที่ส่องหารูปที่ยังขาดต่อรอบ

type KnownConv = {
  id: string
  lastAt: string | null
  name?: string | null
  unread: number
  blockCode: number | null
  blockAt: string | null
}

/**
 * ดึง page_access_tokens สดใหม่จาก FB ผ่าน /me/accounts ของ user_token
 * → return Map<page_id, เพจพร้อม tasks> (ต้องรู้บทบาทด้วย ไม่งั้นเอา token ของ Advertiser/Analyst มาทับได้)
 * ใช้เมื่อ page tokens ใน DB หมดอายุ (FB error code 190)
 */
async function fetchFreshPageTokens(userToken: string): Promise<Map<string, FbManagedPage>> {
  const map = new Map<string, FbManagedPage>()
  try {
    let nextUrl: string | undefined =
      `${FB_API}/me/accounts?fields=id,access_token,tasks&limit=100&access_token=${userToken}`
    let guard = 0
    while (nextUrl && guard++ < 10) {
      const res: Response = await fetch(nextUrl, { signal: AbortSignal.timeout(10000) })
      const data: any = await res.json()
      if (data.error) {
        console.error('[sync] /me/accounts failed:', data.error.message)
        break
      }
      for (const p of (data.data || []) as FbManagedPage[]) {
        if (p.id && p.access_token) map.set(p.id, p)
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

    const userId = ctx.userId
    const deadline = Date.now() + RUN_BUDGET_MS

    const body = await req.json().catch(() => ({}))
    const onlyPageId: string | undefined = body.pageId

    const sb = supabaseAdmin()

    // sync เพจที่ user เข้าถึงได้ (owner = เพจตัวเอง, agent = เพจที่ถูกมอบสิทธิ์)
    // → agent ก็ดึงข้อความใหม่เองได้ ไม่ต้องรอ owner เปิดแอป
    const accessibleIds = Array.from(ctx.accessiblePageIds)
    let pageQuery = sb
      .from('connected_pages')
      .select('id, page_id, page_name, page_access_token, page_picture, user_id')
      .in('id', accessibleIds)
      .eq('is_active', true)
      .eq('channel', 'facebook')  // LINE ไม่มี fetch-conversations API — มาทาง webhook อย่างเดียว

    if (onlyPageId) {
      if (!ctx.accessiblePageIds.has(onlyPageId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      pageQuery = pageQuery.eq('id', onlyPageId)
    }

    const { data: pages, error: pagesErr } = await pageQuery
    // ฐานข้อมูลสะดุด ≠ ไม่มีเพจ — บันทึกไว้ให้ดูย้อนหลังได้ว่าทำไมรอบนี้ไม่ได้ซิงก์
    if (pagesErr) console.error('[sync] load pages failed:', pagesErr.message)
    if (!pages || pages.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No pages to sync' })
    }

    // ── Lazy token refresh: ดึง tokens ใหม่เฉพาะตอน token ตายจริง (memoized 1 ครั้ง) ──
    let freshTokensPromise: Promise<Map<string, FbManagedPage>> | null = null
    const refreshToken = async (page: any, err: any): Promise<boolean> => {
      // จำกัดอัตรา / ข้อมูลเยอะเกิน / เน็ตสะดุด → token ยังดีอยู่ ห้ามไปเขียนทับ
      // (ไม่งั้น token ของเพจจะถูกแทนด้วย token ของคนที่บังเอิญเปิดแอปอยู่ตอนนั้น)
      if (!isFbAuthError(err)) return false
      if (!session.accessToken) return false  // agent (ไม่มี FB token) → refresh ไม่ได้ ใช้ token เดิมที่เก็บไว้
      if (!freshTokensPromise) freshTokensPromise = fetchFreshPageTokens(session.accessToken as string)
      const fresh = await freshTokensPromise
      const p = fresh.get(page.page_id)
      // บทบาทที่ตอบแชทไม่ได้ (Advertiser/Analyst) ก็ได้ page token มาเหมือนกัน → ห้ามเก็บไว้ใช้
      if (!p?.access_token || !canConnectPage(p)) return false
      if (p.access_token === page.page_access_token) return false
      await sb.from('connected_pages').update({ page_access_token: p.access_token }).eq('id', page.id)
      page.page_access_token = p.access_token
      return true
    }

    // ── Sync เพจ (จำกัด 6 พร้อมกัน — เร็วขึ้นสำหรับ user ทั่วไป, ยัง bounded ตอนเพจเยอะ) ──
    const summary: any[] = []
    await mapLimit(pages, 6, async (page) => {
      const r = await syncOnePage(sb, userId, page, refreshToken, { deadline, force: !!onlyPageId })
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
  const seen = new Set<string>()
  // dedupe ตาม url — FB ส่ง sticker ผ่านทั้ง field "sticker" และ "attachments" url เดียวกัน → กันซ้ำ
  const add = (item: any) => { if (item.url && !seen.has(item.url)) { seen.add(item.url); list.push(item) } }
  const isSticker = !!m.sticker
  if (isSticker) add({ type: 'image', url: m.sticker, name: 'sticker' })
  for (const s of (m.shares?.data || []) as any[]) {
    if (s.link) add({ type: 'file', url: s.link, name: s.description || 'ลิงก์' })
  }
  for (const a of (m.attachments?.data || []) as any[]) {
    const url = a.image_data?.url || a.file_url || a.video_data?.url || a.audio_data?.url || a.payload?.url
    if (!url) continue  // ไม่มี url → ข้าม เพื่อให้ row เหลือ [] แล้ว repair จับได้
    const isImage = a.mime_type?.startsWith('image/') || !!a.image_data || a.type === 'image'
    // สติ๊กเกอร์: FB ส่งซ้ำใน attachments ด้วย url คนละค่า → ข้ามรูป ไม่เก็บซ้ำ
    if (isSticker && isImage) continue
    add({ type: isImage ? 'image' : 'file', url, name: a.name || (isImage ? 'รูปภาพ' : 'ไฟล์แนบ') })
  }
  return list
}

// หาข้อความใหม่สุดใน conversation → ใช้ตัดสิน last_sender
function newestMessage(msgs: any[]): any | null {
  let newest: any = null
  for (const m of msgs) {
    if (!newest || new Date(m.created_time).getTime() > new Date(newest.created_time).getTime()) newest = m
  }
  return newest
}

// แชทที่ "ข้อความล่าสุด" เป็นข้อความระบบของ Facebook (เช่นป้ายอัตโนมัติที่เด้งหลังลูกค้าทัก)
// → ใช้ข้อความจริงล่าสุดแทน ไม่งั้นแชทที่ลูกค้ายังรอคำตอบจะดูเหมือนตอบแล้ว
// (แก้ข้อมูลเก่า + แชทที่ไม่ได้อยู่ในรายการที่ดึงรอบนี้ — รอบละไม่เกิน 20 แชท)
async function fixSystemLastMessages(sb: any, pageRowId: string): Promise<number> {
  const { data: convs } = await sb
    .from('conversations')
    .select('id, last_message, last_sender, customer_name')
    .eq('page_id', pageRowId)
    .or(fbSystemLastMessageFilter())
    .order('last_message_at', { ascending: false })
    .limit(20)
  let fixed = 0
  for (const c of (convs || []) as any[]) {
    // SQL ilike กว้างกว่า (ไม่สนตัวพิมพ์/ความยาว) → เช็คซ้ำ
    if (!isFbSystemText(c.last_message, null, c.customer_name)) continue
    const { data: msgs } = await sb
      .from('inbox_messages')
      .select('direction, message_text, attachments, sent_by, delivery_status')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(30)
    // การ์ดฝั่งเพจที่ดึงเนื้อหาไม่ได้ (เช่นแอดมินส่งคำขอโอนเงิน) ยังนับว่าเพจตอบ — ตรงกับตอน sync
    const list = (msgs || []) as any[]
    if (list.length === 0) continue  // ยังไม่มีข้อความในระบบ — รอ sync ดึงมาก่อน
    // ข้อความที่ Facebook ตอบแทนเพจตอนไม่มีคนรับสาย ก็ไม่ใช่ "คนตอบ" → ข้ามไปหาข้อความจริงถัดไป
    // (ไม่งั้นแชทที่ลูกค้าโทรมาแล้วไม่มีใครรับ จะกลายเป็น "เพจตอบแล้ว" แล้วหลุดจากรายการยังไม่ตอบ)
    const real = list.find(m => !isFbSystemRow(m, c.customer_name) && m.delivery_status !== 'failed'
      && !isFbAutoReplyText(m.message_text, m.direction))
    // 30 ข้อความล่าสุดเป็นข้อความระบบหมด → ใส่ข้อความว่างพอ (สถานะตอบ/ไม่ตอบคงเดิม) จะได้ไม่ถูกหยิบมาทุกรอบ
    const patch = real
      ? { last_message: real.message_text || '(ไฟล์แนบ)', last_sender: real.direction === 'inbound' ? 'customer' : 'page' }
      : { last_message: '' }
    const { data: upd } = await sb.from('conversations').update(patch)
      .eq('id', c.id).eq('last_message', c.last_message)  // มีข้อความใหม่เข้ามาระหว่างนี้ → ไม่ทับ
      .select('id')
    if ((upd || []).length > 0) fixed++
  }
  return fixed
}

// รูปโปรไฟล์ลูกค้า: หน้าแชทไม่ได้ขอรูปทีละแชทเองแล้ว → รอบซิงก์ต้องตามเติมให้
// ทำทีละน้อยและเงียบๆ เพราะตอนนี้ Facebook ยังไม่ให้สิทธิ์ดูรูปลูกค้า (#100/33) ทุกคำขอจึงได้ "ไม่มีรูป"
// ensureCustomerPicture จะเก็บ 'none:<วันที่>' ไว้แทน null แล้วลองใหม่วันละครั้ง — พอได้สิทธิ์ รูปจะขึ้นเองใน 1 วัน
async function backfillCustomerPictures(sb: any, page: any, deadline: number): Promise<number> {
  const { data, error } = await sb
    .from('conversations')
    .select('id, fb_psid, page_id, customer_picture')
    .eq('page_id', page.id)
    .or('customer_picture.is.null,customer_picture.like."none:%"')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(PIC_SCAN_LIMIT)
  if (error) return 0
  // 'none:<วันที่>' ที่เพิ่งลองไปวันนี้ → ข้าม (กติกาวันละครั้งอยู่ใน avatarIsFresh)
  const targets = ((data || []) as any[]).filter(c => !avatarIsFresh(c.customer_picture)).slice(0, PIC_BACKFILL_MAX)
  let done = 0
  await mapLimit(targets, 3, async (c: any) => {
    if (Date.now() > deadline) return
    // รูปดึงไม่ได้ต้องไม่ทำให้การซิงก์ข้อความล้มทั้งเพจ
    try {
      await ensureCustomerPicture(sb, c, page.page_access_token)
      done++
    } catch {}
  })
  return done
}

// ── Sync เพจเดียว ──
// ขั้นที่ 1 ดึง "รายชื่อแชท" อย่างเดียว (เบา) → ขั้นที่ 2 ดึงข้อความเฉพาะแชทที่มีอะไรใหม่
async function syncOnePage(
  sb: any,
  userId: string,
  page: any,
  refreshToken: (page: any, err: any) => Promise<boolean>,
  opts: { deadline: number; force: boolean },
) {
  const pageResult: any = {
    page_id: page.page_id,
    page_name: page.page_name,
    conversations: 0,
    messages: 0,
    webhook_subscribed: true,
    errors: [] as string[],
  }

  // ── จองสิทธิ์ซิงก์เพจนี้ก่อน (throttle ฝั่ง server) ──
  // ทุกแท็บ/ทุกเครื่อง/ทุกแอดมินยิงตามนาฬิกาของตัวเอง — ถ้าไม่กัน เพจเดียวจะถูกดึงซ้ำหลายรอบต่อนาที
  // จน Facebook จำกัดอัตรา แล้วข้อความหยุดเข้าทั้งเพจ
  const startedAt = Date.now()
  const { data: claimed, error: claimErr } = await sb
    .from('connected_pages')
    .update({ sync_claimed_at: new Date(startedAt).toISOString() })
    .eq('id', page.id)
    .or(`sync_claimed_at.is.null,sync_claimed_at.lt."${new Date(startedAt - SYNC_LOCK_MS).toISOString()}"`)
    .select('id, last_synced_at, webhook_subscribed_at')

  let hasClaim = false
  let lastSyncedAt: string | null = null
  let subDue = true
  if (claimErr) {
    // ยังไม่ได้รัน supabase/migration_sync_claim.sql → ทำงานแบบเดิมไปก่อน
    // (ห้ามทำให้ซิงก์หยุดทั้งระบบเพียงเพราะยังไม่มีคอลัมน์)
    console.warn(`[sync] claim unavailable ${page.page_name}: ${claimErr.message}`)
  } else if (!claimed || claimed.length === 0) {
    pageResult.skipped = 'in_progress'   // อีกรอบกำลังดึงเพจนี้อยู่ — ของที่ได้จะถูกเขียนลงฐานข้อมูลอยู่ดี
    return pageResult
  } else {
    hasClaim = true
    lastSyncedAt = claimed[0].last_synced_at || null
    const subAt = claimed[0].webhook_subscribed_at
    subDue = !subAt || startedAt - Date.parse(subAt) > WEBHOOK_RESUB_MS
    // เพิ่งซิงก์ไปเมื่อครู่จากอีกเครื่อง → ไม่ต้องดึงซ้ำ
    // ยกเว้นผู้ใช้สั่งเพจนี้เอง (สลับเพจ/กดรีเฟรช) — ต้องได้เห็นข้อความใหม่ทันที
    if (!opts.force && lastSyncedAt && startedAt - Date.parse(lastSyncedAt) < SYNC_FRESH_MS) {
      await sb.from('connected_pages').update({ sync_claimed_at: null }).eq('id', page.id)
      pageResult.skipped = 'recent'
      return pageResult
    }
  }

  // ── ต่อ webhook ไว้ — ปล่อยวิ่งคู่ไปกับการดึงข้อความ (เดิมรอให้ทุกเพจ subscribe เสร็จก่อนค่อยซิงก์
  //    เพจเดียวค้าง = ทั้งรอบหมดเวลา ไม่มีข้อความเข้าเลย) + ยิงซ้ำแค่วันละครั้ง
  const subTask: Promise<void> = subDue
    ? subscribePageToWebhook(page.page_id, page.page_access_token)
        .then(async (sub) => {
          pageResult.webhook_subscribed = sub.success
          if (!sub.success) { console.warn(`[sync] subscribe failed ${page.page_name}: ${sub.error}`); return }
          if (hasClaim) {
            await sb.from('connected_pages').update({ webhook_subscribed_at: new Date().toISOString() }).eq('id', page.id)
          }
        })
        .catch(() => { pageResult.webhook_subscribed = false })
    : Promise.resolve()

  // ── ประมวลผลรายการแชท 1 ชุด: ดึงข้อความเฉพาะที่เปลี่ยน → บันทึก → อัปเดตสถานะแชท ──
  // presetMsgs = ข้อความที่ดึงมาแล้ว (เส้นทาง "แชทเก่าที่ค้าง"), null = ให้ตัดสินใจดึงเอง
  const processConvs = async (convs: any[], presetMsgs: Map<string, any[]> | null) => {
    // จับคู่ conv กับลูกค้า + dedupe ตาม psid (เก็บอันที่ใหม่สุด) กัน insert ชนกันเองในรอบเดียว
    const byPsid = new Map<string, { conv: any; customer: any }>()
    for (const c of convs) {
      const customer = (c.participants?.data || []).find((p: any) => p.id !== page.page_id)
      if (!customer) continue
      const prev = byPsid.get(customer.id)
      if (!prev || new Date(c.updated_time).getTime() > new Date(prev.conv.updated_time).getTime()) {
        byPsid.set(customer.id, { conv: c, customer })
      }
    }
    // เรียงตามเวลาเคลื่อนไหวล่าสุด — ใช้เลือกแชทที่ต้องดึงข้อความเสมอ
    const convCustomers = Array.from(byPsid.values())
      .sort((a, b) => Date.parse(b.conv.updated_time) - Date.parse(a.conv.updated_time))
    if (convCustomers.length === 0) return
    const psids = convCustomers.map(x => x.customer.id)

    // หา conv ที่มีอยู่แล้วในครั้งเดียว
    const existing = new Map<string, KnownConv>()
    const { data: rows, error: lookupErr } = await sb
      .from('conversations')
      .select('id, fb_psid, last_message_at, customer_name, unread_count, send_block_code, send_block_at')
      .eq('fb_page_id', page.page_id)
      .in('fb_psid', psids)
    // อ่านรายชื่อแชทเดิมไม่ได้ → หยุดรอบนี้ ห้ามซิงก์ต่อ
    // ไม่งั้นทุกแชทจะถูกมองว่าเป็น "แชทใหม่" แล้วเขียนทับสถานะอ่านแล้ว / รูปลูกค้า / ป้ายเกิน 24 ชม.
    if (lookupErr) throw new Error(`lookup conversations: ${lookupErr.message}`)
    for (const r of (rows || []) as any[]) {
      existing.set(r.fb_psid, {
        id: r.id,
        lastAt: r.last_message_at,
        name: r.customer_name,
        unread: r.unread_count || 0,
        blockCode: r.send_block_code ?? null,
        blockAt: r.send_block_at ?? null,
      })
    }

    // ── ขั้นที่ 2: ดึงข้อความเฉพาะแชทที่ Facebook บอกว่ามีอะไรใหม่ ──
    // + แชทที่เคลื่อนไหวล่าสุดอีกจำนวนหนึ่งเสมอ เพราะถ้าแอดมินตอบจากแอปเราก่อน เวลาในระบบจะใหม่กว่า
    //   updated_time ของ Facebook — ข้อความลูกค้าที่ส่งมา "ก่อน" คำตอบนั้นจะไม่มีทางถูกดึงถ้าเทียบเวลาอย่างเดียว
    let msgsById: Map<string, any[]>
    if (presetMsgs) {
      msgsById = presetMsgs
    } else {
      const need = convCustomers.filter((x, i) => {
        if (i < ALWAYS_FETCH_TOP) return true
        const known = existing.get(x.customer.id)
        return !known?.lastAt || Date.parse(x.conv.updated_time) > Date.parse(known.lastAt)
      })
      msgsById = new Map()
      if (need.length > 0) {
        const fetched = await getConversationsWithMessagesByIds(
          need.map(x => x.conv.id), page.page_access_token, MSG_LIMIT, opts.deadline,
        )
        for (const c of fetched) msgsById.set(c.id, (c.messages?.data || []) as any[])
      }
    }

    // ดึงโปรไฟล์เฉพาะ conv ใหม่ แบบ batch (1 call/เพจ แทน N)
    const newPsids = psids.filter(p => !existing.has(p))
    const profiles = newPsids.length > 0
      ? await getUserProfilesBatch(newPsids, page.page_access_token)
      : new Map<string, { name?: string; profile_pic?: string }>()

    const msgRows: any[] = []
    const systemMids: string[] = []
    const pending: any[] = []
    let gapFills = 0

    await mapLimit(convCustomers, 8, async ({ conv, customer }) => {
      const psid = customer.id
      // ไม่ได้ดึงข้อความของแชทนี้ = ไม่มีอะไรเปลี่ยน → ไม่ต้องแตะอะไรเลย (รอบปกติของแชทส่วนใหญ่)
      if (!msgsById.has(conv.id)) return
      let allMsgs = msgsById.get(conv.id) as any[]
      // Facebook ไม่ส่งข้อความมาเลย → ไม่รู้อะไรเพิ่ม ห้ามเดาสถานะตอบ/ไม่ตอบจาก snippet อย่างเดียว
      if (allMsgs.length === 0) return
      let known = existing.get(psid)

      // ดึงมาเต็มลิมิต แต่ข้อความเก่าสุดยังใหม่กว่าที่ระบบมี = มีช่วงที่หายไป
      // (แอดมินล็อกจอไว้นาน แล้วลูกค้าส่งรัว) → ตามเก็บย้อนหลังก่อน ไม่งั้นออเดอร์จะขาดท่อน
      if (known?.lastAt && allMsgs.length >= MSG_LIMIT && gapFills < GAP_BACKFILL_MAX && Date.now() < opts.deadline) {
        const oldest = allMsgs.reduce((a: any, m: any) =>
          (!a || Date.parse(m.created_time) < Date.parse(a.created_time) ? m : a), null)
        if (oldest && Date.parse(oldest.created_time) > Date.parse(known.lastAt) + 1000) {
          gapFills++
          const more = await listConversationMessagesUntil(conv.id, page.page_access_token, known.lastAt, 25, 3)
          if (more.length > allMsgs.length) {
            allMsgs = more
            pageResult.gap_filled = (pageResult.gap_filled || 0) + 1
          }
        }
      }

      // ข้อความระบบของ Facebook ไม่นับเป็นข้อความล่าสุด (ป้ายอัตโนมัติ/คำขอโอนเงินที่เด้งหลังลูกค้าทัก ≠ แอดมินตอบแล้ว)
      // ไม่มี from ก็เป็นข้อความระบบเหมือนกัน (ลูปบันทึกข้างล่างข้ามอยู่แล้ว) → ห้ามเอามาตัดสินสถานะตอบ/ไม่ตอบ
      const realMsgs = allMsgs.filter(m => m.from?.id && !isFbSystemGraphMessage(m, page.page_id, customer.name))
      // Facebook ตอบแทนเพจเองตอนไม่มีคนรับสาย ("ขออภัยที่ไม่ได้รับสายของคุณ") — ลูกค้าเห็นข้อความนี้จริง
      // จึงต้องแสดงในแชท แต่ "ไม่ใช่คนตอบ" → ห้ามเอามาตัดสินข้อความล่าสุด/สถานะตอบ
      const humanMsgs = realMsgs.filter(m => !isFbAutoReplyText(m.message, m.from.id === page.page_id ? 'outbound' : 'inbound'))
      const newestAny = newestMessage(allMsgs)
      const newest = newestMessage(humanMsgs)
      // ข้อความที่ดึงมารอบนี้เป็นข้อความระบบ/ข้อความที่ Facebook ตอบแทนทั้งหมด (เช่นลูกค้าโทรมาหลายสาย)
      // → ไม่รู้ว่าข้อความจริงล่าสุดคืออะไร
      // → ไม่แตะข้อความล่าสุด/สถานะตอบของแชทที่มีอยู่ และไม่สร้างแชทใหม่ (รอข้อความจริงก่อน)
      const onlySystem = !newest && !!newestAny
      const lastSender: 'page' | 'customer' = newest
        ? (newest.from?.id === page.page_id ? 'page' : 'customer')
        : 'customer'
      // snippet ของ Facebook = ข้อความล่าสุดจริงๆ (อาจเป็นข้อความระบบ) → ใช้เมื่อข้อความล่าสุดไม่ใช่ข้อความระบบ
      const lastMsg = newest && newest !== newestAny
        ? (newest.message || '(ไฟล์แนบ)')
        : (conv.snippet || newest?.message || '')

      let convId = known?.id
      if (!convId && onlySystem) return
      if (!convId) {
        // insert แบบไม่ทับของเดิม (กัน race กับ webhook/อีกรอบซิงก์ที่อาจสร้างแทรก)
        const profile = profiles.get(psid)
        // รูปโปรไฟล์: เก็บลง Storage เลย (ลิงก์ของ FB หมดอายุเร็ว) — ดึงไม่ได้ก็ใช้ลิงก์ FB ไปก่อน
        const hostedPic = await hostProfilePic(sb, page.id, psid, profile?.profile_pic)
        const { data: up, error: upErr } = await sb
          .from('conversations')
          .upsert(
            {
              user_id: page.user_id || userId,  // เจ้าของเพจ (กัน agent sync แล้วเปลี่ยนเจ้าของ conversation)
              page_id: page.id,
              fb_page_id: page.page_id,
              fb_conversation_id: conv.id,
              fb_psid: psid,
              customer_name: customer.name || profile?.name || 'ลูกค้า',
              customer_picture: hostedPic || profile?.profile_pic || null,
              last_message: lastMsg,
              last_message_at: conv.updated_time,
              last_sender: lastSender,
              unread_count: onlySystem ? 0 : (conv.unread_count || 0),
              ...(lastSender === 'customer' ? { send_block_code: null, send_block_at: null } : {}),
            },
            { onConflict: 'fb_page_id,fb_psid', ignoreDuplicates: true },
          )
          .select('id')
          .single()
        if (upErr || !up) {
          // มีแถวอยู่แล้วจริง (หรือ insert คืน null) → ใช้แถวเดิมและไปทางเดียวกับแชทที่มีอยู่
          // ห้าม upsert ทับ ไม่งั้นสถานะอ่านแล้ว/รูปลูกค้า/ป้ายเกิน 24 ชม. จะหายไปทั้งแถว
          const { data: re } = await sb
            .from('conversations')
            .select('id, last_message_at, customer_name, unread_count, send_block_code, send_block_at')
            .eq('fb_page_id', page.page_id)
            .eq('fb_psid', psid)
            .maybeSingle()
          if (!re) { pageResult.errors.push(`conv ${psid}: ${upErr?.message || 'no id'}`); return }
          convId = re.id as string
          known = {
            id: convId,
            lastAt: re.last_message_at,
            name: re.customer_name,
            unread: re.unread_count || 0,
            blockCode: re.send_block_code ?? null,
            blockAt: re.send_block_at ?? null,
          }
          existing.set(psid, known)
        } else {
          convId = up.id as string
          pageResult.conversations++
          existing.set(psid, { id: convId, lastAt: conv.updated_time, unread: 0, blockCode: null, blockAt: null })
        }
      } else if (known?.name === 'ลูกค้า' && customer.name && customer.name !== 'ลูกค้า') {
        // แชทที่ webhook สร้างไว้ตอนดึงโปรไฟล์ไม่ได้ (ชื่อ "ลูกค้า") → ใส่ชื่อจริงจากรายชื่อผู้ร่วมแชท
        await sb.from('conversations').update({ customer_name: customer.name }).eq('id', convId)
      }

      for (const m of allMsgs) {
        if (!m.from?.id) continue  // system message ไม่มี from → ข้าม
        const isFromPage = m.from.id === page.page_id
        // บันทึกป้ายเฉพาะที่ Facebook ยืนยันเอง (admin_text) — ที่ดูจากตัวหนังสือจะซ่อนตอนแสดงผลแทน
        const isSystem = isFbAdminTagged(m, page.page_id)
        if (isSystem && known) systemMids.push(m.id)
        const parsedAtts = parseMsgAttachments(m)
        msgRows.push({
          conversation_id: convId,
          fb_message_id: m.id,
          fb_sender_id: m.from.id,
          direction: isFromPage ? 'outbound' : 'inbound',
          message_text: m.message || null,
          // Facebook ไม่ส่งเนื้อหามาเลย ("ไม่สามารถดูข้อความได้" — อีโมจิ/สติกเกอร์บางแบบ ข้อความพิเศษ)
          // → ติดป้ายไว้ หน้าแชทจะบอกให้เปิดดูใน Facebook และ repair จะไม่ดึงซ้ำ
          attachments: !m.message && parsedAtts.length === 0 ? [{ type: 'unavailable' }] : parsedAtts,
          // ข้อความระบบของ Facebook → ติดป้ายไว้ หน้าแชทจะไม่แสดง
          sent_by: isSystem ? FB_SYSTEM_SENT_BY : (isFromPage ? 'page_user' : 'customer'),
          delivery_status: 'delivered',
          created_at: m.created_time,
        })
      }

      // แชทที่มีอยู่ก่อนแล้ว → อัปเดตสถานะทีหลัง (ต้องรู้ก่อนว่าข้อความไหน "ใหม่จริง")
      if (known) {
        pending.push({
          convId,
          conv,
          known,
          lastMsg,
          lastSender,
          onlySystem,
          inboundReal: realMsgs.filter(m => m.from.id !== page.page_id),
        })
      }
    })

    // ── บันทึกข้อความ (เฉพาะที่ยังไม่มี) ──
    // .select() บน upsert แบบ ignoreDuplicates = ON CONFLICT DO NOTHING RETURNING → คืนเฉพาะแถวที่ insert จริง
    // → รู้ว่า "ข้อความไหนใหม่" จากรหัสข้อความ ไม่ใช่จากการเทียบเวลา (เวลาในระบบเดินเร็วกว่าของ Facebook ได้)
    const insertedMids = new Set<string>()
    for (let i = 0; i < msgRows.length; i += 500) {
      const { data, error } = await sb
        .from('inbox_messages')
        .upsert(msgRows.slice(i, i + 500), { onConflict: 'fb_message_id', ignoreDuplicates: true })
        .select('fb_message_id')
      if (error) { pageResult.errors.push(`upsert batch ${i}: ${error.message}`); continue }
      for (const r of (data || []) as any[]) insertedMids.add(r.fb_message_id)
      pageResult.messages += (data || []).length
    }

    // นับข้อความลูกค้าที่เพิ่งเข้าระบบจริง แยกตามแชท
    const bump = new Map<string, number>()
    for (const p of pending) {
      const fresh = p.inboundReal.filter((m: any) => insertedMids.has(m.id))
      if (fresh.length === 0) continue
      // ข้อความเก่าที่เพิ่งตามเก็บย้อนหลังไม่ใช่ "ข้อความใหม่" → นับเฉพาะที่ใหม่กว่าข้อความลูกค้าล่าสุดที่เคยมี
      const storedNewest = p.inboundReal
        .filter((m: any) => !insertedMids.has(m.id))
        .reduce((a: string | null, m: any) => (!a || Date.parse(m.created_time) > Date.parse(a) ? m.created_time : a), null)
      const counted = storedNewest
        ? fresh.filter((m: any) => Date.parse(m.created_time) > Date.parse(storedNewest))
        : fresh
      if (counted.length > 0) bump.set(p.convId, counted.length)
    }

    // ── ลูกค้าเก่าทักกลับเข้ามา → ดึงแชทออกจาก "ที่จัดเก็บ"/"จบบทสนทนา" กลับเข้ากล่องข้อความ ──
    // bump = ข้อความของ "ลูกค้า" ที่เพิ่งเข้าระบบจริงรอบนี้เท่านั้น (ไม่ใช่ข้อความเพจ/ข้อความระบบ/ข้อความเก่าที่ตามเก็บย้อนหลัง)
    // ถ้าไม่ปลดให้ แชทที่แอดมินเคยกดจัดเก็บ/จบบทสนทนาจะไม่โผล่ในรายการอีกเลย ทั้งที่ลูกค้ารอคำตอบอยู่
    if (bump.size > 0) {
      const { error } = await sb
        .from('conversations')
        .update({ is_archived: false, is_resolved: false })
        .in('id', Array.from(bump.keys()))
        .or('is_archived.eq.true,is_resolved.eq.true')  // แตะเฉพาะแถวที่ต้องปลดจริง — แชทปกติไม่ต้องเขียนซ้ำ
      if (error) pageResult.errors.push(`unarchive: ${error.message}`)
    }

    // อ่านตัวเลข "ยังไม่อ่าน" ล่าสุดอีกรอบ — แอดมินอาจเพิ่งเปิดอ่านระหว่างที่เราคุยกับ Facebook
    const curUnread = new Map<string, number>()
    if (bump.size > 0) {
      const { data } = await sb.from('conversations').select('id, unread_count').in('id', Array.from(bump.keys()))
      for (const r of (data || []) as any[]) curUnread.set(r.id, r.unread_count || 0)
    }

    // ── อัปเดตสถานะแชทที่มีอยู่แล้ว ──
    await mapLimit(pending, 8, async (p: any) => {
      const { convId, conv, known, lastMsg, lastSender, onlySystem } = p
      // FB ส่งเวลามาแบบ +0000 → แปลงเป็น ISO (Z) ก่อน ไม่งั้น '+' ใน query string กลายเป็นช่องว่าง
      const fbAt = new Date(conv.updated_time).toISOString()
      const fbNewer = !known.lastAt || Date.parse(fbAt) > Date.parse(known.lastAt)

      const newestCustomer = p.inboundReal
        .reduce((a: any, m: any) => (!a || Date.parse(m.created_time) > Date.parse(a.created_time) ? m : a), null)
      // ลูกค้าทักกลับหลังจากที่ระบบติดป้าย "ส่งไม่ได้" → หน้าต่าง 24 ชม. เปิดใหม่แล้ว
      // ต้องล้างป้ายแม้ข้อความล่าสุดจะเป็นของเพจ (แอดมินตอบจากแอป Facebook ก่อนรอบซิงก์นี้)
      const customerAfterBlock = !!known.blockCode && !!known.blockAt && !!newestCustomer
        && Date.parse(newestCustomer.created_time) > Date.parse(known.blockAt) - 1000
      const blockPatch = (lastSender === 'customer' || customerAfterBlock)
        ? { send_block_code: null, send_block_at: null }
        : {}

      if (fbNewer) {
        await sb
          .from('conversations')
          .update(onlySystem
            ? { fb_conversation_id: conv.id, last_message_at: fbAt }
            : {
                fb_conversation_id: conv.id,
                last_message: lastMsg,
                last_message_at: fbAt,
                last_sender: lastSender,
                ...blockPatch,
              })
          .eq('id', convId)
          // แอดมินเพิ่งตอบระหว่างที่เรากำลังคุยกับ Facebook → ห้ามเขียนของเก่าทับสถานะที่ใหม่กว่า
          // (แชทจะเด้งกลับไป "ใหม่/ยังไม่ตอบ" แล้วแอดมินตอบซ้ำ) — กติกาเดียวกับฝั่ง webhook
          .or(`last_message_at.is.null,last_message_at.lte."${fbAt}"`)
      } else if (customerAfterBlock) {
        // แชทที่ค้างป้าย "ส่งไม่ได้" ทั้งที่ลูกค้าทักกลับมาแล้ว → ล้างป้ายอย่างเดียว
        await sb.from('conversations')
          .update({ send_block_code: null, send_block_at: null })
          .eq('id', convId)
          .not('send_block_code', 'is', null)
      }

      // ตัวเลข "ยังไม่อ่าน": นับจากข้อความที่เพิ่งบันทึกได้จริง ไม่ลอกตัวเลขของ Facebook
      // (Facebook นับแค่การอ่านใน Business Suite — แอปเราไม่เคยส่ง mark_seen ตัวเลขจึงไม่เคยลด)
      const cur = curUnread.has(convId) ? (curUnread.get(convId) as number) : known.unread
      const add = bump.get(convId) || 0
      let next: number | null = null
      if (add > 0) next = Math.min(99, cur + add)
      else if (fbNewer && (conv.unread_count || 0) === 0) next = 0  // อ่าน/ตอบใน Business Suite แล้ว → ล้าง
      if (next !== null && next !== cur) {
        await sb.from('conversations').update({ unread_count: next }).eq('id', convId)
      }
    })

    // ข้อความระบบที่บันทึกไว้ก่อนหน้านี้ (ก่อนมีตัวกรอง) → ติดป้ายย้อนหลัง
    for (let i = 0; i < systemMids.length; i += 50) {
      const { error } = await sb
        .from('inbox_messages')
        .update({ sent_by: FB_SYSTEM_SENT_BY })
        .in('fb_message_id', systemMids.slice(i, i + 50))
        .or(`sent_by.is.null,sent_by.neq.${FB_SYSTEM_SENT_BY}`)
      if (error) { console.warn(`[sync] mark system failed ${page.page_name}: ${error.message}`); break }
    }
  }

  let ok = false
  try {
    // ── ขั้นที่ 1: รายชื่อแชท (ยังไม่ดึงข้อความ) — คำขอเล็ก 1 ครั้งต่อเพจ ──
    // ไล่หน้าต่อจนถึงแชทที่เก่ากว่ารอบซิงก์ก่อนหน้า → แชทใหม่ที่ทะลุ 80 อันดับแรก (เช่นคืนที่ยิงแอด) ก็ไม่ตกหล่น
    const untilIso = lastSyncedAt
      ? new Date(Date.parse(lastSyncedAt) - 60 * 1000).toISOString()  // เผื่อเวลาคาบเกี่ยว 1 นาที
      : null
    const listPages = untilIso ? 5 : 2
    let fbConvs: any[] = []
    try {
      fbConvs = await listConversations(page.page_id, page.page_access_token, 40, listPages, untilIso)
    } catch (e: any) {
      // ต่อ token ใหม่เฉพาะตอน token ตายจริง — พลาดชั่วคราวปล่อยให้รอบหน้าลองต่อ
      if (!(await refreshToken(page, e))) throw e
      fbConvs = await listConversations(page.page_id, page.page_access_token, 40, listPages, untilIso)
    }

    await processConvs(fbConvs, null)

    // แชทเก่าที่หลุดจากรายการล่าสุด แต่ยังค้างใน "ใหม่"/"ยังไม่ตอบ"
    // → ถ้าบน Facebook มีความเคลื่อนไหวใหม่กว่า (เช่นแอดมินตอบจากแอป Facebook/Business Suite) ดึงมาอัปเดต
    // ทำ "หลัง" บันทึกชุดหลักเสมอ — ส่วนนี้ช้าและพังได้ ห้ามทำให้ข้อความใหม่ตกหล่นเพราะหมดเวลา function
    if (Date.now() < opts.deadline) {
      try {
        const listed = new Set(fbConvs.map((c: any) => c.id))
        const { data: stale } = await sb
          .from('conversations')
          .select('fb_conversation_id, last_message_at')
          .eq('page_id', page.id)
          .eq('is_archived', false)
          .or('last_sender.eq.customer,unread_count.gt.0')
          .not('fb_conversation_id', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(60)
        const candidates = ((stale || []) as any[]).filter(r => !listed.has(r.fb_conversation_id))
        if (candidates.length > 0) {
          const times = await getConversationUpdateTimes(
            candidates.map(r => r.fb_conversation_id), page.page_access_token, opts.deadline,
          )
          const changed = candidates
            .filter(r => {
              const t = times.get(r.fb_conversation_id)
              // ความละเอียดเวลาของ FB เป็นวินาที → เผื่อ 1 วิ
              return !!t && (!r.last_message_at || Date.parse(t) > Date.parse(r.last_message_at) + 1000)
            })
            .slice(0, 30)
            .map(r => r.fb_conversation_id as string)
          if (changed.length > 0 && Date.now() < opts.deadline) {
            const staleConvs = await getConversationsWithMessagesByIds(
              changed, page.page_access_token, MSG_LIMIT, opts.deadline,
            )
            const staleMsgs = new Map<string, any[]>()
            for (const c of staleConvs) staleMsgs.set(c.id, (c.messages?.data || []) as any[])
            await processConvs(staleConvs, staleMsgs)
            pageResult.stale_refreshed = changed.length
          }
        }
      } catch (e: any) {
        console.warn(`[sync] stale check failed ${page.page_name}: ${e?.message || e}`)
      }
    }

    if (Date.now() < opts.deadline) {
      try {
        const fixed = await fixSystemLastMessages(sb, page.id)
        if (fixed > 0) pageResult.system_last_fixed = fixed
      } catch (e: any) {
        console.warn(`[sync] fix system last message failed ${page.page_name}: ${e?.message || e}`)
      }
    }

    // รูปลูกค้าเป็นงานท้ายสุดเสมอ — ช้าและพังได้ ห้ามทำให้ข้อความใหม่ตกหล่นเพราะหมดเวลา function
    if (Date.now() < opts.deadline) {
      try {
        const pics = await backfillCustomerPictures(sb, page, opts.deadline)
        if (pics > 0) pageResult.pictures = pics
      } catch (e: any) {
        console.warn(`[sync] avatar backfill failed ${page.page_name}: ${e?.message || e}`)
      }
    }
    ok = true
  } catch (e: any) {
    pageResult.errors.push(`Sync: ${e?.message || e}`)
  }

  try { await subTask } catch {}
  if (hasClaim) {
    // ปลดล็อกเสมอ; ขยับ "เวลาซิงก์ล่าสุด" เฉพาะรอบที่สำเร็จ (รอบที่ล้ม = รอบถัดไปทำต่อได้ทันที)
    // ใช้เวลา "เริ่มรอบ" เป็นหลักหมุด เพื่อไม่ให้แชทที่ขยับระหว่างรอบหลุดจากรอบหน้า
    await sb.from('connected_pages')
      .update({ sync_claimed_at: null, ...(ok ? { last_synced_at: new Date(startedAt).toISOString() } : {}) })
      .eq('id', page.id)
  }
  return pageResult
}
