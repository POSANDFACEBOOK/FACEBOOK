// POST /api/inbox/ai-suggest
// Body: { conversationId: string, instruction?: string }
// Returns: { suggestions: string[], sentiment: string, category: string, summary: string }
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext } from '@/lib/team'
import { listRecentPagePosts } from '@/lib/messenger'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// cache โพสต์เพจ (ลด FB call ทุกครั้งที่กด AI) — TTL 15 นาที, อยู่ใน instance ที่ warm
const postsCache = new Map<string, { posts: Array<{ message: string; created_time: string }>; at: number }>()
const POSTS_TTL = 15 * 60 * 1000

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversationId, instruction } = await req.json()
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    const { data: conv } = await sb
      .from('conversations')
      .select('id, customer_name, page_id')
      .eq('id', conversationId)
      .single()
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!ctx.accessiblePageIds.has(conv.page_id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // ดึงข้อความล่าสุด 20 ข้อความ
    const { data: messages } = await sb
      .from('inbox_messages')
      .select('direction, message_text, sent_by, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20)

    const recent = (messages || []).reverse()

    // ยังไม่มีข้อความ → ไม่ต้องเรียก AI (กัน prompt ว่าง) คืนคำทักทายเริ่มต้น
    if (recent.length === 0) {
      return NextResponse.json({
        suggestions: ['สวัสดีค่ะ 😊 มีอะไรให้ช่วยดูแลไหมคะ', 'สวัสดีครับ ยินดีให้บริการครับ มีอะไรสอบถามได้เลยครับ'],
        category: null, sentiment: null, summary: null,
      })
    }

    // ดึง knowledge base + tone จาก settings (per-page; ไม่ filter ตาม user_id เพราะ agent ก็ใช้ของ owner)
    const { data: settings } = await sb
      .from('inbox_settings')
      .select('ai_tone, knowledge_base')
      .eq('page_id', conv.page_id)
      .single()

    const tone = settings?.ai_tone || 'friendly'
    const kb = settings?.knowledge_base || ''

    // ดึง page (name + token + fb id) สำหรับดึงโพสต์
    const { data: page } = await sb
      .from('connected_pages')
      .select('page_name, page_access_token, page_id')
      .eq('id', conv.page_id)
      .single()

    // ── ดึงโพสต์ล่าสุดของเพจ (ข้อมูลร้าน + โปรโมชั่นล่าสุด) — cache 15 นาที ──
    let posts: Array<{ message: string; created_time: string }> = []
    if (page?.page_access_token && page?.page_id) {
      const cached = postsCache.get(conv.page_id)
      if (cached && Date.now() - cached.at < POSTS_TTL) {
        posts = cached.posts
      } else {
        posts = await listRecentPagePosts(page.page_id, page.page_access_token, 12)
        postsCache.set(conv.page_id, { posts, at: Date.now() })
      }
    }
    const postsBlock = posts.length > 0
      ? posts.slice(0, 10).map(p => {
          const d = p.created_time ? new Date(p.created_time).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''
          return `• (${d}) ${p.message.replace(/\s+/g, ' ').slice(0, 350)}`
        }).join('\n')
      : '(ไม่มีข้อมูลโพสต์)'

    const transcript = recent
      .map(m => `${m.direction === 'inbound' ? `[ลูกค้า ${conv.customer_name}]` : `[เพจ]`}: ${m.message_text || '(ส่งรูป/ไฟล์)'}`)
      .join('\n')

    const toneGuide: Record<string, string> = {
      friendly: 'เป็นกันเอง อบอุ่น ใช้คำลงท้าย ค่ะ/ครับ มี emoji พอเหมาะ',
      professional: 'สุภาพ ทางการ กระชับ ตรงประเด็น ไม่ใช้ emoji',
      casual: 'สบายๆ เหมือนคุยกับเพื่อน ใช้คำง่ายๆ มี emoji ได้',
    }

    const prompt = `คุณคือ "แอดมินตอบแชท" ของเพจ Facebook "${page?.page_name || ''}" ตอบลูกค้าเหมือนคนจริง อบอุ่น เป็นธรรมชาติ ไม่ใช่บอท

# ข้อมูลร้าน/สินค้า/FAQ (ตั้งค่าไว้):
${kb || '(ยังไม่ได้ตั้งค่า)'}

# โพสต์ล่าสุดของเพจ (ข้อมูลจริง — ใช้ตอบเรื่องสินค้า ราคา โปรโมชั่นล่าสุด เมนู บริการ):
${postsBlock}

# บทสนทนาล่าสุดกับลูกค้า:
${transcript}

# โทนการตอบ: ${toneGuide[tone] || toneGuide.friendly}
${instruction ? `# คำสั่งพิเศษจากแอดมิน: ${instruction}` : ''}

# กติกาสำคัญ:
- ตอบให้ตรงคำถาม/ข้อความล่าสุดของลูกค้า เป็นภาษาไทยที่ฟังเป็นธรรมชาติเหมือนแอดมินคนจริง ไม่ห้วน ไม่เป็นทางการเกินจนแข็ง
- ใช้ "ข้อมูลร้าน" + "โพสต์ล่าสุด" เป็นความจริงในการตอบ โดยเฉพาะเรื่อง ราคา / โปรโมชั่น / รายละเอียดสินค้า / เวลาเปิด-ปิด
- ถ้าลูกค้าถามโปรล่าสุดหรือราคา ให้ดึงจากโพสต์ล่าสุดมาตอบให้ตรง
- ❗ ห้ามแต่งราคา/โปรโมชั่น/ข้อมูลที่ไม่มีในข้อมูลที่ให้ — ถ้าไม่มีข้อมูล ให้ตอบสุภาพว่าจะเช็คให้ / ขอข้อมูลเพิ่มเติม
- กระชับแต่ครบถ้วน ชวนปิดการขายอย่างนุ่มนวลเมื่อเหมาะสม

# งาน:
1. เสนอข้อความตอบ 3 แบบ: สั้น (1-2 ประโยค) / กลาง / ละเอียด — ทุกแบบพร้อมส่งได้ทันที
2. category: 'inquiry'|'price'|'order'|'complaint'|'support'|'spam'|'other'
3. sentiment: 'positive'|'neutral'|'negative'
4. summary: สรุปบทสนทนาสั้นๆ 1 ประโยค

ตอบเป็น JSON เท่านั้น:
{"suggestions":["สั้น","กลาง","ละเอียด"],"category":"...","sentiment":"...","summary":"..."}`

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = resp.content[0].type === 'text' ? resp.content[0].text : ''

    // Parse JSON safely
    let parsed: any = {}
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {}

    const suggestions: string[] = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : []
    const category = typeof parsed.category === 'string' ? parsed.category : null
    const sentiment = typeof parsed.sentiment === 'string' ? parsed.sentiment : null
    const summary = typeof parsed.summary === 'string' ? parsed.summary : null

    // อัปเดต conversation metadata
    if (category || sentiment || summary) {
      const update: any = {}
      if (category) update.ai_category = category
      if (sentiment) update.ai_sentiment = sentiment
      if (summary) update.ai_summary = summary
      await sb.from('conversations').update(update).eq('id', conversationId)
    }

    return NextResponse.json({ suggestions, category, sentiment, summary })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
