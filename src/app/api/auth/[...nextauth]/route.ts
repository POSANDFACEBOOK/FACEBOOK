// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import FacebookProvider from 'next-auth/providers/facebook'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const handler = NextAuth({
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'email',
            'public_profile',
            'pages_show_list',
            'pages_manage_ads',
            'pages_read_engagement',
            'ads_management',
            'ads_read',
            'business_management',
          ].join(','),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'facebook' && account.access_token) {
        // Upsert user ลง Supabase
        await supabase.from('users').upsert({
          facebook_id: account.providerAccountId,
          name: user.name,
          email: user.email,
          image: user.image,
          access_token: account.access_token,
          token_expires_at: account.expires_at
            ? new Date(account.expires_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'facebook_id' })
      }
      return true
    },

    async session({ session, token }) {
      // เพิ่ม facebook data ลง session
      session.user.facebookId = token.sub as string
      session.user.accessToken = token.accessToken as string
      session.accessToken = token.accessToken as string
      return session
    },

    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 24 * 60 * 60, // 60 วัน
  },
})

export { handler as GET, handler as POST }
