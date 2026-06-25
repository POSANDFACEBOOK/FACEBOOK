// GET /api/line/health — ตรวจสุขภาพ LINE OA ทุกอันในคลิกเดียว (owner)
// เช็ค: token ใช้ได้, ตั้ง Webhook URL ถูก, เปิด Use webhook, และยิง test จริง
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner } from '@/lib/team'
import { getLineBotInfo, getLineWebhookEndpoint, testLineWebhook } from '@/lib/line'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const g = assertOwner(ctx)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    const expectedPath = '/api/webhooks/line'

    const sb = supabaseAdmin()
    const { data: channels } = await sb
      .from('connected_pages')
      .select('id, page_name, page_access_token')
      .in('id', Array.from(ctx.ownedPageIds))
      .eq('channel', 'line')
      .eq('is_active', true)
      .order('page_name')

    if (!channels || channels.length === 0) {
      return NextResponse.json({ results: [], total: 0 })
    }

    const results = await Promise.all(channels.map(async (c: any) => {
      const token = c.page_access_token as string
      const bot = await getLineBotInfo(token)
      const tokenOk = bot.ok

      let webhookUrl: string | null = null
      let useWebhook = false
      let urlOk = false
      let webhookErr: string | undefined

      if (tokenOk) {
        const wh = await getLineWebhookEndpoint(token)
        if (wh.error) webhookErr = wh.error
        webhookUrl = wh.endpoint || null
        useWebhook = !!wh.active
        urlOk = !!wh.endpoint && wh.endpoint.includes(expectedPath)
      }

      // ยิง test เฉพาะเมื่อ token + url ถูก (ไม่งั้น LINE คืน error อยู่แล้ว)
      let testPass: boolean | null = null
      let testDetail: string | undefined
      if (tokenOk && urlOk) {
        const t = await testLineWebhook(token)
        if (t.error) { testPass = false; testDetail = t.error }
        else { testPass = t.success === true; testDetail = t.success ? `HTTP ${t.statusCode}` : (t.reason || t.detail || `HTTP ${t.statusCode}`) }
      }

      const ok = tokenOk && urlOk && useWebhook && testPass === true
      return {
        id: c.id,
        name: c.page_name,
        tokenOk,
        urlOk,
        useWebhook,
        webhookUrl,
        testPass,
        testDetail,
        webhookErr,
        ok,
      }
    }))

    return NextResponse.json({ results, total: results.length, expectedPath })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
