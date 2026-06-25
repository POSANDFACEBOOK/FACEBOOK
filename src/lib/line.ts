// LINE Messaging API helpers
// docs: https://developers.line.biz/en/reference/messaging-api/
import crypto from 'crypto'

const LINE_API = 'https://api.line.me/v2/bot'

/** verify ลายเซ็น webhook (X-Line-Signature = base64(HMAC-SHA256(channelSecret, rawBody))) */
export function verifyLineSignature(channelSecret: string, rawBody: string, signature: string | null): boolean {
  if (!signature || !channelSecret) return false
  try {
    const hash = crypto.createHmac('SHA256', channelSecret).update(rawBody).digest('base64')
    // timing-safe compare
    const a = Buffer.from(hash)
    const b = Buffer.from(signature)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export interface LineBotInfo {
  userId: string
  basicId?: string
  displayName?: string
  pictureUrl?: string
}

/** ดึงข้อมูล bot (OA) จาก channel access token — ใช้ตอนเชื่อมต่อ */
export async function getLineBotInfo(accessToken: string): Promise<{ ok: true; info: LineBotInfo } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${LINE_API}/info`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const data: any = await res.json()
    if (!res.ok || !data.userId) {
      return { ok: false, error: data?.message || `LINE info error ${res.status}` }
    }
    return { ok: true, info: { userId: data.userId, basicId: data.basicId, displayName: data.displayName, pictureUrl: data.pictureUrl } }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

/** ดึงโปรไฟล์ลูกค้า LINE (displayName + picture) */
export async function getLineUserProfile(accessToken: string, userId: string): Promise<{ name?: string; picture?: string } | null> {
  try {
    const res = await fetch(`${LINE_API}/profile/${userId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null  // fail-fast บน HTTP error (401/500) ไม่ parse error body
    const data: any = await res.json()
    if (!data.displayName) return null
    return { name: data.displayName, picture: data.pictureUrl }
  } catch {
    return null
  }
}

/** ส่งข้อความหาลูกค้า (push) — นับโควต้า push ของ LINE */
export async function pushLineMessage(
  accessToken: string,
  to: string,
  text: string,
): Promise<{ success: boolean; error?: string; errorCode?: number }> {
  try {
    const res = await fetch(`${LINE_API}/message/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 5000) }] }),
    })
    if (res.status === 200) return { success: true }
    const data: any = await res.json().catch(() => ({}))
    return { success: false, error: data?.message || `LINE push error ${res.status}`, errorCode: res.status }
  } catch (e: any) {
    return { success: false, error: e?.message || 'network error' }
  }
}

/** ส่งรูปหาลูกค้า LINE (push) — ใช้ public URL (https) */
export async function pushLineImage(
  accessToken: string,
  to: string,
  imageUrl: string,
): Promise<{ success: boolean; error?: string; errorCode?: number }> {
  try {
    const res = await fetch(`${LINE_API}/message/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        to,
        messages: [{ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl }],
      }),
    })
    if (res.status === 200) return { success: true }
    const data: any = await res.json().catch(() => ({}))
    return { success: false, error: data?.message || `LINE push error ${res.status}`, errorCode: res.status }
  } catch (e: any) {
    return { success: false, error: e?.message || 'network error' }
  }
}

/** เช็ค Webhook URL ที่ตั้งไว้ใน LINE Developers + เปิด "Use webhook" ไหม */
export async function getLineWebhookEndpoint(accessToken: string): Promise<{ endpoint?: string; active?: boolean; error?: string }> {
  try {
    const res = await fetch(`${LINE_API}/channel/webhook/endpoint`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const data: any = await res.json()
    if (!res.ok) return { error: data?.message || `error ${res.status}` }
    return { endpoint: data.endpoint, active: data.active }
  } catch (e: any) {
    return { error: e?.message || 'network error' }
  }
}

/** ยิง test webhook จริง — LINE ส่ง event ทดสอบไปยัง endpoint ที่ตั้งไว้ */
export async function testLineWebhook(accessToken: string): Promise<{ success?: boolean; statusCode?: number; reason?: string; detail?: string; error?: string }> {
  try {
    const res = await fetch(`${LINE_API}/channel/webhook/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data?.message || `error ${res.status}` }
    return { success: data.success, statusCode: data.statusCode, reason: data.reason, detail: data.detail }
  } catch (e: any) {
    return { error: e?.message || 'network error' }
  }
}

/** สรุป content ของข้อความ LINE เป็น text + attachments ที่เก็บใน DB */
export function describeLineMessage(msg: any): { text: string | null; attachments: any[] } {
  switch (msg?.type) {
    case 'text':
      return { text: msg.text || null, attachments: [] }
    case 'sticker':
      // sticker preview url (LINE CDN)
      return {
        text: null,
        attachments: [{ type: 'image', url: `https://stickershop.line-scdn.net/stickershop/v1/sticker/${msg.stickerId}/iPhone/sticker.png`, name: 'sticker' }],
      }
    case 'image':
      return { text: '[รูปภาพ]', attachments: [] }
    case 'video':
      return { text: '[วิดีโอ]', attachments: [] }
    case 'audio':
      return { text: '[เสียง]', attachments: [] }
    case 'file':
      return { text: `[ไฟล์] ${msg.fileName || ''}`.trim(), attachments: [] }
    case 'location':
      return { text: `[ตำแหน่ง] ${msg.title || msg.address || ''}`.trim(), attachments: [] }
    default:
      return { text: '[ข้อความ]', attachments: [] }
  }
}
