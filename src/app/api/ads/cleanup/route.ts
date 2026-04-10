import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FB = 'https://graph.facebook.com/v19.0'

// POST: find and delete inactive/unused ads
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userToken = session.accessToken as string

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify user
    const meRes = await fetch(`${FB}/me?fields=id&access_token=${userToken}`)
    const meData = await meRes.json()
    if (meData.error) throw new Error(meData.error.message)

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('facebook_id', meData.id)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Get all campaigns for this user
    const { data: campaigns } = await supabase
      .from('ad_campaigns')
      .select('id, campaign_name, status, fb_campaign_id, fb_adset_id, fb_ad_id, daily_budget, end_time, test_group_id')
      .eq('user_id', user.id)

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ cleaned: 0, details: [] })
    }

    // Find inactive campaigns:
    // 1. status = 'paused', 'completed', 'error', 'draft'
    // 2. end_time has passed
    // 3. campaigns with no FB IDs (failed creation)
    const now = new Date()
    const inactive = campaigns.filter(c => {
      if (c.status === 'error' || c.status === 'draft') return true
      if (!c.fb_campaign_id && !c.fb_adset_id && !c.fb_ad_id) return true
      if (c.status === 'completed') return true
      if (c.end_time && new Date(c.end_time) < now && c.status !== 'active') return true
      return false
    })

    if (inactive.length === 0) {
      return NextResponse.json({ cleaned: 0, details: [], message: 'ไม่มีแอดที่ต้องลบ' })
    }

    // Delete each inactive campaign
    const results: { id: string; name: string; success: boolean; error?: string }[] = []

    for (const c of inactive) {
      const fbErrors: string[] = []

      // Delete from Facebook
      if (c.fb_ad_id) {
        try {
          const r = await fetch(`${FB}/${c.fb_ad_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ access_token: userToken }).toString(),
          })
          const d = await r.json()
          if (d.error && !d.error.message.includes('does not exist')) fbErrors.push(d.error.message)
        } catch {}
      }

      if (c.fb_adset_id) {
        try {
          const r = await fetch(`${FB}/${c.fb_adset_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ access_token: userToken }).toString(),
          })
          const d = await r.json()
          if (d.error && !d.error.message.includes('does not exist')) fbErrors.push(d.error.message)
        } catch {}
      }

      if (c.fb_campaign_id) {
        try {
          const r = await fetch(`${FB}/${c.fb_campaign_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ access_token: userToken }).toString(),
          })
          const d = await r.json()
          if (d.error && !d.error.message.includes('does not exist')) fbErrors.push(d.error.message)
        } catch {}
      }

      // Delete from Supabase
      await supabase.from('ai_analyses').delete().eq('campaign_id', c.id)
      await supabase.from('ad_performance').delete().eq('campaign_id', c.id)
      await supabase.from('notifications').delete().eq('campaign_id', c.id)

      // If part of AB test, check if we need to clean up test group
      if (c.test_group_id) {
        const { count } = await supabase
          .from('ad_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('test_group_id', c.test_group_id)
          .neq('id', c.id)

        // If this was the last variant, delete the test group too
        if (count === 0) {
          await supabase.from('ab_test_groups').delete().eq('id', c.test_group_id)
        }
      }

      await supabase.from('ad_campaigns').delete().eq('id', c.id)

      results.push({
        id: c.id,
        name: c.campaign_name,
        success: fbErrors.length === 0,
        error: fbErrors.length > 0 ? fbErrors.join(', ') : undefined,
      })
    }

    return NextResponse.json({
      cleaned: results.length,
      details: results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: preview what would be cleaned (dry run)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userToken = session.accessToken as string

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id&access_token=${userToken}`)
    const meData = await meRes.json()
    if (meData.error) throw new Error(meData.error.message)

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('facebook_id', meData.id)
      .single()

    if (!user) return NextResponse.json({ count: 0, campaigns: [] })

    const { data: campaigns } = await supabase
      .from('ad_campaigns')
      .select('id, campaign_name, status, fb_campaign_id, end_time, daily_budget, test_group_id, variant_label')
      .eq('user_id', user.id)

    const now = new Date()
    const inactive = (campaigns || []).filter(c => {
      if (c.status === 'error' || c.status === 'draft') return true
      if (!c.fb_campaign_id) return true
      if (c.status === 'completed') return true
      if (c.end_time && new Date(c.end_time) < now && c.status !== 'active') return true
      return false
    })

    return NextResponse.json({
      count: inactive.length,
      campaigns: inactive.map(c => ({
        id: c.id,
        name: c.campaign_name || c.variant_label || 'ไม่มีชื่อ',
        status: c.status,
        reason: !c.fb_campaign_id ? 'สร้างไม่สำเร็จ' :
                c.status === 'error' ? 'เกิดข้อผิดพลาด' :
                c.status === 'draft' ? 'แบบร่าง' :
                c.status === 'completed' ? 'เสร็จสิ้นแล้ว' :
                'หมดเวลาแล้ว',
        isABVariant: !!c.test_group_id,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
