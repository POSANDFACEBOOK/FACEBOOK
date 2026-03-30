// src/app/api/ads/create/route.ts
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCampaign, createAdSet, createAd } from '@/lib/facebook'
import type { AdTargeting } from '@/lib/facebook'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session?.accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    pageDbId,
    postId,
    postMessage,
    postImage,
    campaignName,
    dailyBudget,
    startDate,
    endDate,
    targeting,
  }: {
    pageDbId: string
    postId: string
    postMessage: string
    postImage?: string
    campaignName: string
    dailyBudget: number
    startDate: string
    endDate: string
    targeting: AdTargeting
  } = body

  // ดึงข้อมูล Page จาก Supabase
  const { data: page, error: pageErr } = await supabase
    .from('connected_pages')
    .select('*')
    .eq('id', pageDbId)
    .single()

  if (pageErr || !page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  if (!page.ad_account_id) return NextResponse.json({ error: 'No Ad Account linked to this page' }, { status: 400 })

  // ดึง user id
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('access_token', session.accessToken)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // สร้าง Campaign record ก่อน (status = draft)
  const { data: campaign, error: campErr } = await supabase
    .from('ad_campaigns')
    .insert({
      user_id: user.id,
      page_id: pageDbId,
      fb_post_id: postId,
      campaign_name: campaignName,
      post_message: postMessage,
      post_image: postImage,
      daily_budget: dailyBudget,
      start_time: startDate,
      end_time: endDate,
      target_age_min: targeting.ageMin,
      target_age_max: targeting.ageMax,
      target_genders: targeting.genders.map(String),
      target_locations: targeting.geoLocations || {},
      target_interests: targeting.interests || [],
      status: 'draft',
    })
    .select()
    .single()

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 })

  try {
    // สร้าง Facebook Campaign
    const fbCampaignId = await createCampaign(
      page.ad_account_id,
      page.page_access_token,
      campaignName
    )

    // สร้าง Ad Set
    const fbAdSetId = await createAdSet(
      page.ad_account_id,
      page.page_access_token,
      fbCampaignId,
      {
        name: `${campaignName} - AdSet`,
        dailyBudget,
        startTime: new Date(startDate).toISOString(),
        endTime: new Date(endDate).toISOString(),
        targeting,
        pageId: page.page_id,
      }
    )

    // สร้าง Ad
    const fbAdId = await createAd(
      page.ad_account_id,
      page.page_access_token,
      fbAdSetId,
      {
        name: `${campaignName} - Ad`,
        pageId: page.page_id,
        postId,
      }
    )

    // อัปเดต campaign ด้วย Facebook IDs
    await supabase
      .from('ad_campaigns')
      .update({
        fb_campaign_id: fbCampaignId,
        fb_adset_id: fbAdSetId,
        fb_ad_id: fbAdId,
        status: 'active',
      })
      .eq('id', campaign.id)

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      fbCampaignId,
    })
  } catch (err: any) {
    // Mark as error
    await supabase
      .from('ad_campaigns')
      .update({ status: 'error' })
      .eq('id', campaign.id)

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
