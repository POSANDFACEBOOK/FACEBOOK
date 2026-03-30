import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const session = await getServerSession()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ campaigns: campaigns || [] })
}