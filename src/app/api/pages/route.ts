import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${session.accessToken}`
  )
  const data = await res.json()

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 500 })
  }

  return NextResponse.json({ pages: data.data || [] })
}