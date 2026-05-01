import FacebookProvider from 'next-auth/providers/facebook'

export const authOptions = {
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'business_management,ads_management,ads_read,pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_metadata,pages_manage_posts,pages_messaging',
          auth_type: 'rerequest',
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/facebook`,
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }: any) {
      session.accessToken = token.accessToken
      return session
    },
    async jwt({ token, account }: any) {
      if (account) {
        token.accessToken = account.access_token
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
      console.error('[NextAuth.error]', code, JSON.stringify(metadata)?.slice(0, 800))
    },
    warn(code: string) {
      console.warn('[NextAuth.warn]', code)
    },
  },
}
