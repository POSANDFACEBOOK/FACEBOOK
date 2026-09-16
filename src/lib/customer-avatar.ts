// รูปโปรไฟล์ลูกค้า (Facebook)
//
// ปัญหา: URL รูปโปรไฟล์ที่ Facebook ให้มาตอนดึงโปรไฟล์ (profile_pic) เป็นลิงก์ชั่วคราว หมดอายุใน
// ไม่กี่วัน → แชทเก่าทุกแชทกลายเป็นรูปแตก จึงดึงรูปมาเก็บใน Storage ของเราเอง (URL ถาวร)
// แล้วบันทึกทับ conversations.customer_picture
//
// รูปแบบค่าใน customer_picture:
// - URL ของ Storage เรา ชื่อไฟล์ <psid>-<YYYYMMDD>-<สุ่ม>.jpg  → ใช้ได้เลย (รีเฟรชใหม่เมื่อเก่ากว่า 30 วัน)
// - "none:<YYYYMMDD>"                                         → ดึงรูปไม่ได้ (ไม่มีรูป / แอปยังไม่ได้สิทธิ์) ลองใหม่วันละครั้ง
// - อย่างอื่น (URL ชั่วคราวของ FB / LINE / ว่าง)                → ต้องดึงใหม่
//
// ติดต่อ Facebook ไม่ได้ชั่วคราว (token หมดอายุ, rate limit, FB ล่ม) → ไม่แตะ DB ให้รอบหน้าลองใหม่
// (ห้ามจำว่า "ไม่มีรูป" ไม่งั้นทุกแชทกลายเป็นตัวอักษรย่อ 7 วันทั้งที่ลูกค้ามีรูป)
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rehostUrlToStorage } from './media'

const FB_API = 'https://graph.facebook.com/v19.0'
const BUCKET = 'chat-uploads'
const BUCKET_PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`
const HOSTED_MARK = `${BUCKET_PUBLIC_PREFIX}avatars/`
const REFRESH_AFTER_DAYS = 30
// Facebook ตอบ #100/33 ทั้งกรณี "ไม่มีโปรไฟล์" และ "แอปยังไม่ได้สิทธิ์ Business Asset User Profile Access"
// (แยกกันไม่ได้) → ลองใหม่ทุกวัน พอได้สิทธิ์แล้วรูปจะขึ้นเองภายใน 1 วัน
const RETRY_NONE_AFTER_DAYS = 1
const FETCH_TIMEOUT_MS = 5000

function today(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function daysSince(yyyymmdd: string): number {
  const y = Number(yyyymmdd.slice(0, 4)), m = Number(yyyymmdd.slice(4, 6)) - 1, d = Number(yyyymmdd.slice(6, 8))
  const t = Date.UTC(y, m, d)
  if (Number.isNaN(t)) return Infinity
  return (Date.now() - t) / 86400000
}

/** เป็น URL รูปที่เก็บใน Storage ของเราแล้ว */
export function isHostedAvatar(url: string | null | undefined): boolean {
  return !!url && url.includes(HOSTED_MARK)
}

/** ค่าที่หมายถึง "ไม่มีรูป" */
export function isNoAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith('none:')
}

/** เป็น URL รูปจาก CDN ของ Facebook (ใช้ redirect ไปได้อย่างปลอดภัย) */
export function isFacebookCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname)
  } catch {
    return false
  }
}

/** ยังใช้ค่าปัจจุบันได้ ไม่ต้องดึงจาก Facebook ใหม่ */
export function avatarIsFresh(url: string | null | undefined): boolean {
  if (!url) return false
  if (isNoAvatar(url)) return daysSince(url.slice(5)) < RETRY_NONE_AFTER_DAYS
  if (!isHostedAvatar(url)) return false
  const m = url.match(/-(\d{8})-[a-z0-9]+\.\w+$/)
  return !!m && daysSince(m[1]) < REFRESH_AFTER_DAYS
}

/** path ใน bucket จาก public URL ของเรา (null = ไม่ใช่ URL ของเรา) */
function hostedObjectPath(url: string): string | null {
  const i = url.indexOf(BUCKET_PUBLIC_PREFIX)
  if (i < 0) return null
  return url.slice(i + BUCKET_PUBLIC_PREFIX.length).split('?')[0] || null
}

/** ดึงรูปจาก URL ชั่วคราวของ FB มาเก็บใน Storage → คืน URL ถาวร (null = ดึงไม่ได้) */
export async function hostProfilePic(
  sb: SupabaseClient,
  pageRowId: string,
  psid: string,
  fbPicUrl: string | null | undefined,
): Promise<string | null> {
  if (!fbPicUrl) return null
  const name = `${psid}-${today()}-${crypto.randomBytes(6).toString('hex')}`
  // รูปโปรไฟล์ไม่ควรเกิน 2MB — กันดึงไฟล์แปลกๆ · จำกัดเวลา ไม่ให้ webhook ค้าง
  return rehostUrlToStorage(sb, fbPicUrl, {}, `avatars/${pageRowId}`, { name, maxBytes: 2 * 1024 * 1024, timeoutMs: FETCH_TIMEOUT_MS })
}

type PicLookup = { ok: true; url: string | null } | { ok: false }

/** ขอ URL รูปโปรไฟล์ล่าสุดจาก Facebook — ok:false = ติดต่อ FB ไม่ได้/token มีปัญหา (ห้ามจำว่าไม่มีรูป) */
async function fetchFbProfilePic(psid: string, pageToken: string): Promise<PicLookup> {
  try {
    const r = await fetch(
      `${FB_API}/${encodeURIComponent(psid)}?fields=profile_pic&access_token=${encodeURIComponent(pageToken)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' },
    )
    const d: any = await r.json()
    if (d?.error) {
      // #100 = ไม่มีโปรไฟล์ให้ดู (ลูกค้าลบบัญชี/บล็อกเพจ) → ไม่มีรูปจริง
      // อย่างอื่น (#190 token หมดอายุ, #4/#17/#32 rate limit, 5xx) → ชั่วคราว
      const code = Number(d.error.code)
      return code === 100 || code === 33 ? { ok: true, url: null } : { ok: false }
    }
    if (!r.ok) return { ok: false }
    return { ok: true, url: typeof d?.profile_pic === 'string' && d.profile_pic ? d.profile_pic : null }
  } catch {
    return { ok: false }
  }
}

/**
 * ทำให้ conversations.customer_picture เป็น URL ถาวร (ดึงใหม่เมื่อยังไม่มี/หมดอายุ/เก่าเกิน)
 * คืนค่าที่ควรใช้แสดง: URL ถาวรในระบบ, หรือ URL ชั่วคราวของ FB (ถ้าเก็บลง Storage ไม่ได้), หรือ null ถ้าไม่มีรูป
 */
export async function ensureCustomerPicture(
  sb: SupabaseClient,
  conv: { id: string; fb_psid: string; page_id: string; customer_picture: string | null },
  pageToken: string,
): Promise<string | null> {
  const current = conv.customer_picture
  if (avatarIsFresh(current)) return isNoAvatar(current) ? null : current!

  const lookup = await fetchFbProfilePic(conv.fb_psid, pageToken)
  // ติดต่อ FB ไม่ได้ชั่วคราว → ไม่แตะ DB, แสดงของเดิมถ้ายังเป็นรูปในระบบ
  if (!lookup.ok) return isHostedAvatar(current) ? current! : null

  const fbUrl = lookup.url
  const hosted = fbUrl ? await hostProfilePic(sb, conv.page_id, conv.fb_psid, fbUrl) : null

  // ลำดับที่เลือกเก็บ: รูปในระบบใหม่ → (เก็บไม่ได้) รูปในระบบเดิม → ลิงก์ FB ที่เพิ่งได้ (ใช้ได้หลายวัน รอบหน้าลองเก็บใหม่) → ไม่มีรูป
  const next = hosted || (isHostedAvatar(current) ? current! : (fbUrl && isFacebookCdnUrl(fbUrl) ? fbUrl : `none:${today()}`))
  if (next !== current) {
    const { error } = await sb.from('conversations').update({ customer_picture: next }).eq('id', conv.id)
    // ชี้ไปรูปใหม่แล้ว → ลบไฟล์เก่าใน Storage (กันไฟล์ค้างสะสมทุกรอบรีเฟรช)
    if (!error && hosted && isHostedAvatar(current)) {
      const oldPath = hostedObjectPath(current!)
      if (oldPath) { try { await sb.storage.from(BUCKET).remove([oldPath]) } catch {} }
    }
  }
  return isNoAvatar(next) ? null : next
}
