import FacebookProvider from 'next-auth/providers/facebook'

const FB_API = 'https://graph.facebook.com/v19.0'

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string | null> {
  if (!shortLivedToken) {
    console.error('[auth] exchange skipped: empty short-lived token')
    return null
  }
  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
    console.error('[auth] exchange aborted: FACEBOOK_CLIENT_ID/SECRET env not set on this deployment')
    return null
  }
  try {
    const url = `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    const data = await res.json()
    if (data.error) {
      console.error('[auth] FB exchange returned error:', JSON.stringify(data.error))
      return null
    }
    if (!data.access_token) {
      console.error('[auth] FB exchange: no access_token in response:', JSON.stringify(data).slice(0, 300))
      return null
    }
    console.log(`[auth] exchange success — long-lived token received (expires_in=${data.expires_in})`)
    return data.access_token as string
  } catch (e: any) {
    console.error('[auth] exchange threw:', e?.name, e?.message)
    return null
  }
}

export const authOptions = {
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'business_management,ads_management,ads_read,pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_metadata,pages_manage_posts,pages_messaging',
          // ตั้งใจไม่ใส่ auth_type='rerequest' และ redirect_uri ตรงๆ:
          // - rerequest บังคับ FB ขอ permissions ใหม่ทุกครั้ง อาจ trigger
          //   error เมื่อ user เคยให้สิทธิ์แล้ว
          // - redirect_uri ปล่อยให้ NextAuth auto-detect จาก request
          //   (เพิ่มเข้าไปจะ error=OAuthCallback ถ้า NEXTAUTH_URL ไม่ตรง 100%)
        },
      },
    }),
  ],
  session: { strategy: 'jwt' as const, maxAge: 60 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      console.log('[auth.callbacks.signIn]', {
        provider: account?.provider,
        type: account?.type,
        userId: user?.id,
        hasAccessToken: !!account?.access_token,
      })
      return true
    },
    async session({ session, token }: any) {
      try {
        session.accessToken = token?.accessToken
        return session
      } catch (e: any) {
        console.error('[auth.callbacks.session] threw:', e?.message)
        return session
      }
    },
    async jwt({ token, account }: any) {
      try {
        // Initial login → save short-lived ONLY (no exchange ที่นี่)
        // เหตุผล: OAuth callback มี time budget จำกัด (~10s บน Vercel Hobby)
        // ถ้า await exchange แล้ว FB API ช้า/ล่ม → callback fail → error=OAuthCallback
        // จะ exchange ใน jwt call ถัดไปแทน (ตอน user เปิด dashboard)
        if (account?.access_token) {
          token.accessToken = account.access_token
          token.tokenIssuedAt = Date.now()
          token.needsExchange = true
          return token
        }

        // ครั้งถัดๆ ไป — ถ้าเป็น short-lived อยู่ ลอง exchange เป็น long-lived
        if (token?.needsExchange && token?.accessToken) {
          const longLived = await exchangeForLongLivedToken(token.accessToken as string)
          if (longLived) {
            token.accessToken = longLived
            token.tokenIssuedAt = Date.now()
            token.needsExchange = false
          }
          // ถ้า fail → ปล่อยไว้ ลองใหม่ครั้งหน้า (token เดิมยังใช้ได้ 1-2 ชม.)
        }

        // Auto-refresh ถ้า token เก่ากว่า 25 วัน (rolling window)
        const REFRESH_AFTER_MS = 25 * 24 * 60 * 60 * 1000
        if (!token?.needsExchange && token?.accessToken && token?.tokenIssuedAt) {
          const age = Date.now() - (token.tokenIssuedAt as number)
          if (age > REFRESH_AFTER_MS) {
            const refreshed = await exchangeForLongLivedToken(token.accessToken as string)
            if (refreshed) {
              token.accessToken = refreshed
              token.tokenIssuedAt = Date.now()
            }
          }
        }
        return token
      } catch (e: any) {
        console.error('[auth.callbacks.jwt] threw:', e?.message, e?.stack?.slice(0, 400))
        return token  // ส่ง token เดิมกลับ ห้าม throw — ป้องกัน OAuth callback fail
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  // ─── Debug & error visibility ────────────────────────────────
  // เพิ่ม events handler เพื่อ log error ตัวจริงใน Vercel logs
  // (error=OAuthCallback ใน URL ไม่บอกอะไรเลย ต้องอ่าน server log)
  debug: true,
  events: {
    async signIn(message: any) {
      console.log('[auth.events.signIn]', { user: message?.user?.email || message?.user?.name, account: message?.account?.provider })
    },
    async signOut() {
      console.log('[auth.events.signOut]')
    },
  },
  logger: {
    error(code: string, metadata: any) {
      console.error('[auth.logger.error]', code, JSON.stringify(metadata)?.slice(0, 600))
    },
    warn(code: string) {
      console.warn('[auth.logger.warn]', code)
    },
  },
}
