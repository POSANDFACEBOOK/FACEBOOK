import FacebookProvider from 'next-auth/providers/facebook'

export const authOptions = {
  // ตั้ง secret + URL อย่างชัดเจน — ห้ามพึ่ง auto-detect ของ NextAuth
  secret: process.env.NEXTAUTH_SECRET,
  // บังคับ secure cookies เพราะ deploy บน Vercel = HTTPS เสมอ
  useSecureCookies: true,
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      // ใช้ Graph API v19 แทน v11 (default ของ next-auth v4) ที่ FB เริ่ม
      // คืน 400 บาง endpoint ในปลายปี 2024+
      token: 'https://graph.facebook.com/v19.0/oauth/access_token',
      userinfo: 'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture',
      authorization: {
        url: 'https://www.facebook.com/v19.0/dialog/oauth',
        params: {
          scope: 'business_management,ads_management,ads_read,pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_metadata,pages_manage_posts,pages_messaging',
          // ตั้งใจไม่ใส่ redirect_uri + auth_type='rerequest':
          // - redirect_uri: ปล่อยให้ NextAuth derive จาก request เอง
          //   (ถ้า hardcode แล้ว NEXTAUTH_URL มี whitespace/scheme ไม่ตรง 100%
          //   → byte-mismatch ระหว่าง /authorize กับ /access_token → OAuthCallback)
          // - rerequest: ถ้า user ไม่เคย decline permissions มาก่อน FB อาจ
          //   reject request → OAuthCallback
        },
      },
    }),
  ],
  session: { strategy: 'jwt' as const, maxAge: 60 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      console.log('[auth.signIn]', {
        provider: account?.provider,
        userId: user?.id || profile?.id,
        hasAccessToken: !!account?.access_token,
      })
      return true
    },
    async session({ session, token }: any) {
      session.accessToken = token?.accessToken
      return session
    },
    async jwt({ token, account }: any) {
      if (account?.access_token) {
        token.accessToken = account.access_token
        token.tokenIssuedAt = Date.now()
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
  },
  debug: true,
  logger: {
    error(code: string, metadata: any) {
      // ดึงรายละเอียดแบบเต็ม — JSON.stringify Error object จะตกหล่น
      const err = metadata?.error || metadata
      const out = {
        code,
        name: err?.name,
        message: err?.message,
        stack: err?.stack?.toString().slice(0, 600),
        providerId: metadata?.providerId,
        meta: typeof metadata === 'object' ? Object.keys(metadata) : null,
      }
      console.error('[NextAuth.error]', JSON.stringify(out))
    },
    warn(code: string) {
      console.warn('[NextAuth.warn]', code)
    },
  },
}
