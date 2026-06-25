// ดึงรูป/ไฟล์จาก FB/LINE (URL ชั่วคราว) → เก็บลง Supabase Storage (URL ถาวร public)
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'chat-uploads'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('gif')) return 'gif'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('mp4')) return 'mp4'
  return 'jpg'
}

/**
 * ดาวน์โหลดจาก fetchUrl แล้วอัปโหลดเข้า storage → คืน public URL
 * คืน null ถ้าล้มเหลว (เช่น URL หมดอายุ, bucket ไม่มี, ไฟล์ใหญ่เกิน) → caller fallback ได้
 */
export async function rehostUrlToStorage(
  sb: SupabaseClient,
  fetchUrl: string,
  headers: Record<string, string>,
  prefix: string,
): Promise<string | null> {
  try {
    const res = await fetch(fetchUrl, { headers })
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    if (!ct.startsWith('image/') && !ct.startsWith('video/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_BYTES) return null
    const path = `${prefix}/${crypto.randomUUID()}.${extFromContentType(ct)}`
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: false })
    if (error) {
      console.warn('[media] storage upload failed:', error.message)
      return null
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
    return data?.publicUrl || null
  } catch (e: any) {
    console.warn('[media] rehost failed:', e?.message)
    return null
  }
}
