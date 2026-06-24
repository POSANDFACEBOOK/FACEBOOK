// POST /api/team/reset-password — owner ตั้ง/รีเซ็ตรหัสผ่านแอดมิน
// Body: { invitationId?, memberUserId?, password }
//  - invitationId  → แอดมินที่ยังไม่ได้ login (อัปเดต initial_password_hash ของคำเชิญ)
//  - memberUserId  → แอดมินที่ login แล้ว (อัปเดต users.password_hash)
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertOwner } from '@/lib/team'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const g = assertOwner(ctx)
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

    const body = await req.json().catch(() => ({}))
    const password = typeof body.password === 'string' ? body.password.trim() : ''
    if (password.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const hash = await bcrypt.hash(password, 10)
    const ownedIds = Array.from(ctx.ownedPageIds)

    // ── กรณีคำเชิญที่ยังไม่ได้ใช้ ──
    if (body.invitationId) {
      const { data: inv } = await sb
        .from('team_invitations')
        .select('id, owner_user_id, auth_method, accepted_at')
        .eq('id', body.invitationId)
        .single()
      if (!inv || inv.owner_user_id !== ctx.userId) {
        return NextResponse.json({ error: 'ไม่พบคำเชิญ' }, { status: 404 })
      }
      if (inv.auth_method !== 'credentials') {
        return NextResponse.json({ error: 'คำเชิญนี้ไม่ใช่แบบ email + รหัสผ่าน' }, { status: 400 })
      }
      const { error } = await sb
        .from('team_invitations')
        .update({ initial_password_hash: hash })
        .eq('id', inv.id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── กรณีแอดมินที่ login แล้ว (เป็น member ของเพจเรา) ──
    if (body.memberUserId) {
      if (body.memberUserId === ctx.userId) {
        return NextResponse.json({ error: 'รีเซ็ตรหัสตัวเองทางนี้ไม่ได้' }, { status: 400 })
      }
      // ยืนยันว่า user นี้เป็น member ของเพจที่เราเป็นเจ้าของ
      const { data: mem } = await sb
        .from('page_members')
        .select('id')
        .eq('user_id', body.memberUserId)
        .in('page_id', ownedIds)
        .limit(1)
      if (!mem || mem.length === 0) {
        return NextResponse.json({ error: 'ไม่พบแอดมินคนนี้ในทีมของคุณ' }, { status: 404 })
      }
      // ต้องเป็น user แบบ credentials (ไม่มี facebook_id) — กันรีเซ็ต FB user
      const { data: u } = await sb
        .from('users')
        .select('id, facebook_id')
        .eq('id', body.memberUserId)
        .single()
      if (!u) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })
      if (u.facebook_id) {
        return NextResponse.json({ error: 'แอดมินคนนี้ login ด้วย Facebook — ตั้งรหัสผ่านไม่ได้' }, { status: 400 })
      }
      const { error } = await sb
        .from('users')
        .update({ password_hash: hash })
        .eq('id', body.memberUserId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'ต้องระบุ invitationId หรือ memberUserId' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
