// ตัวเลขแชทใหม่บนไอคอนแอป — 3 ที่พร้อมกัน
// 1) ชื่อแท็บ "(3) FACEBOOK CHAT"
// 2) ไอคอนแท็บ (favicon) วาดตัว N + ป้ายแดงตัวเลขสดๆ ด้วย canvas
// 3) ป้ายบนไอคอนแอปที่ติดตั้งไว้ ผ่าน Badging API — ขึ้นเฉพาะตอนเปิดแอปอยู่:
//    Windows/Mac (Chrome/Edge) ได้เลย · iPhone ต้องกดอนุญาตการแจ้งเตือนก่อน · Android ไม่รองรับ (เห็นได้แค่ชื่อแท็บ)
//    (ถ้าอยากให้ขึ้นตอนปิดแอปด้วย ต้องทำ Web Push + service worker เป็นงานแยก)
//
// เรียก updateAppBadge(count) ทุกครั้งที่ตัวเลขเปลี่ยน — ฟังก์ชันจำค่าล่าสุดไว้ ไม่วาดซ้ำถ้าเท่าเดิม

const APP_TITLE = 'FACEBOOK CHAT NAIWANSOOK'
const ICON_URL = '/icon.svg'

let lastCount: number | null = null
let baseImage: HTMLImageElement | null = null
let baseLoaded = false
let pendingCount = 0

function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count)
}

function ensureLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-badge]')
  if (!link) {
    // เอา favicon เดิมออก ไม่งั้นเบราว์เซอร์อาจเลือกอันเดิมแทนอันที่วาดใหม่
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove())
    link = document.createElement('link')
    link.rel = 'icon'
    link.setAttribute('data-badge', '1')
    document.head.appendChild(link)
  }
  return link
}

function drawFavicon(count: number) {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (baseImage && baseLoaded) {
    ctx.drawImage(baseImage, 0, 0, size, size)
  } else {
    // ยังโหลดรูปไม่เสร็จ → วาดตัว N แบบง่ายไปก่อน (สัดส่วนเดียวกับ icon.svg)
    const k = size / 192
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, size * 0.23)
    ctx.fill()
    ctx.fillStyle = '#1877f2'
    ctx.beginPath()
    ctx.roundRect(30 * k, 40 * k, 132 * k, 96 * k, 30 * k)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    const pts = [[62, 116], [62, 52], [84, 52], [110, 92], [110, 52], [130, 52], [130, 116], [108, 116], [82, 76], [82, 116]]
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * k, y * k) : ctx.lineTo(x * k, y * k)))
    ctx.closePath()
    ctx.fill()
  }

  if (count > 0) {
    const text = badgeText(count)
    const r = text.length >= 3 ? 19 : 16
    const cx = size - r - 2
    const cy = r + 2
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 ${text.length >= 3 ? 17 : text.length === 2 ? 20 : 23}px system-ui, "Segoe UI", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, cx, cy + 1)
  }

  ensureLink().href = canvas.toDataURL('image/png')
}

function setOsBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {})
    else nav.clearAppBadge?.()?.catch(() => {})
  } catch {}
}

/** อัปเดตตัวเลขแชทใหม่บนแท็บ/ไอคอนแอป (0 = ไม่มีป้าย) */
export function updateAppBadge(count: number) {
  if (typeof window === 'undefined') return
  const n = Math.max(0, Math.floor(count || 0))
  if (n === lastCount) return
  lastCount = n
  pendingCount = n

  document.title = n > 0 ? `(${badgeText(n)}) ${APP_TITLE}` : APP_TITLE
  setOsBadge(n)

  if (!baseImage) {
    baseImage = new Image()
    baseImage.onload = () => { baseLoaded = true; drawFavicon(pendingCount) }
    baseImage.onerror = () => { baseLoaded = false }
    baseImage.src = ICON_URL
  }
  try { drawFavicon(n) } catch {}
}

/** เอาป้ายออกทุกที่ รวมไอคอนแอปที่ติดตั้ง (ใช้ตอนออกจากระบบ) */
export function clearAppBadge() {
  updateAppBadge(0)
}

/** รีเซ็ตเฉพาะชื่อแท็บ/ไอคอนแท็บ ตอนออกจากหน้ากล่องข้อความ — ไม่แตะป้ายบนไอคอนแอป (แชทใหม่ยังค้างอยู่จริง) */
export function resetTabBadge() {
  if (typeof window === 'undefined') return
  lastCount = null  // กลับเข้ามาใหม่ให้เขียนค่าจาก server เสมอ
  document.title = APP_TITLE
  try { drawFavicon(0) } catch {}
}
