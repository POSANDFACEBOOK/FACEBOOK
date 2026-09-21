import FacebookProvider from 'next-auth/providers/facebook'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'

const FB_API = 'https://graph.facebook.com/v19.0'

/**
 * รหัสบอกว่า "ต่อฐานข้อมูลไม่ได้" — คนละเรื่องกับ "อีเมล/รหัสผ่านไม่ถูกต้อง"
 * authorize ที่ throw Error จะถูก next-auth ส่งกลับเป็น res.error = ข้อความนี้ (v4: callback.ts → ?error=<message>)
 * หน้า /login แปลงเป็นข้อความไทย "ระบบขัดข้อง ลองใหม่อีกครั้ง" ได้ (ยังไม่ทำ = ขึ้นข้อความรวมเหมือนเดิม ไม่เสียหาย)
 * ห้ามใส่ข้อความไทยตรงๆ ตรงนี้ เพราะมันถูกยัดใน query string
 */
const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'

/**
 * Credentials authorize: ใช้กับ agent ที่ owner ตั้ง email + password ให้
 *
 * Flow:
 * 1. ลอง match กับ users ที่ email_lower + password_hash ตรง → login
 * 2. ถ้าไม่เจอ user แต่มี pending invitation (invitee_email_lower + initial_password_hash ตรง)
 *    → activate: create/update user, mark invitation accepted, add page_members → login
 * 3. ไม่ match → return null (login fail)
 * 4. อ่านฐานข้อมูลไม่ได้ → throw SERVICE_UNAVAILABLE (ห้ามคืน null เพราะจะกลายเป็น "รหัสผ่านผิด")
 */
async function authorizeCredentials(creds: any): Promise<{ id: string; name: string; email: string } | null> {
  if (!creds?.email || !creds?.password) return null
  const email = String(creds.email).trim().toLowerCase()
  const password = String(creds.password).trim()
  if (!email || !password) return null

  try {
    const sb = supabaseAdmin()

    // 1) Existing user lookup
    const { data: user, error: userErr } = await sb
      .from('users')
      .select('id, name, email, facebook_id, password_hash')
      .eq('email_lower', email)
      .maybeSingle()
    // ฐานข้อมูลสะดุด ≠ ไม่มีบัญชีนี้ — ถ้ากลืน error จะหลุดไปทาง invitation แล้วฟ้องว่า "รหัสผ่านไม่ถูกต้อง"
    if (userErr) {
      console.error('[authorizeCredentials] users lookup failed (DB):', userErr.message)
      throw new Error(SERVICE_UNAVAILABLE)
    }

    if (user?.password_hash) {
      const ok = await bcrypt.compare(password, user.password_hash)
      if (ok) {
        return { id: user.id, name: user.name || user.email || email, email: user.email || email }
      }
      // Wrong password — ห้าม fall through ไปทาง invitation (กัน brute-force ขโมยบัญชี)
      return null
    }

    // Security: ถ้า email ตรงกับ FB user ที่มีอยู่ → refuse credentials activation
    // (ป้องกัน account takeover ผ่านการ invite email ของคนอื่น)
    if (user?.facebook_id) {
      console.warn('[authorizeCredentials] refused — email belongs to FB user:', email)
      return null
    }

    // 2) Pending invitation lookup
    const { data: inv, error: invErr } = await sb
      .from('team_invitations')
      .select('id, owner_user_id, role, page_ids, invitee_email, invitee_name, initial_password_hash, expires_at')
      .eq('invitee_email_lower', email)
      .eq('auth_method', 'credentials')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    // อ่านคำเชิญไม่ได้ ≠ ไม่มีคำเชิญ — คำเชิญยังอยู่ครบ ห้ามบอกลูกทีมว่ารหัสผ่านผิด (เจ้าของร้านจะยกเลิกคำเชิญทิ้งเปล่าๆ)
    if (invErr) {
      console.error('[authorizeCredentials] invitation lookup failed (DB):', invErr.message)
      throw new Error(SERVICE_UNAVAILABLE)
    }

    if (!inv?.initial_password_hash) return null

    const okInv = await bcrypt.compare(password, inv.initial_password_hash)
    if (!okInv) return null

    // 2.5) ให้สิทธิ์เฉพาะเพจที่ "คนเชิญ" ยังเป็นเจ้าของอยู่จริง
    // เช็คก่อนสร้าง user เพื่อให้คำเชิญที่ใช้ไม่ได้ ไม่ทิ้งบัญชีค้างไว้ในระบบ
    // (เจ้าของถอดเพจออกหลังส่งคำเชิญ / แถวคำเชิญถูกใส่มาจากทางอื่น)
    const requestedPageIds: string[] = inv.page_ids || []
    let allowedPageIds: string[] = []
    if (requestedPageIds.length > 0) {
      const { data: ownerPages, error: ownerErr } = await sb
        .from('page_members')
        .select('page_id')
        .eq('user_id', inv.owner_user_id)
        .eq('role', 'owner')
        .in('page_id', requestedPageIds)
      // เช็คสิทธิ์ไม่สำเร็จ ≠ คนเชิญไม่ได้เป็นเจ้าของเพจแล้ว (route accept ก็ตอบ 503 แบบเดียวกัน)
      // ถ้าปล่อยเป็น [] จะตกไปที่ length === 0 → ลูกทีมเห็นว่า "รหัสผ่านไม่ถูกต้อง" ทั้งที่คำเชิญยังใช้ได้
      if (ownerErr) {
        console.error('[authorizeCredentials] owner page check failed (DB):', ownerErr.message)
        throw new Error(SERVICE_UNAVAILABLE)
      }
      allowedPageIds = (ownerPages || []).map((r: any) => r.page_id)
    }
    if (allowedPageIds.length === 0) {
      console.warn('[authorizeCredentials] refused — inviter no longer owns invited pages:', inv.id)
      return null
    }

    // 3) Activate invitation
    let userId: string
    if (user) {
      userId = user.id
      await sb
        .from('users')
        .update({
          password_hash: inv.initial_password_hash,
          email_lower: email,
          email: user.email || inv.invitee_email,
          name: user.name || inv.invitee_name || email,
        })
        .eq('id', userId)
    } else {
      const { data: created, error: createErr } = await sb
        .from('users')
        .insert({
          name: inv.invitee_name || email,
          email: inv.invitee_email || email,
          email_lower: email,
          password_hash: inv.initial_password_hash,
        })
        .select('id, name, email')
        .single()
      if (createErr || !created) {
        console.error('[authorizeCredentials] create user failed:', createErr?.message)
        return null
      }
      userId = created.id
    }

    // 4) Add page_members (เฉพาะเพจที่กรองไว้ในข้อ 2.5)
    const rows = allowedPageIds.map((pid: string) => ({
      user_id: userId,
      page_id: pid,
      role: inv.role,
      invited_by: inv.owner_user_id,
    }))
    const { error: memErr } = await sb
      .from('page_members')
      .upsert(rows, { onConflict: 'user_id,page_id', ignoreDuplicates: true })
    if (memErr) console.error('[authorizeCredentials] page_members upsert failed:', memErr.message)

    // 5) Mark invitation accepted (atomic flip)
    await sb
      .from('team_invitations')
      .update({ accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq('id', inv.id)
      .is('accepted_at', null)

    return { id: userId, name: inv.invitee_name || email, email: inv.invitee_email || email }
  } catch (e: any) {
    console.error('[authorizeCredentials] threw:', e?.message)
    // ระบบขัดข้องต้องส่งต่อให้หน้า login แยกแยะได้ ส่วน error อื่นยังปิดเงียบเป็น "login ไม่ผ่าน" เหมือนเดิม
    if (e?.message === SERVICE_UNAVAILABLE) throw e
    return null
  }
}

/**
 * กัน "ยิง Facebook ทุก request" เมื่อ token ตายแล้ว
 * jwt callback ที่ถูกเรียกจาก API route เขียน cookie กลับไม่ได้ (next-auth ตัดทิ้ง)
 * → ถ้า exchange ล้ม แล้วไม่จำไว้ ทุก request (poll ทุก 7 วิ) จะรอ Graph API ใหม่ทุกครั้ง
 * จำไว้ใน memory ของ instance (Vercel ใช้ instance ซ้ำหลาย request) — cold start แล้วลองใหม่เองได้
 */
const EXCHANGE_COOLDOWN_MS = 6 * 60 * 60 * 1000
const exchangeCooldown = new Map<string, number>()

function exchangeKey(token: string): string {
  return token.slice(-16)
}
function inExchangeCooldown(key: string): boolean {
  const until = exchangeCooldown.get(key)
  if (!until) return false
  if (Date.now() >= until) {
    exchangeCooldown.delete(key)
    return false
  }
  return true
}
function startExchangeCooldown(key: string) {
  if (exchangeCooldown.size > 200) exchangeCooldown.clear()  // กัน map โตไม่จำกัด
  exchangeCooldown.set(key, Date.now() + EXCHANGE_COOLDOWN_MS)
}

async function exchangeForLongLivedToken(
  shortLivedToken: string,
  timeoutMs = 5000,
): Promise<string | null> {
  if (!shortLivedToken) {
    console.error('[auth] exchange skipped — empty token')
    return null
  }
  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
    console.error('[auth] exchange aborted — missing FACEBOOK_CLIENT_ID/SECRET')
    return null
  }
  try {
    const url = `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    const data = await res.json()
    if (data.error) {
      console.error('[auth] exchange FB error:', JSON.stringify(data.error).slice(0, 400))
      return null
    }
    if (!data.access_token) {
      console.error('[auth] exchange no access_token in response:', JSON.stringify(data).slice(0, 300))
      return null
    }
    console.log(`[auth] exchange OK — long-lived token (expires_in=${data.expires_in})`)
    return data.access_token as string
  } catch (e: any) {
    console.error('[auth] exchange threw:', e?.name, e?.message)
    return null
  }
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'business_management,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging',
        },
      },
      // 🎯 Override userinfo + fallback ทน rate limit
      // 1. ลอง /v19.0/me + access_token query param (ไม่ใช้ Bearer header
      //    เพราะ FB ตอบ 403 Forbidden กับ default ของ next-auth v4.24.7)
      // 2. ถ้า fail (เช่น FB rate limit #4) → fallback ใช้ debug_token
      //    ผ่าน APP_TOKEN (server-server, ไม่กิน user rate limit) เพื่อ
      //    เอาแค่ user_id → NextAuth ก็ create session ได้ profile name
      //    จะ fetch ทีหลังตอน user เปิด dashboard ผ่าน useSession()
      userinfo: {
        url: 'https://graph.facebook.com/v19.0/me',
        params: { fields: 'id,name,email,picture' },
        async request({ tokens, provider }: any) {
          // เก็บ diagnostic ใน throw message ตรงๆ (console.error ไม่ถึง Vercel logs)
          const diag: string[] = []
          const tokenLen = String(tokens.access_token || '').length
          diag.push(`tokenLen=${tokenLen}`)

          // 1. /me + access_token query param
          try {
            const u = new URL(provider.userinfo.url)
            for (const [k, v] of Object.entries(provider.userinfo.params || {})) {
              u.searchParams.set(k, String(v))
            }
            u.searchParams.set('access_token', tokens.access_token)
            const r = await fetch(u.toString())
            const body = await r.text()
            if (r.ok) return JSON.parse(body)
            diag.push(`/me=${r.status}:${body.slice(0, 100)}`)
          } catch (e: any) {
            diag.push(`/me_threw=${e?.message?.slice(0, 80)}`)
          }

          // 2. debug_token ผ่าน APP_TOKEN
          try {
            const appToken = `${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`
            const dr = await fetch(
              `https://graph.facebook.com/v19.0/debug_token?input_token=${tokens.access_token}&access_token=${appToken}`
            )
            const dbody = await dr.text()
            if (dr.ok) {
              const dj = JSON.parse(dbody)
              const userId = dj?.data?.user_id
              if (userId) return { id: String(userId), name: 'User', email: null, picture: null }
              diag.push(`dt_no_user_id:${dbody.slice(0, 100)}`)
            } else {
              diag.push(`dt=${dr.status}:${dbody.slice(0, 100)}`)
            }
          } catch (e: any) {
            diag.push(`dt_threw=${e?.message?.slice(0, 80)}`)
          }

          // 3. /me?access_token=APP|USER (appsecret_proof bypass attempt)
          try {
            const appToken = `${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`
            const ir = await fetch(
              `https://graph.facebook.com/v19.0/me?fields=id&access_token=${encodeURIComponent(appToken + '|' + tokens.access_token)}`
            )
            const ibody = await ir.text()
            if (ir.ok) {
              const ij = JSON.parse(ibody)
              if (ij?.id) return { id: ij.id, name: 'User', email: null, picture: null }
            }
            diag.push(`me_proof=${ir.status}:${ibody.slice(0, 100)}`)
          } catch (e: any) {
            diag.push(`me_proof_threw=${e?.message?.slice(0, 80)}`)
          }

          // ทุกวิธีล้ม → throw พร้อม diagnostic ในตัว message
          throw new Error(`FB userinfo failed: ${diag.join(' | ')}`)
        },
      },
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email + Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizeCredentials,
    }),
  ],
  session: { strategy: 'jwt' as const, maxAge: 60 * 24 * 60 * 60 },
  callbacks: {
    async session({ session, token }: any) {
      session.accessToken = token?.accessToken
      session.fbUserId = token?.fbUserId
      // userId เก็บไว้สำหรับ credentials user (และ owner FB ก็ใส่ได้ถ้ามี)
      session.userId = token?.userId
      session.provider = token?.provider
      if (session.user) {
        session.user.id = token?.userId || token?.fbUserId
      }
      return session
    },
    async jwt({ token, account, profile, user }: any) {
      try {
        // Initial login: detect provider
        if (account?.provider === 'credentials' && user) {
          // user object มาจาก authorizeCredentials → { id, name, email }
          token.provider = 'credentials'
          token.userId = user.id
          token.name = user.name
          token.email = user.email
          return token
        }

        // Initial Facebook login → save short-lived ทันที + mark needsExchange
        // ห้าม await exchange ที่นี่ — เคย break OAuth callback ใน timeout
        if (account?.access_token) {
          token.provider = 'facebook'
          token.accessToken = account.access_token
          token.tokenIssuedAt = Date.now()
          token.needsExchange = true
          // FB user_id มาจาก OAuth → เก็บไว้ ไม่ต้อง call /me ทุก request
          token.fbUserId = account.providerAccountId || (profile as any)?.id
          return token
        }

        // Credentials session refresh → ไม่ต้องทำอะไร แค่ pass through
        if (token?.provider === 'credentials') {
          return token
        }

        // ถ้ายังไม่ได้ exchange (ครั้งแรก fail) → ลองใหม่ (เว้นช่วงถ้าเพิ่งล้มไป)
        if (token?.needsExchange && token?.accessToken) {
          const key = exchangeKey(token.accessToken as string)
          if (!inExchangeCooldown(key)) {
            const longLived = await exchangeForLongLivedToken(token.accessToken as string, 5000)
            if (longLived) {
              exchangeCooldown.delete(key)
              token.accessToken = longLived
              token.tokenIssuedAt = Date.now()
              token.needsExchange = false
            } else {
              startExchangeCooldown(key)
            }
          }
        }

        // Auto-refresh ทุก 25 วัน เพื่อ extend long-lived token
        const REFRESH_AFTER_MS = 25 * 24 * 60 * 60 * 1000
        if (!token?.needsExchange && token?.accessToken && token?.tokenIssuedAt) {
          const age = Date.now() - (token.tokenIssuedAt as number)
          const key = exchangeKey(token.accessToken as string)
          if (age > REFRESH_AFTER_MS && !inExchangeCooldown(key)) {
            const refreshed = await exchangeForLongLivedToken(token.accessToken as string, 5000)
            if (refreshed) {
              exchangeCooldown.delete(key)
              token.accessToken = refreshed
              token.tokenIssuedAt = Date.now()
            } else {
              // token หมดอายุ/ถูกเพิกถอน → แอปยังทำงานด้วย page token เดิม
              // แต่ห้ามยิง Graph ซ้ำทุก request (แชทจะหน่วงทุกครั้งที่ poll)
              startExchangeCooldown(key)
            }
          }
        }
        return token
      } catch (e: any) {
        console.error('[auth.jwt] threw:', e?.message)
        return token
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  debug: true,
  events: {
    async signIn(msg: any) {
      console.log('[auth.events.signIn]', { provider: msg?.account?.provider, userId: msg?.user?.id || msg?.profile?.id })
    },
  },
  logger: {
    error(code: string, metadata: any) {
      const err = metadata?.error || metadata
      console.error('[NextAuth.error]', JSON.stringify({
        code,
        name: err?.name,
        message: err?.message,
        stack: err?.stack?.toString().slice(0, 600),
      }))
    },
    warn(code: string) {
      console.warn('[NextAuth.warn]', code)
    },
  },
}
