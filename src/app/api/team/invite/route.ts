// POST /api/team/invite
// Body: {
//   pageIds: string[],
//   note?: string,
//   authMethod?: 'facebook' | 'credentials',  // default 'credentials' (recommended)
//   inviteeEmail?: string,                    // required ถ้า credentials
//   inviteeName?: string                      // required ถ้า credentials
// }
// Owner เท่านั้น — สร้าง invitation 7 วัน
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUserContext, assertPageAccess } from '@/lib/team'

export const dynamic = 'force-dynamic'

const INVITE_DAYS = 7

/** สร้าง random password 12 ตัว — มี a-z A-Z 0-9 (no ambiguous chars) */
function generatePassword(len = 12): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i] % chars.length]
  }
  return out
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await getCurrentUserContext(session)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const pageIds: string[] = Array.isArray(body.pageIds) ? body.pageIds : []
    const note: string | undefined = typeof body.note === 'string' ? body.note.slice(0, 200) : undefined
    const authMethod: 'facebook' | 'credentials' = body.authMethod === 'facebook' ? 'facebook' : 'credentials'

    if (pageIds.length === 0) {
      return NextResponse.json({ error: 'ต้องเลือกอย่างน้อย 1 เพจ' }, { status: 400 })
    }

    for (const pid of pageIds) {
      const g = assertPageAccess(ctx, pid, 'owner')
      if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000)

    // Common fields
    const insertRow: any = {
      owner_user_id: ctx.userId,
      token,
      role: 'agent',
      page_ids: pageIds,
      note: note || null,
      expires_at: expiresAt.toISOString(),
      auth_method: authMethod,
    }

    let plainPassword: string | undefined

    if (authMethod === 'credentials') {
      const inviteeEmail = typeof body.inviteeEmail === 'string' ? body.inviteeEmail.trim() : ''
      const inviteeName = typeof body.inviteeName === 'string' ? body.inviteeName.trim() : ''

      if (!inviteeEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteeEmail)) {
        return NextResponse.json({ error: 'กรุณากรอก email ของแอดมินให้ถูกต้อง' }, { status: 400 })
      }
      if (!inviteeName) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อแอดมิน' }, { status: 400 })
      }

      const emailLower = inviteeEmail.toLowerCase()
      const sb = supabaseAdmin()

      // Security: ห้ามเชิญ email ที่ตรงกับ FB user ใดๆ ในระบบ
      // (กัน account takeover — ดู authorizeCredentials)
      const { data: collidingUser } = await sb
        .from('users')
        .select('id, facebook_id')
        .eq('email_lower', emailLower)
        .maybeSingle()
      if (collidingUser?.facebook_id) {
        return NextResponse.json({
          error: 'Email นี้ผูกกับ Facebook account อยู่แล้ว — กรุณาใช้ email อื่นที่ไม่ผูกกับ FB',
        }, { status: 409 })
      }

      // ตรวจสอบว่า email นี้มี pending invitation อยู่แล้วไหม
      const { data: existingInv } = await sb
        .from('team_invitations')
        .select('id')
        .eq('owner_user_id', ctx.userId)
        .eq('invitee_email_lower', emailLower)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (existingInv) {
        return NextResponse.json({
          error: 'มีคำเชิญที่ยังไม่หมดอายุของ email นี้อยู่แล้ว — ยกเลิกอันเดิมก่อนหรือใช้ email อื่น',
        }, { status: 409 })
      }

      plainPassword = generatePassword(12)
      const passwordHash = await bcrypt.hash(plainPassword, 10)

      insertRow.invitee_email = inviteeEmail
      insertRow.invitee_email_lower = emailLower
      insertRow.invitee_name = inviteeName
      insertRow.initial_password_hash = passwordHash
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('team_invitations')
      .insert(insertRow)
      .select('id, token, expires_at, page_ids, role, note, auth_method, invitee_email, invitee_name, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      invitation: data,
      // FB invite: url สำหรับให้คลิกผ่าน FB OAuth
      // Credentials invite: ส่ง plainPassword ครั้งเดียวให้ owner copy → ใช้ login ที่ /login
      url: authMethod === 'facebook' ? `/invite/${token}` : null,
      credentials: authMethod === 'credentials' ? {
        loginUrl: '/login',
        email: insertRow.invitee_email,
        password: plainPassword,
      } : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
