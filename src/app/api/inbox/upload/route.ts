// POST /api/inbox/upload — อัปโหลดรูปที่แอดมินจะส่งในแชท
// multipart/form-data: file (image), conversationId
// → อัปขึ้น Supabase Storage (bucket public 'chat-uploads') → คืน { url }
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BYTES = 5 * 1024 * 1024
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
}

// ตรวจชนิดไฟล์จาก magic bytes จริง (ไม่เชื่อ file.type ที่ browser ส่งมา — ปลอมได้)
function sniffImageMime(b: Buffer): string | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    const conversationId = String(form.get('conversationId') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
    }
    if (!conversationId) {
      return NextResponse.json({ error: 'ไม่พบ conversationId' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 5 MB' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // ตรวจสิทธิ์: ต้องเข้าถึง conversation นี้ได้
    const { data: conv } = await sb
      .from('conversations')
      .select('id, page_id')
      .eq('id', conversationId)
      .single()
    if (!conv || !ctx.accessiblePageIds.has(conv.page_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ตรวจชนิดไฟล์จากเนื้อไฟล์จริง (กันปลอม content-type / อัปไฟล์อันตราย)
    const buffer = Buffer.from(await file.arrayBuffer())
    const mime = sniffImageMime(buffer)
    if (!mime) {
      return NextResponse.json({ error: 'ไฟล์ไม่ใช่รูปภาพที่รองรับ (jpg, png, gif, webp)' }, { status: 400 })
    }
    const ext = EXT[mime]
    // path ใช้ค่าจาก DB (conv.page_id, conv.id) ไม่ใช่ค่าดิบจาก client
    const path = `${conv.page_id}/${conv.id}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await sb.storage
      .from('chat-uploads')
      .upload(path, buffer, { contentType: mime, upsert: false, cacheControl: '31536000' })
    if (upErr) {
      return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ: ' + upErr.message }, { status: 500 })
    }

    const { data: pub } = sb.storage.from('chat-uploads').getPublicUrl(path)
    return NextResponse.json({ url: pub.publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
