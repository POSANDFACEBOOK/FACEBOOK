// GET /api/team/members — รายการ members ทั้งหมดของเพจที่ owner เป็นเจ้าของ
// DELETE /api/team/members?userId=<id>&pageId=<id?> — revoke membership
//   ถ้าไม่ส่ง pageId = ลบทุกเพจของ owner ที่ user นี้เป็น member
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ members: [] })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ members: [] })

    const g = assertOwner(ctx)
    if (!g.ok) return NextResponse.json({ members: [] })

    const ownedIds = Array.from(ctx.ownedPageIds)
    if (ownedIds.length === 0) return NextResponse.json({ members: [] })

    const sb = supabaseAdmin()

    // ดึง members ทั้งหมดในเพจที่ owner เป็นเจ้าของ (ยกเว้น owner เอง)
    const { data: rows } = await sb
      .from('page_members')
      .select(`
        id, role, joined_at,
        user_id,
        page_id,
        users:user_id (id, name, image, email, facebook_id),
        connected_pages!inner (id, page_name, page_picture, channel)
      `)
      .in('page_id', ownedIds)
      .neq('user_id', ctx.userId)
      .order('joined_at', { ascending: false })

    // group by user_id → 1 row per user with list of pages
    const byUser = new Map<string, any>()
    for (const r of (rows || []) as any[]) {
      const uid = r.user_id
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          userId: uid,
          name: r.users?.name || 'ผู้ใช้',
          image: r.users?.image || null,
          email: r.users?.email || null,
          facebookId: r.users?.facebook_id || null,
          role: r.role,
          joinedAt: r.joined_at,
          pages: [],
        })
      }
      byUser.get(uid).pages.push({
        pageId: r.page_id,
        pageName: r.connected_pages?.page_name || '',
        pagePicture: r.connected_pages?.page_picture || null,
        channel: r.connected_pages?.channel || 'facebook',
      })
    }

    return NextResponse.json({ members: Array.from(byUser.values()) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, members: [] }, { status: 500 })
  }
}

// PATCH /api/team/members — แก้สิทธิ์เพจของแอดมิน (เพิ่ม/ลบ รวม LINE OA)
// Body: { userId, pageIds: string[] }  → แทนที่สิทธิ์เพจของ owner ทั้งหมด
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const g = assertOwner(ctx)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    const { userId, pageIds } = await req.json()
    if (!userId || !Array.isArray(pageIds)) {
      return NextResponse.json({ error: 'Missing userId or pageIds' }, { status: 400 })
    }
    if (userId === ctx.userId) {
      return NextResponse.json({ error: 'แก้สิทธิ์ตัวเองไม่ได้' }, { status: 400 })
    }

    const ownedIds = Array.from(ctx.ownedPageIds)
    const valid = (pageIds as string[]).filter(id => ctx.ownedPageIds.has(id))

    const sb = supabaseAdmin()
    // ลบสิทธิ์เดิม (เฉพาะเพจของ owner, ไม่แตะ row owner)
    const { error: delErr } = await sb
      .from('page_members')
      .delete()
      .eq('user_id', userId)
      .in('page_id', ownedIds)
      .neq('role', 'owner')
    if (delErr) throw delErr

    // ใส่สิทธิ์ใหม่
    if (valid.length > 0) {
      const rows = valid.map(pid => ({ user_id: userId, page_id: pid, role: 'agent', invited_by: ctx.userId }))
      const { error: insErr } = await sb
        .from('page_members')
        .upsert(rows, { onConflict: 'user_id,page_id', ignoreDuplicates: true })
      if (insErr) throw insErr
    }

    return NextResponse.json({ success: true, count: valid.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const g = assertOwner(ctx)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    const { searchParams } = new URL(req.url)
    const memberUserId = searchParams.get('userId')
    const pageId = searchParams.get('pageId')

    if (!memberUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    if (memberUserId === ctx.userId) {
      return NextResponse.json({ error: 'ลบตัวเองไม่ได้' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const ownedIds = Array.from(ctx.ownedPageIds)

    let q = sb
      .from('page_members')
      .delete()
      .eq('user_id', memberUserId)
      .in('page_id', ownedIds)
      .neq('role', 'owner')  // ห้ามลบ owner row

    if (pageId) q = q.eq('page_id', pageId)

    const { error } = await q
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
