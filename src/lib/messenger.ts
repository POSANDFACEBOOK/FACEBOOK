// Facebook Messenger API helpers
// Docs: https://developers.facebook.com/docs/messenger-platform
import crypto from 'crypto'

const FB_API = 'https://graph.facebook.com/v19.0'

// ============================================
// Webhook signature verification
// ============================================

/** ตรวจสอบ X-Hub-Signature-256 ว่ามาจาก Facebook จริง (ใช้ APP_SECRET) */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET
  if (!appSecret) return false

  // Format: "sha256=<hex>"
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')

  // timing-safe compare
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ============================================
// Send messages (Send API)
// ============================================

export interface SendMessageResult {
  success: boolean
  message_id?: string
  recipient_id?: string
  error?: string
  errorCode?: number
  // Facebook ใช้ code เดียวกันกับหลายสาเหตุ (เช่น #10 = เกิน 24 ชม. หรือสิทธิ์แอปไม่พอ)
  // ต้องส่ง error_subcode ต่อให้ route ด้วย ไม่งั้นต้องเดาจากข้อความภาษาอังกฤษของ FB ซึ่งเปลี่ยนได้ตลอด
  errorSubcode?: number
  // true = เราตัดสายเองเพราะรอนานเกิน ไม่ใช่ Facebook ปฏิเสธ → "ไม่รู้ว่าลูกค้าได้รับแล้วหรือยัง"
  // ห้ามเอาไปแสดงว่า "ส่งไม่สำเร็จ กดส่งอีกครั้ง" เพราะ Facebook อาจส่งถึงลูกค้าไปแล้ว = ลูกค้าได้ข้อความซ้ำ
  timedOut?: boolean
}

// งบเวลาต่อการยิง Graph 1 ครั้ง — route ที่เรียก (api/inbox/send, webhooks/messenger) ตั้ง maxDuration = 30
// ลำดับที่ต้องรักษาไว้: ส่งรูป 18 วิ < client รอ 25 วิ (inbox/page.tsx) < maxDuration 30 วิ
// เพื่อให้ข้อความบอกสาเหตุจาก server ถึงมือแอดมินทัน และยังเหลือเวลาบันทึกผลลงฐานข้อมูล
// (ส่งซ้ำด้วย HUMAN_AGENT เกิดได้เฉพาะเมื่อ Facebook ตอบ code 10 จริง — หมดเวลาแล้วจะไม่ยิงซ้ำ)
const SEND_TEXT_TIMEOUT_MS = 12000
// FB ต้องไปโหลดรูปจาก Supabase Storage ระหว่างคอลนี้ รูป 1–4 MB กิน 6 วิได้ง่ายๆ
const SEND_ATTACHMENT_TIMEOUT_MS = 18000

// undici โยน DOMException ชื่อ TimeoutError เมื่อ AbortSignal.timeout ทำงาน
const isSendTimeout = (e: any): boolean =>
  e?.name === 'TimeoutError' || e?.code === 'UND_ERR_HEADERS_TIMEOUT' || e?.code === 'UND_ERR_BODY_TIMEOUT'

// หมดเวลา/เน็ตล่ม = ไม่มี error code จาก Facebook — บอกสาเหตุให้ชัดใน log ของ route
const sendNetworkError = (e: any): string =>
  isSendTimeout(e) ? 'Facebook ตอบช้าเกินไป (ไม่รู้ว่าส่งถึงลูกค้าแล้วหรือยัง)' : (e?.message || 'Network error')

/** ส่งข้อความ text ไปหาลูกค้า — ต้องอยู่ใน 24-hour messaging window */
export async function sendTextMessage(
  pageToken: string,
  recipientPsid: string,
  text: string,
  messagingType: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG' = 'RESPONSE',
  tag?: string,  // ต้องส่งคู่กับ messagingType='MESSAGE_TAG' เช่น HUMAN_AGENT
): Promise<SendMessageResult> {
  try {
    const body: any = {
      messaging_type: messagingType,
      recipient: { id: recipientPsid },
      message: { text },
    }
    if (tag) body.tag = tag
    const res = await fetch(`${FB_API}/me/messages?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TEXT_TIMEOUT_MS),  // ค้างที่ FB ไม่ได้ — จะกิน function จนหมดเวลาก่อนบันทึกผล
    })
    const data = await res.json()
    if (data.error) {
      return {
        success: false,
        error: data.error.message,
        errorCode: data.error.code,
        errorSubcode: data.error.error_subcode,
      }
    }
    return {
      success: true,
      message_id: data.message_id,
      recipient_id: data.recipient_id,
    }
  } catch (e: any) {
    // หมดเวลา = ตัดสายฝั่งเราเท่านั้น Facebook อาจส่งถึงลูกค้าไปแล้ว → บอก route ว่า "ไม่แน่ใจ"
    return { success: false, error: sendNetworkError(e), timedOut: isSendTimeout(e) }
  }
}

/** ส่งรูป/ไฟล์แนบ (รองรับ messaging_type + HUMAN_AGENT tag เหมือนข้อความ) */
export async function sendAttachment(
  pageToken: string,
  recipientPsid: string,
  attachmentType: 'image' | 'video' | 'audio' | 'file',
  url: string,
  messagingType: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG' = 'RESPONSE',
  tag?: string,
): Promise<SendMessageResult> {
  try {
    const body: any = {
      messaging_type: messagingType,
      recipient: { id: recipientPsid },
      message: {
        attachment: {
          type: attachmentType,
          payload: { url, is_reusable: true },
        },
      },
    }
    if (tag) body.tag = tag
    const res = await fetch(`${FB_API}/me/messages?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_ATTACHMENT_TIMEOUT_MS),  // FB ต้องโหลดรูปจาก URL ของเรา ช้าได้ แต่ห้ามค้างจนหมดเวลา function
    })
    const data = await res.json()
    if (data.error) {
      return {
        success: false,
        error: data.error.message,
        errorCode: data.error.code,
        errorSubcode: data.error.error_subcode,
      }
    }
    return { success: true, message_id: data.message_id }
  } catch (e: any) {
    // เหมือน sendTextMessage — รูปยิ่งช้า ยิ่งมีโอกาสที่ FB ส่งถึงแล้วแต่เราตัดสายก่อน
    return { success: false, error: sendNetworkError(e), timedOut: isSendTimeout(e) }
  }
}

/** ส่งสถานะ "กำลังพิมพ์..." (typing indicator) */
export async function sendSenderAction(
  pageToken: string,
  recipientPsid: string,
  action: 'typing_on' | 'typing_off' | 'mark_seen'
): Promise<boolean> {
  try {
    const res = await fetch(`${FB_API}/me/messages?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        sender_action: action,
      }),
      // "กำลังพิมพ์..." เป็นของแถม — ต้องสั้นกว่าการส่งข้อความจริง จะได้ไม่แย่งเวลา function
      signal: AbortSignal.timeout(4000),
    })
    const data = await res.json()
    return !data.error
  } catch {
    return false
  }
}

// ============================================
// Read conversations + messages
// ============================================

export interface FBConversation {
  id: string                               // t_xxxxxxx
  updated_time: string
  unread_count?: number
  participants?: { data: Array<{ id: string; name?: string; email?: string }> }
  snippet?: string
}

// ── error จาก Graph ที่พก "รหัส" มาด้วย ──
// ผู้เรียกต้องแยกให้ออกว่า token ตายจริง (ต้องต่อใหม่) หรือแค่พลาดชั่วคราว (จำกัดอัตรา/ข้อมูลเยอะเกิน)
// ไม่งั้นทุก error จะถูกเข้าใจว่า token หมดอายุ แล้วไปเขียนทับ token ที่ยังดีอยู่
function graphError(err: any): Error & { code?: number; type?: string } {
  const e: any = new Error(err?.message || 'facebook error')
  e.code = err?.code
  e.type = err?.type
  return e
}

// Facebook ใช้ type 'OAuthException' กับ error จำกัดอัตรา (#4/#17/#613) ด้วย → ดูที่รหัสเท่านั้น
const FB_AUTH_CODES = new Set([102, 190, 458, 459, 460, 463, 464, 467])

/** error นี้แปลว่า page token ใช้ไม่ได้แล้วจริงๆ (ไม่ใช่แค่ติดขัดชั่วคราว) */
export function isFbAuthError(e: any): boolean {
  if (FB_AUTH_CODES.has(Number(e?.code))) return true
  return /access token|session (has expired|is invalid)/i.test(String(e?.message || ''))
}

const isTooMuchData = (e: any) =>
  Number(e?.code) === 1 || /reduce the amount of data/i.test(String(e?.message || ''))

/**
 * ไล่หน้า /{page}/conversations แบบทนพลาด
 * - หน้าแรกล้ม = ไม่ได้อะไรเลย → โยน error ต่อ (ผู้เรียกจะได้ลองต่อ token ใหม่)
 * - หน้าถัดไปล้ม → เก็บเท่าที่ได้ (แชทใหม่สุดอยู่หน้าแรกเสมอ) ดีกว่าทิ้งทั้งเพจแล้วข้อความไม่เข้า
 * - untilIso = ถึงแชทที่เก่ากว่าเวลานี้แล้วหยุด (ไม่ต้องไล่จนครบ maxPages)
 */
async function fetchConvPages(
  pageId: string,
  pageToken: string,
  fields: string,
  limit: number,
  maxPages: number,
  untilIso?: string | null,
): Promise<any[]> {
  const qs = new URLSearchParams({ fields, limit: String(limit), access_token: pageToken })
  let url: string | undefined = `${FB_API}/${pageId}/conversations?${qs.toString()}`
  const all: any[] = []
  let pages = 0
  while (url && pages < maxPages) {
    let data: any
    try {
      // ไม่มี timeout = undici รอได้ถึง 5 นาที → function หมดเวลา 60 วิ ก่อนจะได้เขียนอะไรลงฐานข้อมูล
      const res: Response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      data = await res.json()
    } catch (e: any) {
      data = { error: { message: e?.name === 'TimeoutError' ? 'Facebook ตอบช้าเกินไป' : (e?.message || 'network error') } }
    }
    if (data?.error) {
      if (all.length === 0) throw graphError(data.error)
      console.warn(`[messenger] conversations page ${pages + 1} failed for ${pageId}: ${data.error.message}`)
      break
    }
    const batch = (data.data || []) as any[]
    all.push(...batch)
    pages++
    const oldest = batch[batch.length - 1]
    if (untilIso && oldest?.updated_time && Date.parse(oldest.updated_time) <= Date.parse(untilIso)) break
    url = data.paging?.next
  }
  return all
}

/** ดึง conversations ของ Page (paginated) */
export async function listConversations(
  pageId: string,
  pageToken: string,
  limit = 50,
  maxPages = 5,  // ดึงสูงสุด 5 หน้า × 50 = 250 conversations ต่อ FB page
  untilIso?: string | null,  // หยุดเมื่อถึงแชทที่เก่ากว่าเวลานี้ (เช่นเวลาซิงก์รอบก่อน)
): Promise<FBConversation[]> {
  return await fetchConvPages(
    pageId, pageToken, 'id,updated_time,unread_count,snippet,participants', limit, maxPages, untilIso,
  ) as FBConversation[]
}

export interface FBMessage {
  id: string                               // mid.xxx
  created_time: string
  from: { id: string; name?: string; email?: string }
  to?: { data: Array<{ id: string; name?: string }> }
  message?: string
  sticker?: string                         // URL ของ sticker (ถ้าข้อความเป็น sticker)
  shares?: { data: Array<{ link?: string; description?: string }> }
  attachments?: { data: Array<{ id: string; mime_type?: string; name?: string; image_data?: any; file_url?: string }> }
  tags?: { data: Array<{ name: string }> }  // admin_text = ข้อความระบบของ Facebook
}

/** ดึงข้อความใน conversation */
export async function listMessages(
  conversationId: string,
  pageToken: string,
  limit = 50,
  maxPages = 4,  // ดึงสูงสุด 4 หน้า × 50 = 200 messages ต่อ conversation
): Promise<FBMessage[]> {
  // เพิ่ม sticker — FB เก็บ URL ของ sticker ใน field นี้แยกจาก attachments
  const fields = 'id,created_time,from,to,message,sticker,shares,attachments'
  const all: FBMessage[] = []
  let url: string | undefined =
    `${FB_API}/${conversationId}/messages?fields=${fields}&limit=${limit}&access_token=${pageToken}`
  let pages = 0
  while (url && pages < maxPages) {
    const res: Response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const data: any = await res.json()
    if (data.error) throw graphError(data.error)
    all.push(...((data.data || []) as FBMessage[]))
    url = data.paging?.next
    pages++
  }
  return all
}

export interface FBConversationWithMessages extends FBConversation {
  messages?: { data: FBMessage[] }
}

/**
 * ดึง conversations พร้อมข้อความล่าสุด inline ในครั้งเดียว (เลี่ยง N+1)
 * ใช้ field expansion ของ Graph API — 1 call/เพจ แทน 1 + N calls
 */
const CONV_MSG_FIELDS =
  'id,created_time,from,to,message,sticker,shares,tags,attachments{id,mime_type,name,type,image_data,file_url,video_data,audio_data,payload}'
const convFields = (msgLimit: number) =>
  `id,updated_time,unread_count,snippet,participants,messages.limit(${msgLimit}){${CONV_MSG_FIELDS}}`

// ยิงทีละไม่เกิน limit คำขอ — เดิมใช้ Promise.all ทั้งชุด 50 ทำให้โดน Facebook จำกัดอัตราง่าย
async function mapLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0
  const n = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) await fn(items[idx++])
  }))
}

/** เวลาอัปเดตล่าสุดของหลายแชทในครั้งเดียว (Graph ?ids= ครั้งละ 50) → Map<conversationId, updated_time> */
export async function getConversationUpdateTimes(
  conversationIds: string[],
  pageToken: string,
  deadline?: number,  // หมดเวลาแล้วหยุดกลางคัน — งานส่วนนี้เป็นงานเสริม ห้ามทำให้ function ถูกตัด
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = Array.from(new Set(conversationIds.filter(Boolean)))
  for (let i = 0; i < ids.length; i += 50) {
    if (deadline && Date.now() > deadline) break
    const chunk = ids.slice(i, i + 50)
    const data = await getJson(`${FB_API}/?${new URLSearchParams({ ids: chunk.join(','), fields: 'updated_time', access_token: pageToken })}`)
    if (data && !data.error) {
      for (const [id, v] of Object.entries(data)) {
        const t = (v as any)?.updated_time
        if (typeof t === 'string') out.set(id, t)
      }
      continue
    }
    // Facebook ปฏิเสธทั้งชุดถ้ามีแชทเดียวที่อ่านไม่ได้ (เช่นถูกลบใน Business Suite) → ถามทีละแชท ข้ามตัวที่อ่านไม่ได้
    const bad: string[] = []
    await mapLimited(chunk, 6, async id => {
      if (deadline && Date.now() > deadline) return
      const d = await getJson(`${FB_API}/${encodeURIComponent(id)}?${new URLSearchParams({ fields: 'updated_time', access_token: pageToken })}`)
      if (typeof d?.updated_time === 'string') out.set(id, d.updated_time)
      else bad.push(id)
    })
    if (bad.length) console.warn(`[messenger] unreadable conversations: ${bad.join(',')}`)
  }
  return out
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    return await res.json()
  } catch {
    return null
  }
}

/** ดึงแชทพร้อมข้อความล่าสุดตาม id (รูปแบบเดียวกับ listConversationsWithMessages) */
export async function getConversationsWithMessagesByIds(
  conversationIds: string[],
  pageToken: string,
  msgLimit = 25,
  deadline?: number,
): Promise<FBConversationWithMessages[]> {
  const all: FBConversationWithMessages[] = []
  const ids = Array.from(new Set(conversationIds.filter(Boolean)))
  // ครั้งละ 10 แชท (แชทละ msgLimit ข้อความ) — ชุดใหญ่เกินไป Facebook ตอบว่าข้อมูลเยอะเกิน
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))
  // 3 ชุดพร้อมกัน — เวลาที่ใช้ตรงนี้คือความช้าที่ลูกค้ารอข้อความ (ซิงก์รอบแรกมีได้ถึง 8 ชุด)
  await mapLimited(chunks, 3, async chunk => {
    if (deadline && Date.now() > deadline) return
    const data = await getJson(`${FB_API}/?${new URLSearchParams({ ids: chunk.join(','), fields: convFields(msgLimit), access_token: pageToken })}`)
    if (data && !data.error) {
      for (const v of Object.values(data)) {
        if (v && (v as any).id) all.push(v as FBConversationWithMessages)
      }
      return
    }
    // ชุดนี้ล้ม → ดึงทีละแชท เก็บเฉพาะที่ได้
    await mapLimited(chunk, 4, async id => {
      if (deadline && Date.now() > deadline) return
      const d = await getJson(`${FB_API}/${encodeURIComponent(id)}?${new URLSearchParams({ fields: convFields(msgLimit), access_token: pageToken })}`)
      if (d && !d.error && d.id) all.push(d as FBConversationWithMessages)
    })
  })
  return all
}

/**
 * ไล่ข้อความย้อนหลังในแชทเดียวจนถึงเวลาที่ระบบมีอยู่แล้ว — ปิดช่องว่างตอนซิงก์ห่างกันนาน
 * (ลูกค้าส่ง 14 ข้อความตอนแอดมินล็อกจอ → ชุดล่าสุดชุดเดียวไม่พอ ออเดอร์จะขาดท่อน)
 * ดึงไม่ได้ก็คืนเท่าที่ได้ — ห้ามโยน error ทิ้งข้อความชุดหลัก
 */
export async function listConversationMessagesUntil(
  conversationId: string,
  pageToken: string,
  sinceIso: string | null,
  limit = 25,
  maxPages = 3,
): Promise<FBMessage[]> {
  const all: FBMessage[] = []
  const qs = new URLSearchParams({ fields: CONV_MSG_FIELDS, limit: String(limit), access_token: pageToken })
  let url: string | undefined = `${FB_API}/${encodeURIComponent(conversationId)}/messages?${qs.toString()}`
  let pages = 0
  const until = sinceIso ? Date.parse(sinceIso) : NaN
  while (url && pages < maxPages) {
    const data = await getJson(url)
    if (!data || data.error) break
    const batch = (data.data || []) as FBMessage[]
    all.push(...batch)
    pages++
    const oldest = batch[batch.length - 1]
    if (!oldest?.created_time) break
    if (!Number.isNaN(until) && Date.parse(oldest.created_time) <= until) break
    url = data.paging?.next
  }
  return all
}

export async function listConversationsWithMessages(
  pageId: string,
  pageToken: string,
  convLimit = 40,
  msgLimit = 15,
  maxPages = 2,
): Promise<FBConversationWithMessages[]> {
  // Facebook ตอบ "reduce the amount of data" ได้ถ้าแชทเต็มไปด้วยรูป → ลดขนาดชุดแล้วลองใหม่
  // ดีกว่าให้ทั้งเพจล้มแล้วไม่มีข้อความเข้าเลย
  const sizes: Array<[number, number]> = [[convLimit, msgLimit], [20, Math.min(msgLimit, 10)], [10, 5]]
  let lastErr: any
  for (const [c, m] of sizes) {
    try {
      return await fetchConvPages(pageId, pageToken, convFields(m), c, maxPages) as FBConversationWithMessages[]
    } catch (e: any) {
      lastErr = e
      if (!isTooMuchData(e)) throw e
    }
  }
  throw lastErr
}

/**
 * ดึงโปรไฟล์ลูกค้าหลายคนในครั้งเดียว (Graph batch by ?ids=) — เลี่ยง N+1
 * คืน Map<psid, {name, profile_pic}> (เฉพาะที่ดึงได้)
 */
export async function getUserProfilesBatch(
  psids: string[],
  pageToken: string,
): Promise<Map<string, { name?: string; profile_pic?: string }>> {
  const out = new Map<string, { name?: string; profile_pic?: string }>()
  const unique = Array.from(new Set(psids.filter(Boolean)))
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50)
    try {
      const qs = new URLSearchParams({
        ids: chunk.join(','),
        fields: 'name,first_name,last_name,profile_pic',
        access_token: pageToken,
      })
      const res = await fetch(`${FB_API}/?${qs.toString()}`, { signal: AbortSignal.timeout(10000) })
      const data: any = await res.json()
      if (data.error) continue
      for (const psid of chunk) {
        const d = data[psid]
        if (d && !d.error) {
          out.set(psid, {
            name: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || undefined,
            profile_pic: d.profile_pic,
          })
        }
      }
    } catch {}
  }
  return out
}

/**
 * ดึงโพสต์ล่าสุดของเพจ (ข้อความ) — ใช้เป็นบริบทให้ AI ตอบเรื่องสินค้า/ราคา/โปรโมชั่น
 * ลองหลาย edge เผื่อ permission ต่างกัน
 */
export async function listRecentPagePosts(
  fbPageId: string,
  pageToken: string,
  limit = 12,
): Promise<Array<{ message: string; created_time: string }>> {
  const fields = 'message,created_time'
  for (const edge of ['published_posts', 'posts', 'feed']) {
    try {
      // ลองได้ถึง 3 edge — ถ้าไม่จำกัดเวลา edge เดียวที่ค้างก็กิน AI ทั้งรอบ
      const res = await fetch(`${FB_API}/${fbPageId}/${edge}?fields=${fields}&limit=${limit}&access_token=${pageToken}`, { signal: AbortSignal.timeout(8000) })
      const data: any = await res.json()
      if (data.error) continue
      return (data.data || [])
        .filter((p: any) => p.message && String(p.message).trim())
        .map((p: any) => ({ message: String(p.message), created_time: p.created_time }))
    } catch {
      continue
    }
  }
  return []
}

/** ดึงข้อมูล user (ลูกค้า) จาก PSID — ได้ name + profile pic */
/** ชื่อลูกค้าจากรายชื่อผู้ร่วมแชท — ใช้แทนเมื่อ User Profile API ใช้ไม่ได้ (แอปยังไม่ได้สิทธิ์) */
export async function getCustomerNameFromConversation(
  pageFbId: string,
  psid: string,
  pageToken: string,
): Promise<string | null> {
  try {
    const qs = new URLSearchParams({ platform: 'messenger', user_id: psid, fields: 'participants', access_token: pageToken })
    const res = await fetch(`${FB_API}/${pageFbId}/conversations?${qs.toString()}`, { signal: AbortSignal.timeout(5000) })
    const data: any = await res.json()
    if (data.error) return null
    for (const c of data.data || []) {
      const p = (c.participants?.data || []).find((x: any) => x.id === psid)
      if (p?.name) return String(p.name)
    }
    return null
  } catch {
    return null
  }
}

export async function getUserProfile(
  psid: string,
  pageToken: string
): Promise<{ id: string; name?: string; profile_pic?: string } | null> {
  try {
    const res = await fetch(
      `${FB_API}/${psid}?fields=name,first_name,last_name,profile_pic&access_token=${pageToken}`,
      { signal: AbortSignal.timeout(8000) },  // ชื่อ/รูปลูกค้าเป็นของเสริม ห้ามค้างจน webhook หมดเวลา
    )
    const data = await res.json()
    if (data.error) return null
    return {
      id: psid,
      name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'ลูกค้า',
      profile_pic: data.profile_pic,
    }
  } catch {
    return null
  }
}

// ============================================
// Webhook subscription management
// ============================================

/** Subscribe Page to webhook events (messages, messaging_postbacks) */
export async function subscribePageToWebhook(
  pageId: string,
  pageToken: string,
  fields: string[] = ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads']
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${FB_API}/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: fields.join(','),
        access_token: pageToken,
      }),
      signal: AbortSignal.timeout(8000),  // ค้างที่นี่ไม่ได้ — ซิงก์ทั้งรอบมีเวลาแค่ 60 วิ
    })
    const data = await res.json()
    if (data.error) return { success: false, error: data.error.message }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/** Unsubscribe page (ใช้เวลา disconnect) */
export async function unsubscribePageFromWebhook(
  pageId: string,
  pageToken: string
): Promise<boolean> {
  try {
    const res = await fetch(`${FB_API}/${pageId}/subscribed_apps?access_token=${pageToken}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(8000),  // เท่ากับตอน subscribe — ปลดเพจค้างไม่ได้
    })
    const data = await res.json()
    return !!data.success
  } catch {
    return false
  }
}

// ============================================
// Webhook event types
// ============================================

export interface WebhookEntry {
  id: string                          // Page ID
  time: number
  messaging?: WebhookMessagingEvent[]
}

export interface WebhookMessagingEvent {
  sender: { id: string }              // PSID (ลูกค้า) หรือ Page ID
  recipient: { id: string }           // Page ID หรือ PSID
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{ type: string; title?: string; payload?: { url?: string; sticker_id?: number; title?: string } }>
    sticker_id?: number               // ปุ่มไลก์/สติกเกอร์ (มาคู่กับ attachment รูป)
    is_echo?: boolean                 // true = ข้อความที่เพจส่ง (echo back)
    app_id?: number
  }
  postback?: { title: string; payload: string }
  delivery?: { mids: string[]; watermark: number }
  read?: { watermark: number }
}
