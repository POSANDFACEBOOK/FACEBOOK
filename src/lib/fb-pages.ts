// รายชื่อเพจ Facebook ที่ผู้ใช้ดูแลอยู่จริง (ใช้ทั้งหน้าเลือกเพจ และตอนเชื่อมเพจฝั่ง server)
const FB = 'https://graph.facebook.com/v19.0'

export type FbManagedPage = {
  id: string
  name?: string
  access_token?: string
  category?: string
  tasks?: string[]
  picture?: { data?: { url?: string } }
}

// บทบาทที่ตอบแชทได้ — Advertiser/Analyst ได้ page token เหมือนกันแต่ไม่ควรเป็นคนเชื่อมเพจ
// (ถ้าเชื่อมไปก่อน เจ้าของตัวจริงจะเชื่อมไม่ได้เลย)
const CHAT_TASKS = ['MANAGE', 'MODERATE', 'MESSAGING']

/** เพจนี้เชื่อมเข้ากล่องข้อความได้ไหม
 * - ต้องมี page token
 * - ถ้า Facebook บอกบทบาทมา (tasks) ต้องเป็นบทบาทที่ตอบแชทได้
 *   (เพจจาก Business Manager บางทีไม่ส่ง tasks มา → ยอมให้ผ่าน เพราะได้ token มาจากสิทธิ์ใน Business) */
export function canConnectPage(p: FbManagedPage): boolean {
  if (!p.access_token) return false
  if (Array.isArray(p.tasks)) return p.tasks.some(t => CHAT_TASKS.includes(t))
  return true
}

/** ดึงเพจทั้งหมดที่ผู้ใช้ดูแล: /me/accounts + เพจใน Business Manager (owned + client) */
export async function fetchManagedPages(userToken: string): Promise<{ pages: Map<string, FbManagedPage>; tokenError: string | null }> {
  const fields = 'id,name,access_token,category,tasks,picture.type(large)'
  const pages = new Map<string, FbManagedPage>()
  let tokenError: string | null = null

  try {
    let url: string | undefined = `${FB}/me/accounts?fields=${fields}&limit=100&access_token=${userToken}`
    let guard = 0
    while (url && guard++ < 20) {
      const r: Response = await fetch(url)
      const d: any = await r.json()
      if (d.error) { if (guard === 1) tokenError = d.error.message || 'facebook error'; break }
      for (const p of d.data || []) pages.set(p.id, p)
      url = d.paging?.next
    }
  } catch {}

  try {
    const br = await fetch(`${FB}/me/businesses?fields=id&limit=50&access_token=${userToken}`)
    const bd: any = await br.json()
    const bizIds: string[] = (bd.data || []).map((b: any) => b.id)
    // ยิงพร้อมกัน — ถ้าทีละ business แล้วมีหลายสิบ business จะเกินเวลาของ Vercel
    const results = await Promise.all(
      bizIds.flatMap(id => ['owned_pages', 'client_pages'].map(async edge => {
        try {
          const r = await fetch(`${FB}/${id}/${edge}?fields=${fields}&limit=100&access_token=${userToken}`)
          const d: any = await r.json()
          return d.error ? [] : (d.data || [])
        } catch {
          return []
        }
      })),
    )
    for (const list of results) for (const p of list) if (!pages.has(p.id)) pages.set(p.id, p)
  } catch {}

  return { pages, tokenError }
}
