// src/app/api/ai-analyze/route.ts
// POST /api/ai-analyze - วิเคราะห์ Ad ด้วย AI

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCampaignInsights } from '@/lib/facebook'
import { analyzeAdPerformance } from '@/lib/ai-analyzer'
import { differenceInDays } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { campaignId } = await req.json()

  // ดึง campaign data
  const { data: campaign } = await supabase
    .from('ad_campaigns')
    .select(`*, connected_pages(page_access_token, page_id)`)
    .eq('id', campaignId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const page = campaign.connected_pages
  if (!campaign.fb_campaign_id) return NextResponse.json({ error: 'No FB campaign ID' }, { status: 400 })

  // ดึง insights จาก Facebook
  const insights = await getCampaignInsights(campaign.fb_campaign_id, page.page_access_token)

  // Save performance snapshot
  const likes = insights?.actions?.find(a => a.action_type === 'like')?.value || '0'
  const comments = insights?.actions?.find(a => a.action_type === 'comment')?.value || '0'
  const shares = insights?.actions?.find(a => a.action_type === 'post')?.value || '0'
  const engagement = insights?.actions?.find(a => a.action_type === 'post_engagement')?.value || '0'

  const spend = parseFloat(insights?.spend || '0')
  const budget = campaign.daily_budget * Math.max(differenceInDays(new Date(campaign.end_time), new Date(campaign.start_time)), 1)
  const daysRunning = differenceInDays(new Date(), new Date(campaign.start_time))
  const daysLeft = differenceInDays(new Date(campaign.end_time), new Date())

  await supabase.from('ad_performance').insert({
    campaign_id: campaignId,
    impressions: parseInt(insights?.impressions || '0'),
    reach: parseInt(insights?.reach || '0'),
    clicks: parseInt(insights?.clicks || '0'),
    spend,
    cpm: parseFloat(insights?.cpm || '0'),
    cpc: parseFloat(insights?.cpc || '0'),
    ctr: parseFloat(insights?.ctr || '0'),
    frequency: parseFloat(insights?.frequency || '0'),
    likes: parseInt(likes),
    comments: parseInt(comments),
    shares: parseInt(shares),
    post_engagement: parseInt(engagement),
    budget_remaining: budget - spend,
  })

  // AI วิเคราะห์
  const analysis = await analyzeAdPerformance({
    campaignName: campaign.campaign_name,
    spend,
    budget,
    budgetRemaining: budget - spend,
    daysRunning,
    daysLeft,
    impressions: parseInt(insights?.impressions || '0'),
    reach: parseInt(insights?.reach || '0'),
    clicks: parseInt(insights?.clicks || '0'),
    ctr: parseFloat(insights?.ctr || '0'),
    cpm: parseFloat(insights?.cpm || '0'),
    cpc: parseFloat(insights?.cpc || '0'),
    frequency: parseFloat(insights?.frequency || '0'),
    engagement: parseInt(engagement),
    likes: parseInt(likes),
    comments: parseInt(comments),
    shares: parseInt(shares),
  })

  // บันทึกผล analysis
  const { data: savedAnalysis } = await supabase.from('ai_analyses').insert({
    campaign_id: campaignId,
    recommendation: analysis.recommendation,
    confidence_score: analysis.confidence,
    summary: analysis.summary,
    reasoning: analysis.reasoning,
    action_items: analysis.actionItems,
    performance_snapshot: insights,
  }).select().single()

  // สร้าง Notification
  await supabase.from('notifications').insert({
    user_id: campaign.user_id,
    campaign_id: campaignId,
    type: 'ai_alert',
    title: `AI วิเคราะห์: ${campaign.campaign_name}`,
    message: analysis.summary,
  })

  return NextResponse.json({ analysis, analysisId: savedAnalysis?.id })
}


// ============================================================
// src/app/api/cron/sync-performance/route.ts
// Vercel Cron Job - รันทุก 6 ชั่วโมง
// ============================================================

// เพิ่มใน vercel.json:
// { "crons": [{ "path": "/api/cron/sync-performance", "schedule": "0 */6 * * *" }] }
