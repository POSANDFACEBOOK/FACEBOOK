// PATCH /api/inbox/pages — ตั้ง/แก้ชื่อเล่นเพจ (nickname)
// Body: { pageId: string, nickname: string | null }
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertPageAccess } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { pageId, nickname } = await req.json()
    if (!pageId) return NextResponse.json({ error: 'Missing pageId' }, { status: 400 })

    // เป็น member ของเพจถึงแก้ได้ (ชื่อเล่นเป็นของทีม)
    const g = assertPageAccess(ctx, pageId)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    const clean = typeof nickname === 'string' ? nickname.trim().slice(0, 60) : ''
    const value = clean.length > 0 ? clean : null

    const sb = supabaseAdmin()
    const { error } = await sb
      .from('connected_pages')
      .update({ nickname: value })
      .eq('id', pageId)

    if (error) throw error
    return NextResponse.json({ success: true, nickname: value })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
