import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FB = 'https://graph.facebook.com/v19.0'

// All possible optimization goals to test
const GOALS_TO_TEST = [
  'POST_ENGAGEMENT',
  'ENGAGED_USERS',
  'IMPRESSIONS',
  'REACH',
  'LINK_CLICKS',
  'LANDING_PAGE_VIEWS',
  'CONVERSATIONS',
  'THRUPLAY',
  'PAGE_LIKES',
  'QUALITY_LEAD',
  'LEAD_GENERATION',
  'AD_RECALL_LIFT',
  'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
  'VISIT_INSTAGRAM_PROFILE',
]

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const userToken = session.accessToken

    // Get ad account
    const pagesRes = await fetch(`${FB}/me/accounts?fields=id,name&access_token=${userToken}`)
    const pagesData = await pagesRes.json()
    if (!pagesData.data?.[0]) {
      return NextResponse.json({ error: 'No pages found' }, { status: 400 })
    }
    const pageId = pagesData.data[0].id
    const pageToken = pagesData.data[0].access_token

    // Get ad account
    const adAccRes = await fetch(`${FB}/${pageId}?fields=ad_account&access_token=${pageToken}`)
    const adAccData = await adAccRes.json()

    // Try different method to get ad account
    const aaRes = await fetch(`${FB}/me/adaccounts?fields=id,name,account_status&access_token=${userToken}`)
    const aaData = await aaRes.json()
    if (!aaData.data?.[0]) {
      return NextResponse.json({ error: 'No ad accounts found', adAccData, aaData }, { status: 400 })
    }
    const adAccountId = aaData.data[0].id

    // Create test campaign
    const campRes = await fetch(`${FB}/${adAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '[DEBUG] Test Goals - DELETE ME',
        objective: 'OUTCOME_ENGAGEMENT',
        status: 'PAUSED',
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: userToken,
      }),
    })
    const campData = await campRes.json()
    if (campData.error) {
      return NextResponse.json({ error: 'Campaign creation failed', details: campData.error }, { status: 400 })
    }
    const campaignId = campData.id

    // Test each optimization goal
    const results: Record<string, string> = {}

    for (const goal of GOALS_TO_TEST) {
      try {
        const now = new Date()
        const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

        const adsetRes = await fetch(`${FB}/${adAccountId}/adsets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `[DEBUG] Test ${goal}`,
            campaign_id: campaignId,
            daily_budget: 10000, // 100 THB in satang
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            start_time: now.toISOString(),
            end_time: end.toISOString(),
            billing_event: 'IMPRESSIONS',
            optimization_goal: goal,
            targeting: {
              geo_locations: { countries: ['TH'] },
              age_min: 18,
              age_max: 65,
              targeting_automation: { advantage_audience: 1 },
            },
            promoted_object: { page_id: pageId },
            access_token: userToken,
            status: 'PAUSED',
          }),
        })
        const adsetData = await adsetRes.json()

        if (adsetData.error) {
          results[goal] = `❌ ${adsetData.error.error_user_msg || adsetData.error.message}`
        } else {
          results[goal] = `✅ SUCCESS (adset_id: ${adsetData.id})`
          // Delete test adset
          await fetch(`${FB}/${adsetData.id}?access_token=${userToken}`, { method: 'DELETE' })
        }
      } catch (e: any) {
        results[goal] = `❌ Error: ${e.message}`
      }
    }

    // Also test WITHOUT optimization_goal
    try {
      const now = new Date()
      const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const adsetRes = await fetch(`${FB}/${adAccountId}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `[DEBUG] Test NO_GOAL`,
          campaign_id: campaignId,
          daily_budget: 10000,
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          start_time: now.toISOString(),
          end_time: end.toISOString(),
          billing_event: 'IMPRESSIONS',
          targeting: {
            geo_locations: { countries: ['TH'] },
            age_min: 18,
            age_max: 65,
            targeting_automation: { advantage_audience: 1 },
          },
          promoted_object: { page_id: pageId },
          access_token: userToken,
          status: 'PAUSED',
        }),
      })
      const adsetData = await adsetRes.json()
      if (adsetData.error) {
        results['(no optimization_goal)'] = `❌ ${adsetData.error.error_user_msg || adsetData.error.message}`
      } else {
        results['(no optimization_goal)'] = `✅ SUCCESS (adset_id: ${adsetData.id})`
        await fetch(`${FB}/${adsetData.id}?access_token=${userToken}`, { method: 'DELETE' })
      }
    } catch (e: any) {
      results['(no optimization_goal)'] = `❌ Error: ${e.message}`
    }

    // Delete test campaign
    await fetch(`${FB}/${campaignId}?access_token=${userToken}`, { method: 'DELETE' })

    return NextResponse.json({
      message: 'Debug results for OUTCOME_ENGAGEMENT + each optimization_goal',
      adAccountId,
      pageId,
      campaignObjective: 'OUTCOME_ENGAGEMENT',
      results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
