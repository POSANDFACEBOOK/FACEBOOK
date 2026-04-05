import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ pages: [] })
    }

    const FB = 'https://graph.facebook.com/v19.0'
    const token = session.accessToken as string
    const fields = 'id,name,access_token,picture.type(large),category,fan_count,followers_count,tasks'
    const pageMap = new Map<string, any>()

    // Method 1: /me/accounts (standard — returns pages user has roles on)
    try {
      const firstRes = await fetch(`${FB}/me/accounts?fields=${fields}&limit=100&access_token=${token}`)
      const firstData = await firstRes.json()
      if (!firstData.error) {
        for (const p of (firstData.data || [])) {
          pageMap.set(p.id, p)
        }
        // Follow pagination
        let nextCursor: string | undefined = firstData.paging?.next
        while (nextCursor) {
          const pageRes = await fetch(nextCursor)
          const pageData = await pageRes.json()
          if (pageData.error) break
          for (const p of (pageData.data || [])) {
            pageMap.set(p.id, p)
          }
          nextCursor = pageData.paging?.next
        }
      }
    } catch {}

    // Method 2: /me/businesses → each business's pages
    try {
      const bizRes = await fetch(`${FB}/me/businesses?fields=id,name&limit=50&access_token=${token}`)
      const bizData = await bizRes.json()
      if (!bizData.error && bizData.data?.length) {
        for (const biz of bizData.data) {
          try {
            const bpRes = await fetch(
              `${FB}/${biz.id}/owned_pages?fields=${fields}&limit=100&access_token=${token}`
            )
            const bpData = await bpRes.json()
            if (!bpData.error) {
              for (const p of (bpData.data || [])) {
                if (!pageMap.has(p.id)) pageMap.set(p.id, p)
              }
            }
          } catch {}

          // Also try client_pages (pages shared with business but not owned)
          try {
            const cpRes = await fetch(
              `${FB}/${biz.id}/client_pages?fields=${fields}&limit=100&access_token=${token}`
            )
            const cpData = await cpRes.json()
            if (!cpData.error) {
              for (const p of (cpData.data || [])) {
                if (!pageMap.has(p.id)) pageMap.set(p.id, p)
              }
            }
          } catch {}
        }
      }
    } catch {}

    return NextResponse.json({ pages: Array.from(pageMap.values()) })
  } catch (err: any) {
    return NextResponse.json({ pages: [] })
  }
}
