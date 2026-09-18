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
}

/** ส่งข้อความ text ไปหาลูกค้า — ต้องอยู่ใน 24-hour messaging window */
export async function sendTextMessage(
  pageToken: string,
  recipientPsid: string,
  text: string,
  messagingType: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG' = 'RESPONSE',
  tag?: string,  // ต้องส่งคู่กับ messagingType='MESSAGE_TAG' เช่น HUMAN_AGENT
): Promise<SendMessageResult & { errorCode?: number }> {
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
    })
    const data = await res.json()
    if (data.error) {
      return { success: false, error: data.error.message, errorCode: data.error.code }
    }
    return {
      success: true,
      message_id: data.message_id,
      recipient_id: data.recipient_id,
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' }
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
): Promise<SendMessageResult & { errorCode?: number }> {
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
    })
    const data = await res.json()
    if (data.error) return { success: false, error: data.error.message, errorCode: data.error.code }
    return { success: true, message_id: data.message_id }
  } catch (e: any) {
    return { success: false, error: e.message }
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

/** ดึง conversations ของ Page (paginated) */
export async function listConversations(
  pageId: string,
  pageToken: string,
  limit = 50,
  maxPages = 5,  // ดึงสูงสุด 5 หน้า × 50 = 250 conversations ต่อ FB page
): Promise<FBConversation[]> {
  const fields = 'id,updated_time,unread_count,snippet,participants'
  const all: FBConversation[] = []
  let url: string | undefined =
    `${FB_API}/${pageId}/conversations?fields=${fields}&limit=${limit}&access_token=${pageToken}`
  let pages = 0
  while (url && pages < maxPages) {
    const res: Response = await fetch(url)
    const data: any = await res.json()
    if (data.error) throw new Error(data.error.message)
    all.push(...((data.data || []) as FBConversation[]))
    url = data.paging?.next
    pages++
  }
  return all
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
    const res: Response = await fetch(url)
    const data: any = await res.json()
    if (data.error) throw new Error(data.error.message)
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

/** เวลาอัปเดตล่าสุดของหลายแชทในครั้งเดียว (Graph ?ids= ครั้งละ 50) → Map<conversationId, updated_time> */
export async function getConversationUpdateTimes(
  conversationIds: string[],
  pageToken: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = Array.from(new Set(conversationIds.filter(Boolean)))
  for (let i = 0; i < ids.length; i += 50) {
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
    await Promise.all(chunk.map(async id => {
      const d = await getJson(`${FB_API}/${encodeURIComponent(id)}?${new URLSearchParams({ fields: 'updated_time', access_token: pageToken })}`)
      if (typeof d?.updated_time === 'string') out.set(id, d.updated_time)
      else bad.push(id)
    }))
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
): Promise<FBConversationWithMessages[]> {
  const all: FBConversationWithMessages[] = []
  const ids = Array.from(new Set(conversationIds.filter(Boolean)))
  // ครั้งละ 10 แชท (แชทละ msgLimit ข้อความ) — ชุดใหญ่เกินไป Facebook ตอบว่าข้อมูลเยอะเกิน
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    const data = await getJson(`${FB_API}/?${new URLSearchParams({ ids: chunk.join(','), fields: convFields(msgLimit), access_token: pageToken })}`)
    if (data && !data.error) {
      for (const v of Object.values(data)) {
        if (v && (v as any).id) all.push(v as FBConversationWithMessages)
      }
      continue
    }
    // ชุดนี้ล้ม → ดึงทีละแชท เก็บเฉพาะที่ได้
    await Promise.all(chunk.map(async id => {
      const d = await getJson(`${FB_API}/${encodeURIComponent(id)}?${new URLSearchParams({ fields: convFields(msgLimit), access_token: pageToken })}`)
      if (d && !d.error && d.id) all.push(d as FBConversationWithMessages)
    }))
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
  const fields = convFields(msgLimit)
  // encode field expansion ({} () ,) อย่างถูกต้องข้าม environment
  const qs = new URLSearchParams({ fields, limit: String(convLimit), access_token: pageToken })
  const all: FBConversationWithMessages[] = []
  let url: string | undefined = `${FB_API}/${pageId}/conversations?${qs.toString()}`
  let pages = 0
  while (url && pages < maxPages) {
    const res: Response = await fetch(url)
    const data: any = await res.json()
    if (data.error) throw new Error(data.error.message)
    all.push(...((data.data || []) as FBConversationWithMessages[]))
    url = data.paging?.next
    pages++
  }
  return all
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
      const res = await fetch(`${FB_API}/?${qs.toString()}`)
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
      const res = await fetch(`${FB_API}/${fbPageId}/${edge}?fields=${fields}&limit=${limit}&access_token=${pageToken}`)
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
      `${FB_API}/${psid}?fields=name,first_name,last_name,profile_pic&access_token=${pageToken}`
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
