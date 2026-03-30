// src/app/api/cron/sync-performance/route.ts
// Vercel Cron - รันทุก 6 ชั่วโมงอัตโนมัติ
// ซิงค์ performance จาก Facebook + trigger AI วิเคราะห์

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCampaignInsights } from '@/lib/facebook'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // ตรวจสอบ Cron Secret (ป้องกัน unauthorized calls)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ดึง active campaigns ทั้งหมด
  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('*, connected_pages(page_access_token)')
    .eq('status', 'active')
    .not('fb_campaign_id', 'is', null)

  if (!campaigns?.length) return NextResponse.json({ synced: 0 })

  const results = await Promise.allSettled(
    campaigns.map(async (camp) => {
      const pageToken = camp.connected_pages?.page_access_token
      if (!pageToken) return

      // ดึง insights
      const insights = await getCampaignInsights(camp.fb_campaign_id, pageToken)
      if (!insights) return

      const spend = parseFloat(insights.spend || '0')
      const likes = insights.actions?.find(a => a.action_type === 'like')?.value || '0'
      const comments = insights.actions?.find(a => a.action_type === 'comment')?.value || '0'
      const shares = insights.actions?.find(a => a.action_type === 'post')?.value || '0'
      const engagement = insights.actions?.find(a => a.action_type === 'post_engagement')?.value || '0'

      // บันทึก performance
      await supabase.from('ad_performance').insert({
        campaign_id: camp.id,
        impressions: parseInt(insights.impressions || '0'),
        reach: parseInt(insights.reach || '0'),
        clicks: parseInt(insights.clicks || '0'),
        spend,
        cpm: parseFloat(insights.cpm || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        frequency: parseFloat(insights.frequency || '0'),
        likes: parseInt(likes),
        comments: parseInt(comments),
        shares: parseInt(shares),
        post_engagement: parseInt(engagement),
      })

      // Trigger AI วิเคราะห์ (ทุก 24 ชั่วโมง = ทุก 4 รอบ cron)
      // ดูว่า analyze ล่าสุดเมื่อไร
      const { data: lastAnalysis } = await supabase
        .from('ai_analyses')
        .select('created_at')
        .eq('campaign_id', camp.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const hoursSinceLastAnalysis = lastAnalysis
        ? (Date.now() - new Date(lastAnalysis.created_at).getTime()) / 3600000
        : 999

      if (hoursSinceLastAnalysis >= 24) {
        // Trigger AI analyze
        await fetch(`${process.env.NEXTAUTH_URL}/api/ai-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: camp.id }),
        })
      }

      // เช็คว่า campaign หมดเวลาหรือยัง
      if (camp.end_time && new Date(camp.end_time) < new Date()) {
        await supabase
          .from('ad_campaigns')
          .update({ status: 'completed' })
          .eq('id', camp.id)
      }
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ synced: succeeded, total: campaigns.length })
}
