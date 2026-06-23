// Team / Roles helper
// ─────────────────────────────────────────────────────────────
// ทุก API route ใช้ getCurrentUserContext(session) ครั้งเดียวต้นทาง
// แทนการใช้ getUserIdFromFbToken + .eq('user_id', userId) แบบเดี่ยวๆ
//
// page_members.role: 'owner' | 'agent'
// - owner = เจ้าของ workspace (เชื่อมเพจ, ยิงแอด, จัดการทีม, ตอบแชท)
// - agent = ลูกทีม (เฉพาะตอบแชท + ใช้ AI/quick replies ของ owner)
//
// Auth methods รองรับ 2 แบบ:
// - facebook: session.accessToken + session.fbUserId → users.facebook_id
// - credentials: session.userId → users.id (สำหรับ agent ที่ใช้ email+password)

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin, getUserIdFromFbToken } from './supabase'

export type Role = 'owner' | 'agent'

export interface Membership {
  pageId: string         // connected_pages.id
  role: Role
  ownerUserId: string    // เจ้าของเพจ (connected_pages.user_id)
}

export interface UserContext {
  /** users.id ของผู้ใช้ที่ login เข้ามา (อาจเป็น owner หรือ agent) */
  userId: string
  /** Facebook ID ของผู้ใช้ที่ login (ถ้ารู้) */
  fbUserId: string | null
  /** Auth method ที่ใช้ login */
  authMethod: 'facebook' | 'credentials'
  memberships: Membership[]
  /** Set page_id ที่ user เป็น owner */
  ownedPageIds: Set<string>
  /** Set page_id ทั้งหมดที่ user เข้าถึงได้ (owner + agent) */
  accessiblePageIds: Set<string>
  /** เป็น owner ของอย่างน้อย 1 เพจ */
  isOwner: boolean
  /** มี membership แต่ไม่ได้เป็น owner ของเพจไหนเลย */
  isAgentOnly: boolean
}

/**
 * โหลด context หลักจาก NextAuth session
 * - returns null ถ้าหา user ไม่เจอ
 * - รองรับทั้ง facebook session (session.accessToken) และ credentials session (session.userId)
 */
export async function getCurrentUserContext(session: any): Promise<UserContext | null> {
  if (!session) return null

  let userId: string | null = null
  let authMethod: 'facebook' | 'credentials' = 'facebook'
  let fbUserId: string | null = null

  if (session.userId) {
    // Credentials path — userId เก็บใน JWT ตอน sign in
    userId = String(session.userId)
    authMethod = 'credentials'
  } else if (session.accessToken) {
    // Facebook OAuth path
    authMethod = 'facebook'
    fbUserId = (session.fbUserId as string | undefined) || null
    userId = await getUserIdFromFbToken(session.accessToken as string, fbUserId)
  }

  if (!userId) return null

  const sb = supabaseAdmin()
  const { data } = await sb
    .from('page_members')
    .select('page_id, role, connected_pages!inner(user_id)')
    .eq('user_id', userId)

  const memberships: Membership[] = (data || []).map((r: any) => ({
    pageId: r.page_id,
    role: r.role as Role,
    ownerUserId: r.connected_pages?.user_id || '',
  }))

  const ownedPageIds = new Set(memberships.filter(m => m.role === 'owner').map(m => m.pageId))
  const accessiblePageIds = new Set(memberships.map(m => m.pageId))

  return {
    userId,
    fbUserId,
    authMethod,
    memberships,
    ownedPageIds,
    accessiblePageIds,
    isOwner: ownedPageIds.size > 0,
    isAgentOnly: memberships.length > 0 && ownedPageIds.size === 0,
  }
}

export type Guard =
  | { ok: true; role: Role }
  | { ok: false; error: string; status: number }

/** assert ว่า user เข้าถึงเพจนี้ได้ + optional ต้องเป็น owner */
export function assertPageAccess(
  ctx: UserContext,
  pageId: string,
  requiredRole?: Role,
): Guard {
  const m = ctx.memberships.find(x => x.pageId === pageId)
  if (!m) return { ok: false, error: 'ไม่มีสิทธิ์เข้าถึงเพจนี้', status: 403 }
  if (requiredRole === 'owner' && m.role !== 'owner') {
    return { ok: false, error: 'เฉพาะเจ้าของเพจเท่านั้น', status: 403 }
  }
  return { ok: true, role: m.role }
}

/** assert ว่า user เป็น owner ของอย่างน้อย 1 เพจ (สำหรับ owner-only routes) */
export function assertOwner(ctx: UserContext): Guard {
  if (!ctx.isOwner) {
    return { ok: false, error: 'เฉพาะเจ้าของเพจเท่านั้น', status: 403 }
  }
  return { ok: true, role: 'owner' }
}

/** หา ownerUserId ของเพจที่ user เข้าถึงได้ (สำหรับ upsert ที่ user_id ต้องเป็น owner) */
export function getOwnerUserIdOfPage(ctx: UserContext, pageId: string): string | null {
  return ctx.memberships.find(x => x.pageId === pageId)?.ownerUserId || null
}

/**
 * Helper: หา conversation พร้อม verify access
 * ใช้แทน pattern .eq('user_id', userId).single() ใน inbox routes
 * Returns row (with page join) หรือ null ถ้า not found / no access
 */
export async function getConversationIfAccessible(
  ctx: UserContext,
  conversationId: string,
  sb: SupabaseClient,
  select = '*',
) {
  const { data } = await sb
    .from('conversations')
    .select(`${select}, connected_pages!inner(id, page_id, page_name, page_picture, page_access_token, user_id)`)
    .eq('id', conversationId)
    .single()

  if (!data) return null
  const pageId = (data as any).page_id
  if (!ctx.accessiblePageIds.has(pageId)) return null
  return data
}
