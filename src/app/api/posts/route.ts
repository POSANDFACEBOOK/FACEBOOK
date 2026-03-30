import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const pageId = searchParams.get('pageId')
  const pageToken = searchParams.get('pageToken')

  if (!pageId || !pageToken) {
    return NextResponse.json({ error: 'Missing pageId or pageToken' }, { status: 400 })
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,story,full_picture,created_time,reactions.summary(true)&limit=20&access_token=${pageToken}`
  )
  const data = await res.json()

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 500 })
  }

  return NextResponse.json({ posts: data.data || [] })
}