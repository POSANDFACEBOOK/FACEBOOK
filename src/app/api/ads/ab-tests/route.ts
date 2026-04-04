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

    // Get all AB test groups for this user
    const { data: tests, error } = await supabase
      .from('ab_test_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // Get variant count for each test
    const testsWithCounts = await Promise.all(
      (tests || []).map(async (test) => {
        const { count } = await supabase
          .from('ad_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('test_group_id', test.id)

        return { ...test, variant_count: count || 0 }
      })
    )

    return NextResponse.json({ tests: testsWithCounts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
