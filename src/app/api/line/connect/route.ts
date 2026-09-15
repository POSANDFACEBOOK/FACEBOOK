// POST /api/line/connect — owner เชื่อม LINE OA
// Body: { accessToken, channelSecret }  (จาก LINE Developers Console → Messaging API)
// DELETE /api/line/connect?id=<connected_pages.id> — ยกเลิกการเชื่อม
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner } from '@/lib/team'
import { getLineBotInfo } from '@/lib/line'
import { LINE_ENABLED } from '@/lib/features'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // ช่องทาง LINE ซ่อนอยู่ (lib/features.ts)
    if (!LINE_ENABLED) return NextResponse.json({ error: 'ช่องทาง LINE ปิดใช้งานชั่วคราว', disabled: true }, { status: 403 })
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // เจ้าของเพจเชื่อม LINE ได้ + เจ้าของร้านที่ล็อกอินด้วย Facebook แต่ยังไม่มีช่องทางแรก
    // ลูกทีม (มีสิทธิ์ในเพจคนอื่นแต่ไม่ได้เป็นเจ้าของ) เชื่อมไม่ได้
    const g = assertOwner(ctx)
    const firstChannelOwner = ctx.authMethod === 'facebook' && ctx.memberships.length === 0
    if (!g.ok && !firstChannelOwner) return NextResponse.json({ error: g.error }, { status: g.status })

    const { accessToken, channelSecret } = await req.json()
    const token = typeof accessToken === 'string' ? accessToken.trim() : ''
    const secret = typeof channelSecret === 'string' ? channelSecret.trim() : ''
    if (!token || !secret) {
      return NextResponse.json({ error: 'กรุณากรอก Channel access token และ Channel secret' }, { status: 400 })
    }

    // ตรวจ token + ดึงข้อมูล OA
    const bot = await getLineBotInfo(token)
    if (!bot.ok) {
      return NextResponse.json({ error: 'Token ไม่ถูกต้อง: ' + bot.error }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // OA นี้ถูกเชื่อมโดยบัญชีอื่นอยู่แล้ว → ห้ามสร้างซ้ำ
    // (webhook หา OA ด้วย bot userId แบบแถวเดียว ถ้ามี 2 แถว ข้อความ LINE ของ OA นี้จะหายทั้งหมด)
    const { data: sameBot, error: dupErr } = await sb
      .from('connected_pages')
      .select('id, user_id')
      .eq('page_id', bot.info.userId)
      .eq('channel', 'line')
    if (dupErr) throw dupErr
    if ((sameBot || []).some((r: any) => r.user_id !== ctx.userId)) {
      return NextResponse.json({ error: 'LINE OA นี้ถูกเชื่อมโดยบัญชีอื่นอยู่แล้ว — ให้เจ้าของเดิมเพิ่มคุณเป็นทีมในเมนู "จัดการทีม" แทน' }, { status: 409 })
    }

    // upsert ตาม (user_id, page_id) — page_id = LINE bot userId
    const { data, error } = await sb
      .from('connected_pages')
      .upsert(
        {
          user_id: ctx.userId,
          channel: 'line',
          page_id: bot.info.userId,
          page_name: bot.info.displayName || 'LINE OA',
          page_picture: bot.info.pictureUrl || null,
          page_access_token: token,
          line_channel_secret: secret,
          is_active: true,
        },
        { onConflict: 'user_id,page_id' },
      )
      .select('id, page_id, page_name, page_picture, channel')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      channel: data,
      // owner ต้องเอา URL นี้ไปวางใน LINE Developers Console → Messaging API → Webhook URL
      webhookPath: '/api/webhooks/line',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    // ช่องทาง LINE ซ่อนอยู่ (lib/features.ts)
    if (!LINE_ENABLED) return NextResponse.json({ error: 'ช่องทาง LINE ปิดใช้งานชั่วคราว', disabled: true }, { status: 403 })
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id || !ctx.ownedPageIds.has(id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const sb = supabaseAdmin()
    const { error } = await sb.from('connected_pages').delete().eq('id', id).eq('channel', 'line')
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
