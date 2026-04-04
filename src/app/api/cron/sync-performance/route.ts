import { NextResponse } from 'next/server'
import { getCampaignInsights, updateCampaignStatus } from '@/lib/facebook'
import { analyzeAdPerformance, compareTestVariants, type VariantPerformance } from '@/lib/ai-analyzer'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all active campaigns with their page tokens
  const { data: campaigns, error } = await supabase
    .from('ad_campaigns')
    .select(`
      id, fb_campaign_id, fb_adset_id, campaign_name,
      daily_budget, start_time, end_time, user_id,
      connected_pages!page_id (page_access_token, ad_account_id)
    `)
    .eq('status', 'active')
    .not('fb_campaign_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = { synced: 0, analyzed: 0, abTestsCompared: 0, errors: 0 }

  for (const campaign of campaigns || []) {
    try {
      const page = (campaign as any).connected_pages
      const pageToken = page?.page_access_token
      if (!pageToken || !campaign.fb_campaign_id) continue

      // Fetch Facebook Insights
      const insights = await getCampaignInsights(campaign.fb_campaign_id, pageToken)
      if (!insights) continue

      // Parse engagement actions
      const actions = insights.actions || []
      const getAction = (type: string) =>
        parseInt(actions.find((a: any) => a.action_type === type)?.value || '0')

      const likes = getAction('like') + getAction('post_reaction')
      const comments = getAction('comment')
      const shares = getAction('share')
      const postEngagement = getAction('post_engagement')

      const spend = parseFloat(insights.spend || '0')
      const budgetPerDay = campaign.daily_budget || 0
      const startTime = campaign.start_time ? new Date(campaign.start_time) : new Date()
      const endTime = campaign.end_time ? new Date(campaign.end_time) : new Date()
      const totalBudget = budgetPerDay * Math.ceil((endTime.getTime() - startTime.getTime()) / 86400000)
      const budgetRemaining = Math.max(0, totalBudget - spend)

      // Save performance snapshot
      await supabase.from('ad_performance').insert({
        campaign_id: campaign.id,
        impressions: parseInt(insights.impressions || '0'),
        reach: parseInt(insights.reach || '0'),
        clicks: parseInt(insights.clicks || '0'),
        spend,
        cpm: parseFloat(insights.cpm || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        frequency: parseFloat(insights.frequency || '0'),
        likes,
        comments,
        shares,
        reactions: likes,
        unique_clicks: parseInt(insights.unique_clicks || '0'),
        post_engagement: postEngagement,
        budget_remaining: budgetRemaining,
      })

      results.synced++

      // Check if AI analysis needed (last analysis > 24 hours ago)
      const { data: lastAnalysis } = await supabase
        .from('ai_analyses')
        .select('created_at')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const shouldAnalyze =
        !lastAnalysis ||
        new Date().getTime() - new Date(lastAnalysis.created_at).getTime() > 24 * 60 * 60 * 1000

      if (shouldAnalyze) {
        const now = new Date()
        const daysRunning = Math.ceil((now.getTime() - startTime.getTime()) / 86400000)
        const daysLeft = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 86400000))

        const aiResult = await analyzeAdPerformance({
          campaignName: campaign.campaign_name,
          spend,
          budget: totalBudget,
          budgetRemaining,
          daysRunning,
          daysLeft,
          impressions: parseInt(insights.impressions || '0'),
          reach: parseInt(insights.reach || '0'),
          clicks: parseInt(insights.clicks || '0'),
          ctr: parseFloat(insights.ctr || '0'),
          cpm: parseFloat(insights.cpm || '0'),
          cpc: parseFloat(insights.cpc || '0'),
          frequency: parseFloat(insights.frequency || '0'),
          engagement: postEngagement,
          likes,
          comments,
          shares,
        })

        // Save AI analysis
        await supabase.from('ai_analyses').insert({
          campaign_id: campaign.id,
          recommendation: aiResult.recommendation,
          confidence_score: aiResult.confidence,
          summary: aiResult.summary,
          reasoning: aiResult.reasoning,
          action_items: aiResult.actionItems,
          performance_snapshot: insights,
        })

        // Create notification for user
        await supabase.from('notifications').insert({
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          type: 'ai_alert',
          title: `AI วิเคราะห์แคมเปญ: ${campaign.campaign_name}`,
          message: aiResult.summary,
        })

        results.analyzed++
      }
    } catch (err: any) {
      console.error(`Error syncing campaign ${campaign.id}:`, err.message)
      results.errors++
    }
  }

  // ============================================
  // AB Test Comparison: เปรียบเทียบ variants
  // ============================================
  const { data: runningTests } = await supabase
    .from('ab_test_groups')
    .select('*')
    .eq('status', 'running')

  for (const testGroup of runningTests || []) {
    try {
      // Get page token
      const { data: page } = await supabase
        .from('connected_pages')
        .select('page_access_token')
        .eq('id', testGroup.page_id)
        .single()

      if (!page?.page_access_token) continue

      // Get campaigns in this test group
      const { data: testCampaigns } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('test_group_id', testGroup.id)
        .in('status', ['active', 'paused'])

      if (!testCampaigns || testCampaigns.length < 2) continue

      // Check last comparison (every 12 hours for AB tests)
      const { data: lastComparison } = await supabase
        .from('ai_analyses')
        .select('created_at')
        .in('campaign_id', testCampaigns.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const shouldCompare =
        !lastComparison ||
        Date.now() - new Date(lastComparison.created_at).getTime() > 12 * 60 * 60 * 1000

      if (!shouldCompare) continue

      // Collect live metrics
      const variantPerfs: VariantPerformance[] = []
      for (const camp of testCampaigns) {
        if (!camp.fb_campaign_id || camp.status !== 'active') continue
        try {
          const ins = await getCampaignInsights(camp.fb_campaign_id, page.page_access_token)
          if (!ins) continue
          const actions = ins.actions || []
          const ga = (t: string) => parseInt(actions.find((a: any) => a.action_type === t)?.value || '0')

          variantPerfs.push({
            campaignId: camp.id,
            variantLabel: camp.variant_label || camp.campaign_name,
            strategy: camp.variant_strategy?.strategy || '',
            spend: parseFloat(ins.spend || '0'),
            impressions: parseInt(ins.impressions || '0'),
            reach: parseInt(ins.reach || '0'),
            clicks: parseInt(ins.clicks || '0'),
            ctr: parseFloat(ins.ctr || '0'),
            cpm: parseFloat(ins.cpm || '0'),
            cpc: parseFloat(ins.cpc || '0'),
            frequency: parseFloat(ins.frequency || '0'),
            engagement: ga('post_engagement'),
            likes: ga('like') + ga('post_reaction'),
            comments: ga('comment'),
            shares: ga('share'),
          })
        } catch {
          // skip
        }
      }

      if (variantPerfs.length < 2) continue

      const daysRunning = Math.ceil(
        (Date.now() - new Date(testGroup.created_at).getTime()) / 86400000
      )

      const comparison = await compareTestVariants(
        variantPerfs,
        testGroup.total_daily_budget,
        daysRunning
      )

      // Save analysis
      if (comparison.bestVariant) {
        await supabase.from('ai_analyses').insert({
          campaign_id: comparison.bestVariant,
          recommendation: 'increase_budget',
          confidence_score: 0.9,
          summary: comparison.overallSummary,
          reasoning: comparison.reallocationPlan || '',
          action_items: comparison.variants.map(v => `${v.label}: ${v.verdict} — ${v.reason}`),
          performance_snapshot: { comparison },
        })

        await supabase
          .from('ab_test_groups')
          .update({ winning_campaign_id: comparison.bestVariant })
          .eq('id', testGroup.id)
      }

      // Auto-pause losing variants
      for (const v of comparison.variants) {
        if (v.verdict === 'stop_and_delete') {
          const camp = testCampaigns.find(c => c.id === v.campaignId)
          if (camp?.fb_campaign_id) {
            try {
              await updateCampaignStatus(camp.fb_campaign_id, page.page_access_token, 'PAUSED')
              await supabase.from('ad_campaigns').update({ status: 'paused' }).eq('id', v.campaignId)
            } catch { /* continue */ }
          }
        }
      }

      // Notify
      await supabase.from('notifications').insert({
        user_id: testGroup.user_id,
        type: 'ai_alert',
        title: 'AI อัปเดต A/B Test',
        message: comparison.overallSummary,
      })

      results.abTestsCompared++
    } catch (err: any) {
      console.error(`Error comparing AB test ${testGroup.id}:`, err.message)
      results.errors++
    }
  }

  return NextResponse.json({ success: true, ...results })
}
