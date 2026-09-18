// ข้อความระบบของ Facebook (ไม่ใช่ข้อความที่ลูกค้าหรือแอดมินพิมพ์) → ไม่แสดงในกล่องข้อความ
// และไม่นับเป็น "ข้อความล่าสุด" ของแชท (ไม่งั้นแชทที่ลูกค้าเพิ่งทักจะดูเหมือนตอบแล้ว)
// เช่น ป้ายอัตโนมัติของ Business Suite, "Messenger automatically created a transfer request",
// "คุณไม่ได้รับสายจาก ...", "<ชื่อ> ตอบกลับโฆษณา", การ์ดของ Facebook ที่ดึงเนื้อหาไม่ได้ฝั่งเพจ
//
// ตรวจ 2 ทาง:
// - ป้าย admin_text จาก Graph (sync เท่านั้น) → บันทึก sent_by = 'fb_system' (Facebook ยืนยันเอง)
// - รูปแบบข้อความด้านล่าง → ใช้ตอนอ่านเท่านั้น ไม่บันทึกลง DB (แก้กฎทีหลังแล้วข้อความกลับมาแสดงได้)
// ข้อความที่ลูกค้าเห็นจริง (เพจตอบอัตโนมัติ "ขออภัยที่ไม่ได้รับสายของคุณ...") และแจ้งโอนเงิน
// ("<ชื่อ> ส่งการชำระเงินจำนวน ฿...") แสดงตามปกติเสมอ แม้ Facebook จะติดป้าย admin_text — แอดมินต้องรู้
// ห้ามใช้ regex lookbehind (iOS Safari เก่าจอขาว) — ที่นี่ใช้แค่ startsWith/endsWith

export const FB_SYSTEM_SENT_BY = 'fb_system'

type Dir = 'inbound' | 'outbound'
// name = ส่วนระหว่าง start กับ end คือชื่อลูกค้า → ต้องเป็นชื่อจริงๆ (กันข้อความที่ลูกค้าพิมพ์ขึ้นต้นเหมือนกัน)
type Rule = { start?: string; end?: string; has?: string; maxLen?: number; dir?: Dir; name?: boolean }

const RULES: Rule[] = [
  // ฝั่งเพจ: ระบบของ Facebook/Business Suite ทำเอง
  { dir: 'outbound', start: 'Messenger automatically created a transfer request' },
  { dir: 'outbound', start: 'เพิ่มป้ายอัตโนมัติแล้ว:' },
  { dir: 'outbound', start: 'Label automatically added:' },
  { dir: 'outbound', start: 'This message was sent automatically in response to a missed call' },
  { dir: 'outbound', start: 'ข้อความนี้ถูกส่งโดยอัตโนมัติเพื่อตอบกลับสายที่ไม่ได้รับ' },
  { dir: 'outbound', end: ' ตอบกลับโฆษณา', maxLen: 120 },
  { dir: 'outbound', end: ' replied to an ad', maxLen: 120 },
  { dir: 'outbound', has: ' replied to a post. View post(' },
  // ฝั่งลูกค้า: แจ้งเตือนการโทร/สลิปของ Messenger
  { dir: 'inbound', start: 'คุณไม่ได้รับสายจาก ', name: true },
  { dir: 'inbound', start: 'คุณสามารถโทรหา ', end: ' ในช่วง 7 วันข้างหน้า', name: true },
  { dir: 'inbound', start: 'คุณสามารถโทรกลับหา ', end: ' ได้ในอีก 7 วันนับจากนี้', name: true },
  { dir: 'inbound', start: 'You missed a call from ', name: true },
  { dir: 'inbound', start: 'You can call ', end: ' within the next 7 days.', name: true },
  { dir: 'inbound', start: 'ผู้ใช้โทรหาคุณนอกเวลารับสาย' },
  { dir: 'inbound', start: 'รีเซ็ตช่วงเวลาโทรเป็น' },
  { dir: 'inbound', start: 'จัดการการโทร(https://www.facebook.com/help/' },
  { dir: 'inbound', start: 'เชื่อมต่อบัญชีธนาคารของคุณเพื่อตรวจสอบความถูกต้องของสลิป' },
  // วิดีโอคอลจบ (ใครโทรก็ได้ → ไม่จำกัดฝั่ง แต่ต้องเป็นข้อความสั้นตรงตัว)
  { start: 'วิดีโอคอลสิ้นสุดลงแล้ว', maxLen: 25 },
  { start: 'The video call ended', maxLen: 25 },
]

// แสดงเสมอ (ข้อมูลที่แอดมินต้องรู้ / ข้อความที่ลูกค้าได้รับจริง)
const KEEP: Rule[] = [
  { dir: 'inbound', has: ' ส่งการชำระเงินจำนวน ฿', maxLen: 120 },
  { dir: 'inbound', end: ' ส่งการชำระเงิน', maxLen: 80 },
  { dir: 'inbound', has: ' sent a payment', maxLen: 120 },
  { dir: 'outbound', start: 'ขออภัยที่ไม่ได้รับสายของคุณ' },
  { dir: 'outbound', start: 'Sorry that we missed your call' },
]

const normName = (s: string) => s.toLowerCase().replace(/\./g, ' ').split(/\s+/).filter(Boolean)

// ส่วนที่ควรเป็นชื่อลูกค้า: ไม่มีตัวเลข ไม่ยาว และ (ถ้ารู้ชื่อลูกค้า) ทุกคำต้องอยู่ในชื่อลูกค้า
function looksLikeName(part: string, customerName?: string | null): boolean {
  const p = part.trim()
  if (!p || p.length > 60 || /[0-9๐-๙,?!]/.test(p)) return false
  const cn = (customerName || '').trim()
  if (!cn || cn === 'ลูกค้า') return true
  const words = normName(cn)
  return normName(p).every(w => words.indexOf(w) >= 0)
}

function matches(r: Rule, t: string, dir?: string | null, customerName?: string | null): boolean {
  if (r.dir && dir && r.dir !== dir) return false
  if (r.maxLen && t.length > r.maxLen) return false
  if (r.start && !t.startsWith(r.start)) return false
  if (r.end && !t.endsWith(r.end)) return false
  if (r.has && t.indexOf(r.has) < 0) return false
  if (r.name) {
    const from = (r.start || '').length
    const to = t.length - (r.end || '').length
    if (to <= from || !looksLikeName(t.slice(from, to), customerName)) return false
  }
  return true
}

function isKept(text: string | null | undefined, dir?: string | null): boolean {
  const t = (text || '').trim()
  return !!t && KEEP.some(r => matches(r, t, dir))
}

/**
 * ข้อความนี้เป็นข้อความระบบของ Facebook ไหม (ดูจากตัวหนังสือ)
 * direction / customerName ถ้ารู้ให้ส่งมา → แม่นขึ้น (กันข้อความจริงของลูกค้า/แอดมินถูกซ่อน)
 */
export function isFbSystemText(text: string | null | undefined, direction?: string | null, customerName?: string | null): boolean {
  const t = (text || '').trim()
  if (!t || isKept(t, direction)) return false
  return RULES.some(r => matches(r, t, direction, customerName))
}

type GraphMsg = { message?: string | null; from?: { id?: string } | null; tags?: { data?: Array<{ name?: string }> } | null }

const graphDir = (m: GraphMsg, pageId: string): Dir => (m.from?.id === pageId ? 'outbound' : 'inbound')

/** Facebook ติดป้าย admin_text (= ข้อความระบบ) ไว้เอง — ใช้ตัวนี้ตัดสินก่อนบันทึก sent_by = 'fb_system' */
export function isFbAdminTagged(m: GraphMsg, pageId: string): boolean {
  return (m.tags?.data || []).some(t => t?.name === 'admin_text') && !isKept(m.message, graphDir(m, pageId))
}

/** ข้อความจาก Graph API (sync) เป็นข้อความระบบไหม — ป้าย admin_text หรือเข้ารูปแบบข้อความระบบ */
export function isFbSystemGraphMessage(m: GraphMsg, pageId: string, customerName?: string | null): boolean {
  if (isFbAdminTagged(m, pageId)) return true
  return isFbSystemText(m.message, graphDir(m, pageId), customerName)
}

type Row = { sent_by?: string | null; message_text?: string | null; direction?: string | null; attachments?: any }

/** แถวใน inbox_messages ที่เป็นข้อความระบบ (ไม่นับเป็นการคุยกัน) */
export function isFbSystemRow(m: Row, customerName?: string | null): boolean {
  if (isKept(m.message_text, m.direction)) return false
  return m.sent_by === FB_SYSTEM_SENT_BY || isFbSystemText(m.message_text, m.direction, customerName)
}

/**
 * ซ่อนจากหน้าแชทไหม — ข้อความระบบ + การ์ดฝั่งเพจที่ Facebook ไม่ส่งเนื้อหามา (เช่นการ์ดขอโอนเงิน)
 * การ์ดฝั่งลูกค้าที่ดึงไม่ได้ (อีโมจิ/สติกเกอร์) ยังแสดง — แอดมินต้องรู้ว่าลูกค้าส่งอะไรมา
 * (การ์ดฝั่งเพจยังนับว่า "เพจตอบแล้ว" — มาต่อจากข้อความของแอดมิน เช่นส่งเลขบัญชี)
 */
export function isHiddenInboxMessage(m: Row, customerName?: string | null): boolean {
  if (isFbSystemRow(m, customerName)) return true
  if (m.direction === 'outbound' && !m.message_text) {
    const atts = Array.isArray(m.attachments) ? m.attachments : []
    if (atts.length > 0 && atts.every((a: any) => a?.type === 'unavailable')) return true
  }
  return false
}

/** รูปแบบ ilike สำหรับหาแชทที่ last_message อาจเป็นข้อความระบบ (ใช้กับ .or() ของ Supabase — ต้องเช็คซ้ำด้วย isFbSystemText) */
export function fbSystemLastMessageFilter(column = 'last_message'): string {
  const pats = RULES.map(r => {
    if (r.start) return `${r.start}%${r.has ? `${r.has}%` : ''}${r.end || ''}`
    if (r.end) return `%${r.end}`
    return `%${r.has}%`
  })
  // ครอบด้วย "..." เพราะบางรูปแบบมีวงเล็บ/จุด/โคลอน
  return pats.map(p => `${column}.ilike."${p.replace(/"/g, '')}"`).join(',')
}
