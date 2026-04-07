import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { updateAdSetBudget, updateAllStatus } from '@/lib/facebook'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userToken = session.accessToken as string
    const { testId } = await params
    const { comparison } = await req.json()

    if (!comparison?.variants?.length) {
      return NextResponse.json({ error: 'ไม่มีข้อมูล comparison' }, { status: 400 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get test group
    const { data: testGroup } = await supabase
      .from('ab_test_groups')
      .select('*')
      .eq('id', testId)
      .single()

    if (!testGroup) {
      return NextResponse.json({ error: 'ไม่พบ Test Group' }, { status: 404 })
    }

    // Get all campaigns in this test group
    const { data: campaigns } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('test_group_id', testId)

    if (!campaigns?.length) {
      return NextResponse.json({ error: 'ไม่พบแคมเปญ' }, { status: 404 })
    }

    const actions: { label: string; verdict: string; action: string; success: boolean }[] = []

    // Debug: log matching info
    const debugInfo = {
      comparisonVariantIds: comparison.variants.map((v: any) => v.campaignId),
      campaignIds: campaigns.map((c: any) => c.id),
    }

    for (const cv of comparison.variants) {
      // Try matching by campaignId first, then by label
      let campaign = campaigns.find((c: any) => c.id === cv.campaignId)
      if (!campaign && cv.label) {
        campaign = campaigns.find((c: any) => c.variant_label === cv.label)
      }

      if (!campaign) {
        actions.push({
          label: cv.label || 'Unknown',
          verdict: cv.verdict,
          action: `ไม่พบแคมเปญที่ตรงกัน (ID: ${cv.campaignId?.slice(0, 8)}...)`,
          success: false,
        })
        continue
      }

      const budgetChange = typeof cv.suggestedBudgetChange === 'number'
        ? cv.suggestedBudgetChange
        : 0

      switch (cv.verdict) {
        case 'scale_up': {
          // Default to +50% if no specific budget change
          const effectiveChange = budgetChange > 0 ? budgetChange : 50
          if (campaign.fb_adset_id) {
            const multiplier = 1 + (effectiveChange / 100)
            const newBudget = Math.round(campaign.daily_budget * multiplier)
            try {
              await updateAdSetBudget(campaign.fb_adset_id, userToken, newBudget)
              await supabase.from('ad_campaigns')
                .update({ daily_budget: newBudget })
                .eq('id', campaign.id)
              actions.push({
                label: cv.label,
                verdict: 'scale_up',
                action: `เพิ่มงบ ฿${campaign.daily_budget} → ฿${newBudget}/วัน (+${effectiveChange}%)`,
                success: true,
              })
            } catch (e: any) {
              actions.push({ label: cv.label, verdict: 'scale_up', action: `Facebook Error: ${e.message}`, success: false })
            }
          } else {
            actions.push({ label: cv.label, verdict: 'scale_up', action: 'ไม่มี AdSet ID', success: false })
          }
          break
        }

        case 'reduce': {
          // Default to -30% if no specific budget change
          const effectiveChange = budgetChange !== 0 ? Math.abs(budgetChange) : 30
          if (campaign.fb_adset_id) {
            const multiplier = 1 - (effectiveChange / 100)
            const newBudget = Math.max(20, Math.round(campaign.daily_budget * multiplier))
            try {
              await updateAdSetBudget(campaign.fb_adset_id, userToken, newBudget)
              await supabase.from('ad_campaigns')
                .update({ daily_budget: newBudget })
                .eq('id', campaign.id)
              actions.push({
                label: cv.label,
                verdict: 'reduce',
                action: `ลดงบ ฿${campaign.daily_budget} → ฿${newBudget}/วัน (-${effectiveChange}%)`,
                success: true,
              })
            } catch (e: any) {
              actions.push({ label: cv.label, verdict: 'reduce', action: `Facebook Error: ${e.message}`, success: false })
            }
          } else {
            actions.push({ label: cv.label, verdict: 'reduce', action: 'ไม่มี AdSet ID', success: false })
          }
          break
        }

        case 'stop_and_delete': {
          if (campaign.fb_campaign_id && campaign.status !== 'paused') {
            try {
              await updateAllStatus(userToken, campaign.fb_campaign_id, campaign.fb_adset_id, campaign.fb_ad_id, 'PAUSED')
              await supabase.from('ad_campaigns').update({ status: 'paused' }).eq('id', campaign.id)
              actions.push({ label: cv.label, verdict: 'stop_and_delete', action: 'หยุดแอดแล้ว', success: true })
            } catch (e: any) {
              actions.push({ label: cv.label, verdict: 'stop_and_delete', action: `Facebook Error: ${e.message}`, success: false })
            }
          } else {
            actions.push({ label: cv.label, verdict: 'stop_and_delete', action: campaign.status === 'paused' ? 'หยุดอยู่แล้ว' : 'ไม่มี Campaign ID', success: true })
          }
          break
        }

        case 'keep_running': {
          actions.push({ label: cv.label, verdict: 'keep_running', action: 'ปล่อยต่อ ไม่เปลี่ยนแปลง', success: true })
          break
        }

        default: {
          actions.push({ label: cv.label || 'Unknown', verdict: cv.verdict || 'unknown', action: `ไม่รู้จัก verdict: ${cv.verdict}`, success: false })
          break
        }
      }
    }

    // Mark AI analysis as action taken
    const campaignIds = campaigns.map((c: any) => c.id)
    await supabase
      .from('ai_analyses')
      .update({ action_taken: true, action_at: new Date().toISOString() })
      .in('campaign_id', campaignIds)
      .eq('action_taken', false)

    // Notify user
    const successCount = actions.filter(a => a.success).length
    await supabase.from('notifications').insert({
      user_id: testGroup.user_id,
      type: 'ai_action',
      title: 'AI จัดสรรงบ A/B Test แล้ว',
      message: actions.map(a => `${a.label}: ${a.action}`).join(', '),
    })

    return NextResponse.json({ success: true, actions, debug: debugInfo })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
