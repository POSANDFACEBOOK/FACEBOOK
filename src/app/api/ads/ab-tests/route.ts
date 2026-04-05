import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id&access_token=${session.accessToken}`
    )
    const meData = await meRes.json()
    if (meData.error) throw new Error(meData.error.message)

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('facebook_id', meData.id)
      .single()

    if (!user) {
      return NextResponse.json({ tests: [] })
    }

    // Get all AB test groups with connected page info
    const { data: tests, error } = await supabase
      .from('ab_test_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // For each test, get page name + variants with latest performance
    const testsWithDetails = await Promise.all(
      (tests || []).map(async (test) => {
        // Get page name
        const { data: page } = await supabase
          .from('connected_pages')
          .select('page_name, page_id')
          .eq('id', test.page_id)
          .single()

        // Get variants (ad_campaigns) for this test
        const { data: variants } = await supabase
          .from('ad_campaigns')
          .select('id, campaign_name, variant_label, variant_strategy, daily_budget, status, fb_campaign_id, fb_adset_id, fb_ad_id, start_time, end_time')
          .eq('test_group_id', test.id)
          .order('created_at', { ascending: true })

        // Get latest performance for each variant
        const variantsWithPerf = await Promise.all(
          (variants || []).map(async (v) => {
            const { data: perf } = await supabase
              .from('ad_performance')
              .select('impressions, reach, clicks, spend, cpm, cpc, ctr, frequency')
              .eq('campaign_id', v.id)
              .order('fetched_at', { ascending: false })
              .limit(1)
              .single()

            return { ...v, perf: perf || null }
          })
        )

        // Calculate totals
        const totalSpend = variantsWithPerf.reduce((sum, v) => sum + (v.perf?.spend || 0), 0)
        const totalImpressions = variantsWithPerf.reduce((sum, v) => sum + (v.perf?.impressions || 0), 0)
        const totalReach = variantsWithPerf.reduce((sum, v) => sum + (v.perf?.reach || 0), 0)
        const totalClicks = variantsWithPerf.reduce((sum, v) => sum + (v.perf?.clicks || 0), 0)

        return {
          ...test,
          page_name: page?.page_name || 'ไม่ทราบชื่อเพจ',
          fb_page_id: page?.page_id || '',
          variant_count: variantsWithPerf.length,
          variants: variantsWithPerf,
          totals: {
            spend: totalSpend,
            impressions: totalImpressions,
            reach: totalReach,
            clicks: totalClicks,
          },
        }
      })
    )

    return NextResponse.json({ tests: testsWithDetails })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
