// GET /api/pages — รายชื่อเพจ Facebook ที่ผู้ใช้ดูแลอยู่ (ใช้ในหน้า "ช่องทางแชท" ให้เลือกเพจมาเชื่อม)
// ไม่ส่ง page access token กลับไปที่ browser — การเชื่อมจริงทำฝั่ง server ใน /api/pages/connect
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { fetchManagedPages, canConnectPage } from '@/lib/fb-pages'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const token = (session as any)?.accessToken as string | undefined
    if (!session || !token) {
      return NextResponse.json({ pages: [], needsFacebookLogin: true })
    }

    const { pages: managed, tokenError } = await fetchManagedPages(token)
    const pages = Array.from(managed.values())
      .map(p => ({
        id: p.id,
        name: p.name || p.id,
        picture: p.picture?.data?.url || null,
        category: p.category || null,
        canConnect: canConnectPage(p),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))

    return NextResponse.json({ pages, tokenExpired: pages.length === 0 && !!tokenError })
  } catch {
    return NextResponse.json({ pages: [] })
  }
}
