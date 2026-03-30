import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '../auth/[...nextauth]/route'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ pages: [] })
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture.type(large)&access_token=${session.accessToken}`
  )
  const data = await res.json()

  if (data.error) {
    return NextResponse.json({ error: data.error.message, pages: [] })
  }

  return NextResponse.json({ pages: data.data || [] })
}