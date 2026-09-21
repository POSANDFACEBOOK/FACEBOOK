'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LINE_ENABLED } from '@/lib/features'
import { updateAppBadge, resetTabBadge } from '@/lib/app-badge'
import { isHiddenInboxMessage } from '@/lib/fb-system-messages'
import {
  ArrowLeft, Send, Sparkles, RefreshCw, Search, Star, Archive, CheckCircle2,
  MessageSquare, Inbox, Settings, Zap, X, ChevronLeft, MoreVertical, Bot,
  AlertCircle, Users, Bell, Plus, LogOut, ListFilter, MailOpen, MailQuestion,
  Pencil, Check, Copy, Share2, ImagePlus, Menu, ExternalLink, Trash2,
} from 'lucide-react'

// ─── Design Tokens (sync กับ dashboard) ───────────────────────
const BG = '#eaf2fd', SURFACE = '#ffffff', SURFACE2 = '#f0f6ff'
const BORDER = 'rgba(24,119,242,0.13)', BORDER2 = 'rgba(24,119,242,0.22)'
const TEXT = '#1a1f3c', MUTED = '#6b7280'
const PRIMARY = '#1877f2', PRIMARY_LIGHT = '#eaf2fd'
const GREEN = '#059669', GREEN_L = '#d1fae5'
const RED = '#dc2626', RED_L = '#fee2e2'
const YELLOW = '#d97706', YELLOW_L = '#fef3c7'
const CYAN = '#0891b2', CYAN_L = '#cffafe'
const SHADOW_SM = '0 2px 8px rgba(24,119,242,0.08), 0 1px 3px rgba(0,0,0,0.04)'
const SHADOW_MD = '0 4px 20px rgba(24,119,242,0.12), 0 2px 6px rgba(0,0,0,0.05)'
const SHADOW_LG = '0 8px 36px rgba(24,119,242,0.16), 0 3px 10px rgba(0,0,0,0.07)'

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1877f2 0%, #2e89ff 55%, #5fa3ff 100%)',
  color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer',
  boxShadow: '0 6px 22px rgba(11,95,204,0.42), inset 0 1px 0 rgba(255,255,255,0.28)',
  fontFamily: 'inherit', fontWeight: 700, transition: 'all 0.18s',
}
const btnGhost: React.CSSProperties = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f0f4ff 100%)',
  color: MUTED, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${BORDER}`,
  fontFamily: 'inherit', transition: 'all 0.18s',
}

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  inquiry:    { label: '❓ สอบถาม',  color: '#2563eb', bg: '#dbeafe' },
  price:      { label: '💰 ราคา',    color: GREEN, bg: GREEN_L },
  order:      { label: '🛒 สั่งซื้อ', color: PRIMARY, bg: PRIMARY_LIGHT },
  complaint:  { label: '😡 ร้องเรียน', color: RED, bg: RED_L },
  support:    { label: '🛠 ช่วยเหลือ', color: CYAN, bg: CYAN_L },
  spam:       { label: '🚫 สแปม',    color: MUTED, bg: '#f1f5f9' },
  other:      { label: 'อื่นๆ',       color: MUTED, bg: '#f1f5f9' },
}

const sentimentConfig: Record<string, { label: string; emoji: string; color: string }> = {
  positive: { label: 'พอใจ',  emoji: '😊', color: GREEN },
  neutral:  { label: 'ปกติ',  emoji: '😐', color: MUTED },
  negative: { label: 'ไม่พอใจ', emoji: '😡', color: RED },
}

// สีประจำเพจ — เลี่ยงแดง/ส้ม/เขียวสด ที่ระบบใช้สื่อ "ผิดพลาด / เตือน / สำเร็จ"
// (เพจสีแดงทำให้แอดมินตกใจคิดว่าแชทมีปัญหา) → ใช้โทนเย็น+ม่วง/ชมพู/เทา แทน
const PAGE_PALETTE = [
  { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8', avatar: 'linear-gradient(135deg, #60a5fa, #2563eb)' }, // blue
  { bg: '#f3e8ff', border: '#7c3aed', text: '#6d28d9', avatar: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }, // violet
  { bg: '#ccfbf1', border: '#0d9488', text: '#0f766e', avatar: 'linear-gradient(135deg, #2dd4bf, #0d9488)' }, // teal
  { bg: '#fce7f3', border: '#db2777', text: '#be185d', avatar: 'linear-gradient(135deg, #f472b6, #db2777)' }, // pink
  { bg: '#e0e7ff', border: '#4f46e5', text: '#4338ca', avatar: 'linear-gradient(135deg, #818cf8, #4f46e5)' }, // indigo
  { bg: '#cffafe', border: '#0891b2', text: '#0e7490', avatar: 'linear-gradient(135deg, #22d3ee, #0891b2)' }, // cyan
  { bg: '#ede9fe', border: '#6d28d9', text: '#5b21b6', avatar: 'linear-gradient(135deg, #c4b5fd, #6d28d9)' }, // purple
  { bg: '#e2e8f0', border: '#475569', text: '#334155', avatar: 'linear-gradient(135deg, #94a3b8, #475569)' }, // slate
]
// แมป page_id → ลำดับ (เรียงตาม id เพื่อให้สีคงที่) → สีไม่ซ้ำกันถ้าเพจ ≤ 8
const PAGE_INDEX = new Map<string, number>()
function registerPageOrder(pages: Array<{ id: string }>) {
  PAGE_INDEX.clear()
  ;[...pages].map(p => p.id).sort().forEach((id, i) => PAGE_INDEX.set(id, i))
}
function pageColor(pageId?: string) {
  if (!pageId) return PAGE_PALETTE[PAGE_PALETTE.length - 1]
  const idx = PAGE_INDEX.get(pageId)
  if (idx !== undefined) return PAGE_PALETTE[idx % PAGE_PALETTE.length]
  // fallback (เพจที่ยังไม่ register) — hash
  let hash = 0
  for (let i = 0; i < pageId.length; i++) hash = ((hash << 5) - hash + pageId.charCodeAt(i)) | 0
  return PAGE_PALETTE[Math.abs(hash) % PAGE_PALETTE.length]
}

// toLocaleDateString สร้างตัวจัดรูปแบบวันที่ใหม่ทุกครั้งที่เรียก — แพงมาก
// หน้านี้เรียกทุกแถวในรายการแชท (ได้ถึง 500) + ทุกฟองข้อความ ทุกครั้งที่จอวาดใหม่ → เก็บไว้ใช้ซ้ำ
let thShortDate: Intl.DateTimeFormat | null = null
function timeAgo(d?: string): string {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เพิ่งส่ง'
  if (m < 60) return `${m} นาที`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day} วัน`
  if (!thShortDate) {
    try { thShortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }) } catch {}
  }
  return thShortDate ? thShortDate.format(new Date(d)) : new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

// แปลง error ดิบจาก API/เบราว์เซอร์ → ข้อความที่แอดมินร้านอ่านแล้วรู้ว่าต้องทำอะไรต่อ
function friendlyError(raw?: string): string {
  const e = String(raw || '')
  if (!e) return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
  if (/^⚠️/.test(e)) return e  // ข้อความที่เขียนให้ผู้ใช้อยู่แล้ว (กฎ 24 ชม./#551)
  // เน็ตก่อน (Safari/WebKit ใช้ "Load failed" ไม่ใช่ "Failed to fetch")
  if (/Failed to fetch|Load failed|NetworkError|ERR_NETWORK|network error/i.test(e)) return 'เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
  if (/\bUnauthorized\b|\bHTTP\s*401\b/i.test(e)) return 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่'
  if (/\bForbidden\b|\bHTTP\s*403\b/i.test(e)) return 'ไม่มีสิทธิ์ในเพจนี้ — ติดต่อเจ้าของเพจให้เพิ่มสิทธิ์'
  if (/Page token not found|\(#190\)|code[:\s]*190\b/i.test(e)) return 'การเชื่อมต่อเพจหมดอายุ — ให้เจ้าของเพจเข้าสู่ระบบด้วย Facebook ใหม่อีกครั้ง'
  if (/Invalid image URL/i.test(e)) return 'รูปนี้ส่งซ้ำไม่ได้ — กรุณาเลือกรูปใหม่อีกครั้ง'
  if (/\bnot found\b|\bHTTP\s*404\b/i.test(e)) return 'ไม่พบข้อมูลนี้แล้ว — ลองรีเฟรชหน้าจอ'
  if (/timeout|timed out/i.test(e)) return 'ใช้เวลานานเกินไป — ลองใหม่อีกครั้ง'
  // server ตอบกลับมาไม่ใช่ JSON (เช่นหน้า error 502/504 ของ Vercel) → JSON.parse พัง
  // ห้ามโยนข้อความดิบแบบ "Unexpected token 'A'..." ให้แอดมินร้านอ่าน
  if (/is not valid JSON|Unexpected token|JSON Parse error|did not match the expected pattern/i.test(e)) return 'ระบบตอบกลับผิดปกติ — ลองใหม่อีกครั้ง'
  return e
}

// ── ยิง fetch พร้อมเวลาจำกัด ──
// มือถือสลับ wifi↔4G กลางคัน fetch จะค้างได้เป็นนาที → ปุ่มส่งหมุนค้าง ตอบลูกค้าคนอื่นไม่ได้
// ใช้ AbortController (ไม่ใช่ AbortSignal.timeout) เพราะ iOS Safari รุ่นเก่ายังไม่มี timeout()
// อ่านเนื้อหาให้จบภายในเวลาที่กำหนดด้วย — เดิมนับเวลาแค่ตอน "ต่อติด" พอ header มาถึงก็เลิกจับเวลา
// มือถือที่สลับเสา/สัญญาณอ่อนจะค้างตอนโหลดเนื้อหาได้เป็นนาที ปุ่มส่งหมุนค้าง และตัวกันซิงก์ซ้อนค้างตาม
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try {
    const res = await fetch(url, { ...init, signal: ac.signal })
    if (res.status === 204 || res.status === 205 || res.status === 304) return res
    const body = await res.text()
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers })
  } finally {
    clearTimeout(t)
  }
}
const isAbortError = (e: any) => e?.name === 'AbortError'
const SEND_TIMEOUT_MS = 25_000
const UPLOAD_TIMEOUT_MS = 60_000   // 4G ช้า + รูปหลาย MB ต้องใจกว้างกว่าการส่งข้อความ
// /api/inbox/sync ตัดรอบตัวเองที่ 45 วิ (maxDuration = 60) → เผื่อเกินนิดเดียว ห้ามสั้นกว่านี้
// ไม่จำกัดเวลา = เดินออกนอกพื้นที่ wifi แล้ว fetch ค้าง ตัวกันยิงซ้อนค้างตาม → ไม่มีข้อความลูกค้าเข้าระบบอีกเลย
const SYNC_TIMEOUT_MS = 65_000
// รอบซิงก์ที่ค้างนานกว่านี้ถือว่าตายแล้ว ให้รอบใหม่แย่งได้ (ฝั่ง server ก็ปล่อยสิทธิ์จองที่ 65 วิ)
const SYNC_STUCK_MS = 90_000
// ทุกเพจถูกข้าม = รอบนี้ไม่ได้ดึงอะไรเลย → อย่าให้กินคิว 60 วิเต็ม ไม่งั้นกดผิดจังหวะ 1 ครั้ง
// ดันรอบจริงรอบถัดไปออกไปอีกนาที (ข้อความลูกค้าเข้าช้าโดยไม่มีใครรู้)
const SYNC_SKIPPED_BACKOFF_MS = 30_000

// ── ย่อรูปก่อนอัปโหลด ──
// รูปจากกล้องมือถือมักใหญ่ 4-8 MB ส่งผ่าน Vercel ไม่ได้ (เพดาน body 4.5 MB) และกินเน็ตแอดมินฟรีๆ
// ใช้ <img> + canvas (ไม่ใช่ createImageBitmap) เพราะ Safari รุ่นเก่าหมุนรูปตาม EXIF ให้เฉพาะทาง <img>
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024   // ต้องตรงกับ MAX_BYTES ใน api/inbox/upload

// ข้อความตอนรูปเกินเพดาน — ต้องแยกกรณี GIF
// GIF เป็นชนิดเดียวที่ไม่ถูกย่อ (ย่อแล้วภาพหยุดนิ่ง) จึงมาถึงด่านนี้ด้วยขนาดไฟล์จริง
// และการ "แคปหน้าจอ" ที่แนะนำรูปทั่วไป ใช้กับ GIF ไม่ได้ผล เพราะภาพเคลื่อนไหวจะหายไป
function oversizeImageMessage(type?: string): string {
  return type === 'image/gif'
    ? 'GIF นี้ใหญ่เกินไป (เกิน 4 MB) — ย่อ GIF ให้เล็กลงแล้วส่งใหม่ หรือแคปหน้าจอส่งเป็นรูปนิ่งแทน (ภาพจะไม่ขยับ)'
    : 'รูปใหญ่เกินไป (เกิน 4 MB) — ลองถ่ายหน้าจอรูปนี้แล้วส่งภาพที่แคปมาแทน'
}

async function prepareImageForUpload(file: File): Promise<File> {
  // GIF = ภาพเคลื่อนไหว ย่อแล้วเหลือเฟรมเดียว / ไฟล์เล็กอยู่แล้วไม่ต้องแตะ
  if (file.type === 'image/gif' || file.size <= 600 * 1024) return file
  const srcUrl = URL.createObjectURL(file)
  try {
    const img = document.createElement('img')
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      img.src = srcUrl
    })
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) return file
    const draw = (maxEdge: number, quality: number) => new Promise<Blob | null>(resolve => {
      const scale = Math.min(1, maxEdge / Math.max(w, h))
      const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale))
      const canvas = document.createElement('canvas')
      canvas.width = cw; canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.fillStyle = '#ffffff'      // PNG พื้นโปร่งใส → พื้นขาว ไม่ใช่ดำ
      ctx.fillRect(0, 0, cw, ch)
      ctx.drawImage(img, 0, 0, cw, ch)
      canvas.toBlob(b => resolve(b), 'image/jpeg', quality)
    })
    let blob = await draw(1600, 0.8)
    if (blob && blob.size > 2 * 1024 * 1024) blob = await draw(1600, 0.65)
    if (blob && blob.size > MAX_UPLOAD_BYTES) blob = await draw(1200, 0.6)
    if (!blob || blob.size >= file.size) return file   // ย่อแล้วไม่เล็กลง → ใช้ไฟล์เดิมดีกว่า
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file   // เบราว์เซอร์เก่า/ไฟล์เสีย → ส่งไฟล์เดิม แล้วให้ตัวเช็คขนาดบอกแอดมินเอง
  } finally {
    URL.revokeObjectURL(srcUrl)
  }
}

// ── รูปที่เพิ่งอัปจากเครื่องนี้: Supabase URL → blob: URL ของไฟล์ต้นฉบับ ──
// อัปเสร็จแล้วถ้าสลับไปใช้ URL ของ Supabase ทันที เบราว์เซอร์ต้องโหลดรูปเดิมกลับมาใหม่ทั้งไฟล์
// บนเน็ตมือถือแอดมินจะเห็นฟองว่างๆ แล้วนึกว่าส่งรูปไม่สำเร็จ
const localPreviews = new Map<string, string>()
function rememberLocalPreview(remoteUrl: string, blobUrl: string) {
  localPreviews.set(remoteUrl, blobUrl)
  while (localPreviews.size > 12) {          // กันสะสมกินหน่วยความจำบนมือถือ
    const k = localPreviews.keys().next().value as string | undefined
    if (k === undefined) break
    const v = localPreviews.get(k)
    localPreviews.delete(k)
    if (v) { try { URL.revokeObjectURL(v) } catch {} }
  }
}
function clearLocalPreviews() {
  localPreviews.forEach(v => { try { URL.revokeObjectURL(v) } catch {} })
  localPreviews.clear()
}

// จอที่แสดงทีละคอลัมน์แบบ Messenger (มือถือ + มือถือแนวนอน) — ต้องตรงกับ @media ใน INBOX_CSS
const MOBILE_MQ = '(max-width: 820px), (pointer: coarse) and (max-height: 500px)'

// ── CSS ของหน้ากล่องข้อความ ──
// ต้องเป็นค่าคงที่ + <style> ธรรมดา ไม่ใช่ <style jsx global>
// styled-jsx ใน App Router ไม่มี StyleRegistry ฝั่ง server → CSS จะถูกใส่หลัง JS โหลดเสร็จเท่านั้น
// เปิดแอปบนมือถือครั้งแรกจึงเห็นหน้าจอแบบคอม (sidebar 244px ทับจอ) แว้บนึงทุกครั้ง
// หมายเหตุ: ต้องใช้ dangerouslySetInnerHTML — <style>{CSS}</style> React จะ escape ">" กับ "\""
// ทำให้ selector .ib-pagebar > div และ [data-active="1"] พังทั้งหมด
const INBOX_CSS = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* ── Fix body: กันเลื่อนซ้าย-ขวา + rubber-band ทุกอุปกรณ์ ── */
        * { box-sizing: border-box; }
        html, body {
          overflow-x: hidden !important;
          max-width: 100%;
          width: 100%;
          position: relative;
          overscroll-behavior: none;
          overscroll-behavior-x: none;
          -webkit-text-size-adjust: 100%;
        }
        .ib-main, .ib-pagebar, .ib-col1, .ib-col2, .ib-col3 { max-width: 100%; min-width: 0; }

        /* Tablet — hide right panel + ซ่อนปุ่มเปิดแผงขวาด้วย (ไม่งั้นกดแล้วไม่มีอะไรเกิดขึ้น) */
        @media (max-width: 1280px) {
          .ib-col3 { display: none !important; }
          .ib-toggle-right { display: none !important; }
        }

        /* Narrow tablet — narrower col1 + page tiles 2 cols */
        @media (max-width: 980px) {
          .ib-col1 { width: 290px !important; }
          .ib-pagebar > div { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* Mobile/tablet — hide sidebar + ล็อก viewport (กันเลื่อน/เด้ง)
           เงื่อนไขที่ 2 = มือถือหมุนแนวนอน (กว้าง 844-932px แต่สูงไม่ถึง 500px)
           ถ้าดูแค่ความกว้าง มือถือแนวนอนจะได้หน้าจอแบบคอม: sidebar 244 + ลิสต์ + แชทเหลือนิดเดียว
           และไม่ได้ล็อก viewport → คีย์บอร์ดเด้งแล้วหัวแชทหาย (แท็บเล็ตสูงเกิน 500px จึงไม่โดน) */
        @media (max-width: 820px), (pointer: coarse) and (max-height: 500px) {
          html, body {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100%; height: 100%;
            overflow: hidden !important;
            overscroll-behavior: none;
            touch-action: pan-y;
          }
          .ib-sidebar { transform: translateX(-100%); transition: transform 0.25s; }
          /* ใช้ความสูง+offset จริงจาก visualViewport (--app-height/--app-offset)
             → คีย์บอร์ดเด้งแล้ว composer ยังอยู่เหนือคีย์บอร์ดเป๊ะ ไม่หลุดขึ้นบน */
          .ib-root {
            height: var(--app-height, 100svh) !important;
            min-height: 0 !important;
            max-height: var(--app-height, 100svh) !important;
            transform: translateY(var(--app-offset, 0px));
          }
          .ib-main { margin-left: 0 !important; padding-top: 0 !important; height: var(--app-height, 100svh) !important; width: 100% !important; }
          .ib-mobile-bar { display: flex !important; }
          /* หน้าเลือกช่องทาง — เต็มจอบนมือถือ
             ต้องดันลงใต้ mobile bar (fixed สูง 52px, z-40) เพราะ gate อยู่ใน <main>
             ที่มี z-index 1 จึงชนะ mobile bar ด้วย z-index ไม่ได้ */
          .ib-channel-gate { left: 0 !important; top: 52px !important; }
          /* รายการแชท (ยังไม่เปิดแชท): mobile bar เป็น fixed → ดันเนื้อหาลงมาไม่ให้โดนบัง */
          .ib-root[data-active="0"] .ib-main { padding-top: 52px !important; }
          /* page bar เลื่อนแนวนอนได้ (เฉพาะตัวมันเอง) */
          .ib-pagebar > div { touch-action: pan-x; }
          /* เว้นขอบให้พ้น "ติ่งกล้อง"/มุมโค้ง ตอนหมุนจอแนวนอน (viewport-fit=cover)
             ไม่งั้นปุ่มย้อนกลับกับปุ่มส่งไปอยู่ใต้ติ่ง กดไม่โดน */
          .ib-main {
            padding-left: env(safe-area-inset-left, 0px) !important;
            padding-right: env(safe-area-inset-right, 0px) !important;
          }
          .ib-mobile-bar {
            padding-left: calc(14px + env(safe-area-inset-left, 0px)) !important;
            padding-right: calc(14px + env(safe-area-inset-right, 0px)) !important;
          }
        }

        /* Mobile/tablet — Messenger-like UX (≤820 ครอบทุกมือถือ + แท็บเล็ตเล็ก/in-app browser) */
        @media (max-width: 820px), (pointer: coarse) and (max-height: 500px) {
          /* Single column toggle */
          .ib-col1 { width: 100% !important; }
          .ib-main[data-active="1"] .ib-col1 { display: none !important; }
          .ib-main[data-active="0"] .ib-col2 { display: none !important; }
          /* เปิดแชท → ซ่อน mobile bar (sibling ของ .ib-main จึงใช้ .ib-root) + โชว์ปุ่มกลับ */
          .ib-root[data-active="1"] .ib-mobile-bar { display: none !important; }
          .ib-back { display: flex !important; }
          .ib-only-mobile-flex { display: flex !important; }

          /* Page bar — แนวนอน scroll (เหมือน stories) เห็นทุกเพจ */
          .ib-pagebar { padding: 8px 10px !important; }
          .ib-pagebar > div {
            display: flex !important;
            grid-template-columns: none !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory;
            gap: 6px !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .ib-pagebar > div::-webkit-scrollbar { display: none; }
          /* ครอบทั้งปุ่ม "ทุกเพจ" และ wrapper ของไทล์เพจ (ที่มีปุ่มแก้ชื่อแยก) */
          .ib-pagebar > div > button,
          .ib-pagebar > div > div {
            scroll-snap-align: start;
            flex-shrink: 0 !important;
            max-width: 220px;
          }

          /* ซ่อน page bar + mobile bar เมื่อเปิดแชท → เห็นแชทเต็มจอ
             ใช้ .ib-root (พ่อร่วมของทั้งคู่) เพราะ .ib-mobile-bar เป็น sibling ของ .ib-main */
          .ib-root[data-active="1"] .ib-pagebar { display: none !important; }
          .ib-root[data-active="1"] .ib-mobile-bar { display: none !important; }

          /* Mobile back button — แสดงในหัว chat เพื่อกลับ list */
          .ib-back {
            min-width: 38px !important; min-height: 38px !important;
            padding: 8px !important;
          }

          /* Touch targets ใหญ่ขึ้น */
          .ib-col1 button, .ib-col1 a { min-height: 36px; }
        }

        /* iOS safe area — กัน composer ทับแถบ home
           ใช้ --kb-open (ตั้งจาก visualViewport) → คีย์บอร์ดเปิดแล้วตัด padding ทิ้ง
           ไม่งั้นจะมีช่องว่างขาวคั่นระหว่างช่องพิมพ์กับคีย์บอร์ด */
        @supports (padding: env(safe-area-inset-bottom)) {
          @media (max-width: 820px), (pointer: coarse) and (max-height: 500px) {
            .ib-main { padding-bottom: calc(env(safe-area-inset-bottom) * var(--kb-open, 1)) !important; }
          }
        }

        /* iOS zoom prevention — input fontSize ≥ 16 */
        @media (max-width: 820px), (pointer: coarse) and (max-height: 500px) {
          /* ครอบ input ทุกชนิดที่พิมพ์ได้ (เดิมระบุเฉพาะ type="text" → ช่องที่ไม่ระบุ type หลุด) */
          input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
          textarea, select {
            font-size: 16px !important;
          }
          /* ซ่อนปุ่มที่ไม่จำเป็นบนมือถือ (right panel ใช้ไม่ได้อยู่แล้ว) */
          .ib-hide-mobile { display: none !important; }
        }
        /* ── Composer ──
           มือถือ: 2 แถว (ปุ่มแถวบน / ช่องพิมพ์+ส่ง แถวล่าง) → ช่องพิมพ์ได้พื้นที่เต็ม
           จอใหญ่: แถวเดียวเหมือนเดิม */
        .ib-composer { display: flex; flex-direction: column; gap: 8px; }
        .ib-composer-actions { display: flex; gap: 8px; align-items: center; }
        .ib-composer-input { display: flex; gap: 8px; align-items: flex-end; }
        .ib-only-mobile { display: none; }
        @media (max-width: 820px), (pointer: coarse) and (max-height: 500px) {
          .ib-only-mobile { display: inline; }
          /* ปุ่มที่มีข้อความกระจายเต็มแถว กดง่ายด้วยนิ้วโป้ง (ปุ่มไอคอนล้วนคงขนาดเดิม) */
          .ib-composer-grow { flex: 1; justify-content: center; }
        }
        /* แถวเดียวเฉพาะตอนคอลัมน์แชทกว้างพอจริง — ที่ 821-1080px ยังมี sidebar 244 + ลิสต์ 290
           ทำให้เหลือที่ช่องพิมพ์แค่ไม่กี่ px ถ้าบังคับแถวเดียว */
        @media (min-width: 1100px) {
          /* flex-wrap: ถ้าที่ไม่พอ (เช่น 1281-1350px ตอนแผงขวาเปิด) ให้ตกลงมาเป็น 2 แถวเอง
             ไม่งั้นปุ่ม "ส่ง" ล้นออกนอกคอลัมน์แล้วโดนตัด กดไม่ได้ */
          .ib-composer { flex-direction: row; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
          .ib-composer-input { flex: 1; min-width: 240px; }
        }

        /* toast ต้องไม่ทับแถวช่องพิมพ์ตอนเปิดแชทอยู่บนมือถือ */
        @media (max-width: 820px), (pointer: coarse) and (max-height: 500px) {
          /* 240px = composer 2 แถวตอนช่องพิมพ์ขยายสูงสุด (140px) + ปุ่ม + ระยะขอบ */
          .ib-toast-above-composer {
            bottom: calc(env(safe-area-inset-bottom, 0px) + 240px) !important;
          }
        }
        /* จอแคบสุด (iPhone SE 320px / in-app browser ที่บีบความกว้าง) */
        @media (max-width: 400px) {
          .ib-hide-narrow { display: none !important; }
        }
        @media (max-width: 360px) {
          /* เหลือแต่ไอคอน — ป้าย "ข้อความบันทึก" ทำให้ปุ่มตัดบรรทัดสูงไม่เท่ากัน */
          .ib-only-mobile { display: none !important; }
        }
`

export default function InboxPage() {
  const { data: session } = useSession()

  // Data
  const [isOwner, setIsOwner] = useState<boolean | null>(null)  // null = ยังไม่รู้ → ซ่อนเมนู owner ไว้ก่อน
  // จัดการช่องทางได้ = เจ้าของเพจ หรือเจ้าของร้านที่ล็อกอินด้วย Facebook แต่ยังไม่เคยเชื่อมช่องทางแรก
  // null = ยังไม่รู้ (เช่น /api/me ล้มเหลว) — ไม่ใช่ "ไม่มีสิทธิ์"
  const [canManageChannels, setCanManageChannels] = useState<boolean | null>(null)
  // รูปโปรไฟล์ตัวเอง — เฉพาะบัญชี Facebook (บัญชีอีเมลไม่มีรูป → ตัวอักษรย่อทันที)
  // ใส่ id บัญชีใน URL ให้ browser แยก cache ต่อบัญชี (มือถือเครื่องเดียวสลับบัญชีจะได้ไม่เห็นรูปคนก่อน)
  const sessionFbId = (session as any)?.fbUserId as string | undefined
  const selfAvatarSrc = sessionFbId ? `/api/avatar?k=${encodeURIComponent(sessionFbId)}` : undefined
  const [pages, setPages] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [quickReplies, setQuickReplies] = useState<any[]>([])
  // โหลดข้อความบันทึกไม่สำเร็จ (เน็ตหลุด/หน้า error ของ Vercel) — ต้องไม่ขึ้นว่า "ยังไม่มีข้อความบันทึกไว้"
  const [qrLoadFailed, setQrLoadFailed] = useState(false)
  // รายการข้อความบันทึกที่ถืออยู่ตอนนี้เป็นของเพจไหน ('' = ยังไม่ได้เจาะจงเพจ) — สลับไปแชทของอีกเพจต้องโหลดใหม่
  const qrLoadedForRef = useRef<string>('')
  // เปิดหน้าตั้งค่าโดยเลือกแท็บไว้ล่วงหน้า (ปุ่ม "+ สร้าง" ต้องพาไปแท็บข้อความบันทึก ไม่ใช่แท็บ AI)
  const [settingsTab, setSettingsTab] = useState<'general'|'auto'|'kb'|'qr'>('general')

  // Filters
  const [channelFilter, setChannelFilter] = useState<'facebook' | 'line' | null>(null)
  const [pageFilter, setPageFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all'|'unread'|'needs_reply'|'starred'|'unresolved'|'archived'>('all')
  const [search, setSearch] = useState('')

  // Rename page nickname
  const [renamePage, setRenamePage] = useState<any | null>(null)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [savingNickname, setSavingNickname] = useState(false)
  // บอกผลในกล่องเลย — แบนเนอร์รวมอยู่ใต้ modal แอดมินมองไม่เห็นว่ากดแล้วไม่สำเร็จ
  const [nicknameError, setNicknameError] = useState<string | null>(null)

  // UI state
  const [loadingList, setLoadingList] = useState(true)
  const [pageSyncing, setPageSyncing] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // "กำลังส่ง / กำลังอัปโหลด" แยกรายแชท — เดิมเป็นตัวแปรเดียวทั้งหน้า
  // ส่งค้างที่ลูกค้า A แล้วปุ่มส่งของลูกค้า B จะกดไม่ได้เลยจนกว่าอันแรกจะ error (เน็ตสะดุดกลางร้าน = รอเป็นนาที)
  // ใช้ ref เป็นตัวตัดสิน (กดรัวๆ ก่อน React re-render ก็ไม่ส่งซ้ำ) + tick ไว้บังคับให้จอวาดใหม่
  const sendingConvsRef = useRef<Set<string>>(new Set())
  const uploadingConvsRef = useRef<Set<string>>(new Set())
  const [, setBusyTick] = useState(0)
  const setBusy = (bag: React.MutableRefObject<Set<string>>, convId: string, on: boolean) => {
    if (on) bag.current.add(convId); else bag.current.delete(convId)
    setBusyTick(t => t + 1)
  }
  const sending = !!activeConv && sendingConvsRef.current.has(activeConv.id)
  const uploading = !!activeConv && uploadingConvsRef.current.has(activeConv.id)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showSavedReplies, setShowSavedReplies] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [totalUnread, setTotalUnread] = useState(0)
  const [totalNeedsReply, setTotalNeedsReply] = useState(0)
  const [unreadByPage, setUnreadByPage] = useState<Record<string, number>>({})
  const [needsReplyByPage, setNeedsReplyByPage] = useState<Record<string, number>>({})
  const [markingRead, setMarkingRead] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [listLimit, setListLimit] = useState(50)   // จำนวนแชทที่โหลด — กด "โหลดเพิ่ม" เพื่อขยาย
  const listLimitRef = useRef(50)
  listLimitRef.current = listLimit
  const [sessionExpired, setSessionExpired] = useState(false)
  // sticky = ไม่หายเอง (ใช้กับ "ส่งไม่สำเร็จ" ที่แอดมินต้องเห็นแน่ๆ) / action = ปุ่มอื่นที่ไม่ใช่ "เลิกทำ"
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; action?: { label: string; run: () => void }; sticky?: boolean } | null>(null)
  // เก็บ "ลายเซ็นข้อความที่กดส่งซ้ำไปแล้ว" — ใช้ ref ไม่ให้หายตอนสลับแชทกลับมา
  // (ถ้าเก็บใน state แล้วรีเซ็ต ผู้ใช้จะกดส่งซ้ำได้อีก ลูกค้าได้ข้อความเดิมหลายรอบ)
  const retriedRef = useRef<Set<string>>(new Set())
  // id ของแถวใน DB ที่ถูกกดส่งซ้ำไปแล้ว → ซ่อนไม่ให้ฟองแดงเดิมเด้งกลับมาตอน poll
  const retriedServerIdsRef = useRef<Set<string>>(new Set())
  const loadMessagesSilentRef = useRef<(() => void) | null>(null)
  const [retriedTick, setRetriedTick] = useState(0)  // บังคับ re-render หลัง mark
  // ค่าตั้งค่าต่อเพจ (ตอนนี้ใช้เช็คว่าเจ้าของปิดปุ่ม "AI ช่วยตอบ" ไว้ไหม)
  const [aiEnabledByPage, setAiEnabledByPage] = useState<Record<string, boolean>>({})
  const [settingsVer, setSettingsVer] = useState(0)  // ++ เมื่อปิดหน้าตั้งค่า → ดึงค่า ai_assist_enabled ใหม่
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  // โหลดรายการแชทไม่สำเร็จ — แยกจาก errorBanner เพราะ errorBanner ใช้บอกผลที่แอดมินเป็นคนสั่ง (ส่งไม่สำเร็จ ฯลฯ)
  // ห้ามทับกัน และอันนี้ต้องหายเองเมื่อโหลดสำเร็จรอบถัดไป
  const [listError, setListError] = useState<string | null>(null)
  const listEverLoadedRef = useRef(false)
  // ปัญหาจากการดึงข้อมูลเบื้องหลัง (เช่น token เพจหมดอายุ) — เตือนข้างรายการแชท ไม่ไปทับแบนเนอร์ในห้องแชท
  const [syncNotice, setSyncNotice] = useState<{ sig: string; text: string } | null>(null)
  const dismissedSyncSigRef = useRef<string>('')
  // มีข้อความใหม่เข้ามาตอนแอดมินเลื่อนอ่านข้อความเก่าอยู่ → ขึ้นปุ่มลอยให้กดลงไปดู
  const [newMsgCount, setNewMsgCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const msgPaneRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)         // แอดมินอยู่ท้ายสุดของแชทไหม (ตัดสินว่าจะเลื่อนตามให้ไหม)
  const lastMsgIdRef = useRef<string | null>(null)
  // id ของ "แถวจริง" ตัวท้ายสุด (ไม่นับฟองที่กำลังส่ง/ส่งไม่สำเร็จ) — ฟองแดงค้างท้ายแชท
  // ห้ามบังไม่ให้รู้ว่ามีข้อความใหม่เข้ามา
  const lastRealMsgIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastFbSyncRef = useRef(Date.now())  // เวลาที่ sync FB ล่าสุด (ไม่รีเซ็ตตอนสลับแชท)
  const syncInFlightRef = useRef(false)     // กันยิง sync ซ้อนกัน (poll + กลับเข้าแอป + กดปุ่มเอง พร้อมกัน)
  const syncStartedAtRef = useRef(0)        // รอบที่กำลังยิงเริ่มเมื่อไหร่ — ใช้ปลดล็อกรอบที่ค้าง
  const openReqRef = useRef<string>('')  // กัน race ตอนเปิดหลายแชทเร็วๆ
  const openSeqRef = useRef(0)           // ลำดับการ "เปิดแชท" — กันผลเก่าของแชทเดียวกันทับผลใหม่
  const detailSeqRef = useRef(0)         // ลำดับการโหลดข้อความเบื้องหลัง
  const detailAppliedRef = useRef(0)     // ผลโหลดข้อความล่าสุดที่เอาขึ้นจอแล้ว
  // แถวข้อความที่ "เครื่องนี้" เพิ่งบันทึกเอง (id → เวลา) — ใช้กันไม่ให้ poll เก่าลบฟองที่เพิ่งส่งสำเร็จ
  const localRowsRef = useRef<Map<string, number>>(new Map())
  // ช่องพิมพ์อยู่ในคอมโพเนนต์ลูก (Composer) — สั่งงานผ่าน ref นี้ (แทรกข้อความ/ล้างช่อง)
  const composerApiRef = useRef<ComposerApi | null>(null)
  // เก็บไฟล์รูปที่อัปโหลดไม่สำเร็จไว้ เพื่อให้ "ส่งอีกครั้ง" อัปโหลดใหม่ได้จริง
  // (ถ้าส่ง blob: URL ไป server จะตีกลับ 400 ทุกครั้ง)
  const pendingFilesRef = useRef<Map<string, { file: File; url: string }>>(new Map())
  // ล้างไฟล์+blob ที่ค้าง (เปลี่ยนแชท/ออกจากหน้า) — ไม่งั้นสะสมกินหน่วยความจำ
  const clearPendingFiles = () => {
    pendingFilesRef.current.forEach(v => { try { URL.revokeObjectURL(v.url) } catch {} })
    pendingFilesRef.current.clear()
  }
  useEffect(() => () => { clearPendingFiles(); clearLocalPreviews() }, [])

  // เลื่อนไปข้อความล่าสุดแบบทันที (ไม่ใช่ smooth) — เปิดแชทแล้วต้องเห็นข้อความล่าสุดตั้งแต่เฟรมแรก
  // smooth จะไล่จอจากข้อความเก่าสุดลงมา ระหว่างนั้นรูปในแชทโหลดเสร็จแล้วดันข้อความล่าสุดหลุดจออีก
  const pinMessagesToBottom = useCallback(() => {
    nearBottomRef.current = true
    const el = msgPaneRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  // รูป/เสียง/วิดีโอในแชทโหลดเสร็จ → ความสูงเปลี่ยน ถ้าแอดมินยังอยู่ท้ายแชทต้องตรึงไว้ท้ายเหมือนเดิม
  // (iOS Safari ไม่มี scroll anchoring ให้ ต้องเลื่อนเอง ไม่งั้นสลิปโอนเงินดันคำถามล่าสุดพ้นจอ)
  const onMediaReady = useCallback(() => {
    const el = msgPaneRef.current
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight
  }, [])

  // ── ปุ่มย้อนกลับของเครื่อง (Android / ปัดขอบจอ iOS) ──
  // เปิดแชทบนมือถือ = เพิ่ม 1 รายการใน history → กดย้อนกลับแล้วกลับมาที่รายการแชท
  // เดิมไม่มีรายการนี้ กดย้อนกลับ = ออกจากกล่องข้อความ (แอปที่ติดตั้งไว้จะปิดไปเลย) ที่พิมพ์ค้างหายหมด
  // เปิดแชทอื่นต่อใช้ replace → history ไม่บวมทีละแชท
  const pushChatHistory = (convId: string) => {
    try {
      if (!window.matchMedia || !window.matchMedia(MOBILE_MQ).matches) return
      const st: any = window.history.state || {}
      if (st.ibChat) window.history.replaceState({ ...st, ibChat: convId }, '')
      else window.history.pushState({ ...st, ibChat: convId }, '')
    } catch {}
  }

  // ── จำตำแหน่งที่เลื่อนค้างไว้ของรายการแชท + แถบเพจ ──
  // บนมือถือคอลัมน์รายการถูกซ่อนด้วย display:none ตอนเปิดแชท เบราว์เซอร์จึงทิ้งตำแหน่งเลื่อนทิ้งหมด
  // กลับจากแชทแล้วเด้งขึ้นบนสุดทุกครั้ง = ต้องไล่หาลูกค้าที่ทักไว้เมื่อวานใหม่ทุกรอบ
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const listScrollTopRef = useRef(0)
  const pagebarScrollRef = useRef<HTMLDivElement | null>(null)
  const pagebarLeftRef = useRef(0)
  // เก็บตอน "กำลังจะเปิดแชท" — ตอนนั้นคอลัมน์ยังอยู่บนจอ ค่ายังอ่านได้
  const rememberListScroll = useCallback(() => {
    listScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0
    pagebarLeftRef.current = pagebarScrollRef.current?.scrollLeft ?? 0
  }, [])
  // คืนตำแหน่งก่อนจอวาด (useLayoutEffect) → ไม่เห็นรายการกระพริบขึ้นบนสุดแล้วเด้งกลับ
  useLayoutEffect(() => {
    if (activeConv) return
    const list = listScrollRef.current
    if (list && listScrollTopRef.current > 0) {
      list.scrollTop = Math.min(listScrollTopRef.current, Math.max(0, list.scrollHeight - list.clientHeight))
    }
    const bar = pagebarScrollRef.current
    if (bar && pagebarLeftRef.current > 0) {
      // scroll-snap-type: x mandatory จะดึงกลับทันทีถ้าเขียน scrollLeft ตรงๆ → ปิดไว้ 1 เฟรม
      const prevSnap = bar.style.scrollSnapType
      bar.style.scrollSnapType = 'none'
      bar.scrollLeft = pagebarLeftRef.current
      requestAnimationFrame(() => { bar.style.scrollSnapType = prevSnap })
    }
  }, [activeConv])

  // ร่างข้อความแยกตามแชท — เดิมมีตัวเดียวทั้งหน้า กดย้อนกลับไปดูแชทอื่นแล้วที่พิมพ์ไว้หายหมด
  // เก็บในหน่วยความจำเท่านั้น (มีที่อยู่/เบอร์ลูกค้า ไม่ควรค้างในเครื่องที่ร้านใช้ร่วมกัน)
  const draftsRef = useRef<Map<string, string>>(new Map())
  // ค่าล่าสุดในช่องพิมพ์ — เก็บเป็น ref ไม่ใช่ state
  // (Composer อัปเดตให้ทุกตัวอักษร แต่ไม่สั่งวาดหน้าใหม่ทั้งกล่องข้อความ)
  const draftValueRef = useRef('')
  const onDraftChange = useCallback((v: string) => { draftValueRef.current = v }, [])
  const stashDraft = () => {
    const id = openReqRef.current
    if (!id) return
    const v = draftValueRef.current
    if (v.trim()) draftsRef.current.set(id, v)
    else draftsRef.current.delete(id)
  }

  // ข้อความที่ส่งไม่สำเร็จและ server ไม่มีแถวนี้ — เก็บไว้เสมอ ไม่ว่าแอดมินยังอยู่ในแชทนั้นหรือไม่
  // (เปิดแชทอื่นแล้วกลับมา loadMessages จะตั้ง messages ใหม่จาก outbox อย่างเดียว
  //  ไม่เก็บไว้ = ข้อความที่พิมพ์หายถาวร ลูกค้าไม่ได้รับ และไม่มีอะไรบอกแอดมินเลย)
  const outboxRef = useRef<Map<string, any[]>>(new Map())
  const OUTBOX_MAX_PER_CONV = 20   // กันบวมตอนเน็ตดับยาวๆ (ของเก่าสุดหลุดก่อน)
  const stashFailed = (convId: string, m: any) => {
    const cur = (outboxRef.current.get(convId) || []).filter(x => String(x.id) !== String(m.id))
    outboxRef.current.set(convId, [...cur, m].slice(-OUTBOX_MAX_PER_CONV))
  }
  const dropFromOutbox = (convId: string, id: any) => {
    const cur = outboxRef.current.get(convId)
    if (!cur) return
    const next = cur.filter(x => String(x.id) !== String(id))
    if (next.length) outboxRef.current.set(convId, next)
    else outboxRef.current.delete(convId)
  }

  // คอม = Enter ส่ง / มือถือ = Enter ขึ้นบรรทัดใหม่
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 821px) and (pointer: fine)')
    const on = () => setIsDesktop(mq.matches)
    on()
    // iPad/iPhone ที่ค้างอยู่ iOS 12-13 (Safari < 14) ไม่มี addEventListener บน MediaQueryList
    // เรียกตรงๆ จะโยน TypeError ใน useEffect → ทั้งกล่องข้อความจอขาว เปิดใช้งานไม่ได้เลย
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', on)
      return () => mq.removeEventListener('change', on)
    }
    const legacy = mq as any
    legacy.addListener?.(on)
    return () => legacy.removeListener?.(on)
  }, [])

  // ── Load conversations ──
  // สลับเพจให้เร็ว + ไม่แสดงแชทผิดเพจ:
  // - ทุก request มีลำดับ (seq) + key (เพจ|ตัวกรอง|คำค้น) — ผลที่กลับมาช้าของ key เก่า ห้ามทับรายการที่แอดมินเลือกอยู่
  //   (เดิม poll ที่ยิงก่อนสลับเพจ ตอบกลับทีหลังแล้วเอาแชทเพจเก่ามาทับ)
  // - เก็บผลแต่ละ key ไว้ (แคช) → กดกลับไปเพจเดิมขึ้นทันที แล้วค่อยอัปเดตเบื้องหลัง
  const listKeyOf = (pf: string, sf: string, q: string) => `${pf}|${sf}|${q}`
  const listFilterRef = useRef({ pageFilter: '', statusFilter: 'all', q: '' })
  const listSeqRef = useRef(0)            // เพิ่มทุกครั้งที่ยิง request รายการแชท
  const appliedListSeqRef = useRef(0)     // request ล่าสุดที่เอารายการไปแสดงแล้ว
  const appliedCountsSeqRef = useRef(0)   // request ล่าสุดที่เอาตัวเลข/รายชื่อเพจไปแสดงแล้ว
  const loadingSeqRef = useRef(0)         // request แบบโชว์สปินเนอร์ตัวล่าสุด
  const listCacheRef = useRef<Map<string, { seq: number; conversations: any[] }>>(new Map())

  // แชทที่แอดมินเพิ่งกดเปิด (= อ่านแล้ว) → id → เวลาที่กดเปิด
  // ระหว่างที่ server ยังล้าง "ยังไม่อ่าน" ไม่เสร็จ ผลรายการที่ได้มาห้ามเอาจุดแดง/ตัวเลขเก่ากลับมา
  // (เดิมเทียบด้วยลำดับ request — ผลรายการที่ "ยิงทีหลัง" ไม่ได้แปลว่า server ล้างเสร็จแล้ว
  //  บนเน็ตช้าจุดแดงกับตัวเลขบนไอคอนแอปจึงเด้งกลับมาทั้งที่แอดมินกำลังอ่านแชทนั้นอยู่)
  const locallyReadRef = useRef<Map<string, number>>(new Map())
  // กันจำค้างถาวรเมื่อ server ไม่เคยยืนยัน (เช่นโหลดข้อความไม่สำเร็จ) — เลยเวลานี้ให้เชื่อ server
  const LOCAL_READ_TTL_MS = 30 * 1000

  // ลบ "ยังไม่อ่าน" ของแชทที่อ่านไปแล้วบนจอ ออกจากผลรายการที่ server ยังตอบค่าเก่ามา (รวมตัวเลขรวมด้วย)
  function applyLocalReads(res: any) {
    const map = locallyReadRef.current
    if (map.size === 0) return
    map.forEach((readAt, id) => {
      const conv = (res.conversations || []).find((c: any) => c.id === id)
      // server ยืนยันแล้วว่าอ่านแล้ว → เลิกจำ (ข้อความใหม่ของแชทนี้หลังจากนี้ต้องขึ้นจุดแดงตามปกติ)
      if (conv && (conv.unread_count || 0) === 0) { map.delete(id); return }
      if (Date.now() - readAt > LOCAL_READ_TTL_MS) { map.delete(id); return }
      if (!conv || !((conv.unread_count || 0) > 0)) return
      conv.unread_count = 0
      if (conv.is_archived) return  // แชทที่จัดเก็บไม่ถูกนับในตัวเลขตั้งแต่แรก
      const pid = conv.page_id
      if (pid && res.unreadByPage) res.unreadByPage[pid] = Math.max(0, (res.unreadByPage[pid] || 0) - 1)
      res.totalUnread = Math.max(0, (res.totalUnread || 0) - 1)
      // อ่านแล้วแต่ข้อความล่าสุดเป็นของลูกค้า → ย้ายไปนับเป็น "ยังไม่ตอบ"
      if (conv.last_sender === 'customer') {
        if (pid && res.needsReplyByPage) res.needsReplyByPage[pid] = (res.needsReplyByPage[pid] || 0) + 1
        res.totalNeedsReply = (res.totalNeedsReply || 0) + 1
      }
    })
  }

  // เอาผลรายการแชทจาก server ไปใช้ — คืน true ถ้าได้แสดงบนจอ
  function applyListResponse(res: any, key: string, seq: number): boolean {
    applyLocalReads(res)
    listEverLoadedRef.current = true
    setListError(null)   // โหลดสำเร็จแล้ว → เอาแถบแดง "โหลดไม่สำเร็จ" ออกเอง ไม่ต้องให้แอดมินกดปิด
    const convs = res.conversations || []
    const cache = listCacheRef.current
    const prev = cache.get(key)
    if (!prev || seq >= prev.seq) {
      cache.delete(key)  // ย้ายไปท้าย = ใช้ล่าสุด
      cache.set(key, { seq, conversations: convs })
      if (cache.size > 40) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
      }
    }
    // ตัวเลขแจ้งเตือน + รายชื่อเพจ ไม่ขึ้นกับเพจ/ตัวกรองที่เลือก → ใช้ผลที่ใหม่กว่าเสมอ
    if (seq > appliedCountsSeqRef.current) {
      appliedCountsSeqRef.current = seq
      registerPageOrder(res.pages || [])  // กำหนดสีประจำเพจ (ไม่ซ้ำ) ก่อน render
      setPages(res.pages || [])
      setTotalUnread(res.totalUnread || 0)
      setTotalNeedsReply(res.totalNeedsReply || 0)
      setUnreadByPage(res.unreadByPage || {})
      setNeedsReplyByPage(res.needsReplyByPage || {})
    }
    const f = listFilterRef.current
    if (key !== listKeyOf(f.pageFilter, f.statusFilter, f.q) || seq < appliedListSeqRef.current) return false
    appliedListSeqRef.current = seq
    setConversations(convs)
    return true
  }

  // แก้แชทในแคชทุก key ให้ตรงกับที่แก้บนจอ (เช่น อ่านแล้ว) — สลับเพจแล้วจุดแดงจะไม่เด้งกลับมา
  function patchCachedConvs(fn: (c: any) => any) {
    listCacheRef.current.forEach(entry => { entry.conversations = entry.conversations.map(fn) })
  }

  // silent = โหลดเบื้องหลัง (poll/realtime) → ไม่โชว์สปินเนอร์ กันจอกระพริบทุก 7 วิ
  // ใช้ตัวกรองปัจจุบันจาก ref เสมอ (callback จาก interval/sync เก่าจะได้ไม่ยิงด้วยเพจเก่า)
  async function loadConversations(opts?: { silent?: boolean }) {
    const silent = opts?.silent
    const f = listFilterRef.current
    const key = listKeyOf(f.pageFilter, f.statusFilter, f.q)
    const seq = ++listSeqRef.current
    if (!silent) { loadingSeqRef.current = seq; setLoadingList(true) }
    const params = new URLSearchParams()
    if (f.pageFilter) params.set('pageId', f.pageFilter)
    if (f.statusFilter !== 'all') params.set('filter', f.statusFilter)
    if (f.q) params.set('q', f.q)
    params.set('limit', String(listLimitRef.current))

    try {
      const r = await fetch(`/api/inbox/conversations?${params.toString()}`)
      if (r.status === 401 || r.status === 403) { setSessionExpired(true); return }
      const res = await r.json()
      if (res.error) { if (!silent || !listEverLoadedRef.current) setListError(friendlyError(res.error)); return }
      setSessionExpired(false)
      applyListResponse(res, key, seq)
    } catch {
      // เน็ตหลุด — ไม่ล้างของเดิมบนจอ รอบถัดไปค่อยลองใหม่
      // โหลดรอบแรกยังไม่เคยสำเร็จ → ต้องบอกเสมอ ไม่งั้นจอขึ้น "ยังไม่มีเพจที่เชื่อมต่อ" ให้เข้าใจผิด
      if (!silent || !listEverLoadedRef.current) setListError('เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    } finally {
      if (!silent && loadingSeqRef.current === seq) setLoadingList(false)
    }
  }

  // ลายเซ็นข้อความ (เนื้อหา + รูปแนบ) — ใช้จับคู่ฟอง optimistic กับแถวจริงจาก server
  function msgKey(m: any): string {
    const atts = (m?.attachments || []).map((a: any) => a?.url).filter(Boolean).sort().join(',')
    return `${(m?.message_text || '').trim()}|${atts}`
  }

  // เก็บ loadConversations ตัวล่าสุดไว้ ให้ callback ที่ยิงทีหลัง (backgroundSync) ใช้ filter ปัจจุบัน
  const loadConvRef = useRef(loadConversations)
  loadConvRef.current = loadConversations

  // รวมข้อความจาก server กับฟอง optimistic ที่ยังไม่มีคู่ในฝั่ง server
  // - ฟองที่ยังส่งอยู่/ส่งไม่สำเร็จ ต้องไม่ถูก poll ลบทิ้ง (ไม่งั้นข้อความที่พิมพ์หายถาวร)
  // - ถ้า server มีแถวเดียวกันแล้ว ต้องตัดฟอง optimistic ทิ้ง ไม่งั้นขึ้น 2 ฟอง + React key ซ้ำ
  // startedAt = เวลาที่ยิง request นี้ออกไป (ใช้ตัดสินว่าแถวบนจอที่ server ไม่ส่งมา คือ "เพิ่งส่งเสร็จ" หรือ "ถูกลบไปแล้ว")
  function mergeServerMessages(serverMsgs: any[], startedAt: number) {
    setMessages(prev => {
      const isTemp = (m: any) => typeof m.id === 'string' && m.id.startsWith('temp-')
      const hidden = retriedServerIdsRef.current           // แถวที่กด "ส่งอีกครั้ง" ไปแล้ว → ไม่เอากลับมา
      const server = serverMsgs.filter(s => !hidden.has(String(s.id)))
      // ฟองชั่วคราวของแชทอื่นห้ามค้างอยู่ในจอนี้ (อัปรูปให้ลูกค้า A แล้วสลับไป B ระหว่างรอ
      // ฟอง "กำลังส่ง" ของ A จะไปค้างอยู่ในแชท B ตลอดกาล เพราะ poll ไม่เคยลบ temp)
      const temps = prev.filter(m => isTemp(m) && (!m.conversation_id || m.conversation_id === openReqRef.current))

      // แถวจริงที่แสดงอยู่บนจอแล้ว = มีเจ้าของแล้ว ห้ามเอาไปจับคู่กับ temp ตัวใหม่
      const shownIds = new Set(prev.filter(m => !isTemp(m)).map(m => String(m.id)))
      // จับคู่ได้แถวละ 1 ฟองเท่านั้น (splice ออกเมื่อจับแล้ว) — ส่ง "ค่ะ" ซ้ำ 2 ครั้งฟองที่ 2 จะไม่หาย
      // ไม่เทียบเวลา เพราะ temp ใช้นาฬิกาเครื่อง ส่วนแถวจริงใช้นาฬิกา server
      // (เครื่องที่ตั้งเวลาเพี้ยนจะจับคู่ไม่ติด แล้วขึ้นฟองซ้ำ) — pool ที่ตัดแถวที่แสดงแล้วออกก็ปลอดภัยพอ
      const pool = server.filter(s => s.direction === 'outbound' && !shownIds.has(String(s.id)))
      const keep = temps.filter(t => {
        const idx = pool.findIndex(s => msgKey(s) === msgKey(t))
        if (idx >= 0) { pool.splice(idx, 1); return false }  // server บันทึกแล้ว → ตัดฟอง optimistic
        return true
      })

      // แถวจริงที่อยู่บนจอแล้วแต่ response รอบนี้ยังไม่มี (poll ที่ยิงก่อนเราส่งข้อความ ตอบช้า)
      // → เก็บไว้เฉพาะแถวที่ "เครื่องนี้เพิ่งบันทึกหลังจาก request นี้ออกไปแล้ว" ไม่งั้นข้อความที่เพิ่งส่งสำเร็จหายไป 7 วิ
      // แถวอื่นที่ server ไม่ส่งมาแล้ว = ถูกลบ/ซ่อนจากเครื่องอื่น → ต้องหายตามไปด้วย
      // (เดิมเก็บไว้ตลอดกาล ทำให้แถวปลอม synthetic-* ค้างคู่กับข้อความจริง และข้อความที่เพื่อนร่วมทีมลบแล้วไม่หาย)
      const serverIds = new Set(server.map(s => String(s.id)))
      const missing = prev.filter(m => !isTemp(m) && !serverIds.has(String(m.id)) && !hidden.has(String(m.id)) && !isHiddenInboxMessage(m)
        && (localRowsRef.current.get(String(m.id)) ?? 0) >= startedAt)

      const seen = new Set<string>()
      const real = [...server, ...missing]
        .filter(m => { const k = String(m.id); if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      // ฟองที่ยังส่งไม่จบต่อท้ายเสมอ (เพิ่งกดส่ง = ใหม่สุด) — ไม่ต้องพึ่งนาฬิกาเครื่อง
      return [...real, ...keep]
    })
  }

  // อัปเดตหัวแชท/คำเตือนของแชทที่เปิดอยู่ ตามข้อมูลล่าสุดจาก server
  // สำคัญที่สุดคือ send_block_code: พอลูกค้าทักกลับมา Facebook ให้ตอบได้แล้ว แต่แถบส้ม "ห้ามตอบ" ยังค้าง
  // แอดมินเลยไม่กล้าตอบ (เดิมค่าเหล่านี้อัปเดตเฉพาะตอนปิดแล้วเปิดแชทใหม่)
  // เอาเฉพาะค่าที่ server เป็นเจ้าของ — ไม่แตะ ติดดาว/จบ/จัดเก็บ เพราะแอดมินกดแล้วเห็นผลทันที (optimistic)
  // ถ้าเอาค่าจาก poll มาทับ ปุ่มที่เพิ่งกดจะเด้งกลับ
  function mergeServerConvMeta(convId: string, sc: any) {
    if (!sc || openReqRef.current !== convId) return
    setActiveConv((c: any) => {
      if (!c || c.id !== convId) return c
      const patch: any = {}
      for (const k of ['send_block_code', 'send_block_at', 'customer_name', 'customer_picture', 'last_sender', 'last_message_at']) {
        if (k in sc && sc[k] !== c[k]) patch[k] = sc[k]
      }
      return Object.keys(patch).length ? { ...c, ...patch } : c   // ไม่มีอะไรเปลี่ยน = คืนตัวเดิม ไม่ re-render
    })
  }

  // ลดตัวเลข "ยังไม่อ่าน" บนจอให้ตรงกับที่ server เพิ่งล้างให้ (ทั้งตอนกดเปิดแชท และตอนโหลดข้อความเบื้องหลัง)
  // ไม่ทำ = จุดแดงของแชทกับตัวเลขบนไอคอนแอปค้างอยู่จนกว่ารายการจะโหลดรอบหน้า
  function markConvReadLocally(conv: any) {
    const convId = conv.id
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    patchCachedConvs(c => c.id === convId ? { ...c, unread_count: 0 } : c)
    // แชทที่จัดเก็บไว้ไม่ถูกนับในตัวเลขตั้งแต่แรก → ไม่ต้องปรับ
    if (!conv.page_id || conv.is_archived) return
    setUnreadByPage(prev => ({ ...prev, [conv.page_id]: Math.max(0, (prev[conv.page_id] || 0) - 1) }))
    setTotalUnread(t => Math.max(0, t - 1))
    // อ่านแล้วแต่ข้อความล่าสุดเป็นของลูกค้า → ตอนนี้นับเป็น "ยังไม่ตอบ"
    if (conv.last_sender === 'customer') {
      setNeedsReplyByPage(prev => ({ ...prev, [conv.page_id]: (prev[conv.page_id] || 0) + 1 }))
      setTotalNeedsReply(t => t + 1)
    }
  }

  async function loadMessages(conv: any) {
    const convId = conv?.id
    if (!convId) return
    // ทุกครั้งที่กดเปิดแชทมี "ตั๋ว" ของตัวเอง — เปิดแชทเดิมซ้ำแล้วผลของครั้งก่อนตอบช้า จะได้ไม่ทับผลใหม่
    // (เช็คแค่ id ไม่พอ เพราะเป็นแชทเดียวกัน ผลเก่าจึงผ่านด่าน)
    const seq = ++openSeqRef.current
    const isThisOpen = () => openSeqRef.current === seq && openReqRef.current === convId
    stashDraft()   // เก็บที่พิมพ์ค้างไว้ของแชทเดิมก่อน แล้วค่อยสลับ
    // เปิดหน้าแชททันที (optimistic) จากข้อมูลใน list → จอสลับไว ไม่ต้องรอ API
    openReqRef.current = convId
    detailAppliedRef.current = 0
    localRowsRef.current.clear()
    lastMsgIdRef.current = null
    lastRealMsgIdRef.current = null
    nearBottomRef.current = true
    setNewMsgCount(0)
    setActiveConv(conv)
    pushChatHistory(convId)   // กดปุ่มย้อนกลับของเครื่อง = กลับไปหน้ารายการแชท ไม่ใช่ออกจากแอป
    // ข้อความที่ส่งไม่สำเร็จตอนแอดมินออกจากแชทนี้ไป ต้องกลับมาพร้อมปุ่ม "ส่งอีกครั้ง"
    setMessages([...(outboxRef.current.get(convId) || [])])
    // ช่องพิมพ์ถูกสร้างใหม่ตาม key ของแชท → อ่านค่าเริ่มต้นจาก draftsRef เอง
    draftValueRef.current = draftsRef.current.get(convId) || ''
    setAiSuggestions([])
    setErrorBanner(null)
    setShowChatMenu(false)
    clearPendingFiles()   // ไฟล์รูปที่ค้างจากแชทก่อนหน้า ใช้กับแชทนี้ไม่ได้อยู่แล้ว
    setLoadingMessages(true)
    // optimistic: เคลียร์ทั้ง badge ของ row + ตัวเลขรวม (page tile / ชิป "ใหม่" / sidebar) ทันที
    // + จำไว้ว่าอ่านแชทนี้แล้วตอนกี่โมง — ผลรายการที่ยังตอบ "ยังไม่อ่าน" มา จะได้ไม่เอาจุดแดงกลับมา
    //   (จำจนกว่า server จะยืนยันว่า 0 หรือครบ 30 วิ)
    if ((conv.unread_count || 0) > 0) {
      locallyReadRef.current.set(convId, Date.now())
      markConvReadLocally(conv)
    }
    const startedAt = Date.now()
    try {
      const r = await fetch(`/api/inbox/conversations/${convId}`)
      if (!isThisOpen()) return  // เปิดแชทอื่น/เปิดแชทนี้ใหม่ไปแล้ว — ทิ้งผลเก่า
      if (r.status === 401 || r.status === 403) { setSessionExpired(true); return }
      if (!r.ok) {
        // ไม่งั้นจะขึ้น "ยังไม่มีข้อความในบทสนทนานี้" เงียบๆ เหมือนประวัติแชทหายไป
        setErrorBanner('โหลดข้อความไม่สำเร็จ — ลองกดเข้าแชทใหม่อีกครั้ง')
        return
      }
      const res = await r.json()
      if (!isThisOpen()) return
      if (res.conversation) {
        setActiveConv(res.conversation)
        // ข้อความใน outbox ที่ server บันทึกไว้แล้วจริงๆ (เช่นส่งติดแต่ตอบกลับไม่ทัน) → เอาออก ไม่ให้ขึ้นซ้ำ
        // จับคู่ได้แถวละ 1 ใบเท่านั้น (splice ออกเมื่อจับแล้ว) เหมือน mergeServerMessages
        // ไม่งั้น "ค่ะ" ที่ส่งไม่สำเร็จจะถูกลบทิ้ง เพราะบังเอิญเคยส่ง "ค่ะ" สำเร็จมาก่อนหน้านี้ — ข้อความหายโดยไม่มีใครรู้
        const pend = outboxRef.current.get(convId)
        if (pend?.length) {
          const pool = (res.messages || []).filter((s: any) => s.direction === 'outbound').map(msgKey)
          const left = pend.filter((p: any) => {
            const idx = pool.indexOf(msgKey(p))
            if (idx >= 0) { pool.splice(idx, 1); return false }
            return true
          })
          if (left.length) outboxRef.current.set(convId, left)
          else outboxRef.current.delete(convId)
        }
        // merge ไม่ใช่ทับ — ระหว่างรอโหลด แอดมินกดส่งข้อความได้ ฟอง "กำลังส่ง"/"ส่งไม่สำเร็จ" ต้องไม่หาย
        mergeServerMessages(res.messages || [], startedAt)
      }
    } catch {
      if (isThisOpen()) setErrorBanner('โหลดข้อความไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      if (isThisOpen()) setLoadingMessages(false)
    }
    if (isThisOpen()) pinMessagesToBottom()
  }

  // เน็ตหลุด/หน้า error ของ Vercel (ไม่ใช่ JSON) ต้องไม่ทำให้รายการที่มีอยู่หายไปเป็นค่าว่าง
  // และต้องไม่เป็น unhandled rejection (เดิมยิงตอน mount โดยไม่มี catch)
  // pageId = แถวเพจของแชทที่เปิดอยู่ → ให้ server คัดมาเฉพาะข้อความบันทึกของเพจนี้ (+ ของกลาง)
  // ร้านที่ดูแลหลายเพจจะได้ไม่เห็นข้อความบันทึกของอีกเพจปนมา (ฝั่ง client ยังกรองซ้ำอีกชั้นที่ repliesForActive)
  async function loadQuickReplies(pageId?: string) {
    const key = pageId || ''
    try {
      const r = await fetch(`/api/inbox/quick-replies${key ? `?pageId=${encodeURIComponent(key)}` : ''}`)
      if (!r.ok) { setQrLoadFailed(true); return }
      const d = await r.json()
      if (Array.isArray(d?.replies)) { setQuickReplies(d.replies); setQrLoadFailed(false); qrLoadedForRef.current = key }
    } catch {
      setQrLoadFailed(true)   // เก็บรายการเดิมไว้ แล้วลองใหม่ตอนเปิดแผ่นข้อความบันทึก
    }
  }

  function openRename(p: any) {
    setRenamePage(p)
    setNicknameDraft(p.nickname || '')
    setNicknameError(null)
  }

  async function saveNickname() {
    if (!renamePage || savingNickname) return
    setSavingNickname(true)
    setNicknameError(null)
    try {
      const res = await fetch('/api/inbox/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: renamePage.id, nickname: nicknameDraft.trim() || null }),
      })
      const data = await res.json().catch(() => ({} as any))   // 502/504 ตอบเป็น HTML — ห้ามให้ parse พัง
      if (!res.ok || !data.success) {
        setNicknameError(friendlyError(data.error) || 'บันทึกชื่อเล่นไม่สำเร็จ — ลองใหม่อีกครั้ง')
        return
      }
      setRenamePage(null)
      await loadConversations()
    } catch (e: any) {
      // เน็ตหลุด — ต้องบอกในกล่อง ไม่งั้นแอดมินกดซ้ำแล้วไม่มีอะไรเกิดขึ้นเลย
      setNicknameError(friendlyError(e?.message))
    } finally {
      setSavingNickname(false)
    }
  }

  // ── Background sync (silent — no spinner) ──
  // ยิงซ้อนกันไม่ได้ (syncInFlightRef) เพราะทั้ง poll, การกลับเข้าแอป และปุ่ม "ดึงข้อความใหม่" เรียกตัวเดียวกัน
  // แต่ต้องปลดล็อกเองได้ด้วย — รอบที่ fetch ค้าง (เน็ตมือถือหลุดกลางคัน) เคยล็อกทางเดียวที่ข้อความลูกค้าเข้าระบบไว้ถาวร
  const syncBusy = () => syncInFlightRef.current && Date.now() - syncStartedAtRef.current < SYNC_STUCK_MS
  // ผลของรอบซิงก์ — ran = มีเพจที่ดึงจริงอย่างน้อย 1 เพจ / skipped = ถูกข้ามทั้งหมด (เหตุผลจาก server)
  type SyncRound = { ok: boolean; ran: boolean; skipped: 'recent' | 'in_progress' | null }
  // force = แอดมินสั่งเอง (ปุ่มดึงข้อความใหม่ / กลับเข้าแอป) → ข้ามตัวกันยิงถี่ 45 วิ ของ server
  // ห้ามใส่ force ให้รอบอัตโนมัติทุก 60 วิ ไม่งั้น Facebook จะจำกัดอัตราเอา
  async function backgroundSync(pageId?: string, force?: boolean): Promise<SyncRound> {
    if (syncBusy()) return { ok: false, ran: false, skipped: 'in_progress' }
    syncInFlightRef.current = true
    syncStartedAtRef.current = Date.now()
    lastFbSyncRef.current = Date.now()
    let ranSomething = false
    let skippedAll: 'recent' | 'in_progress' | null = null
    let ok = false
    // ดึงทั้งรอบไม่สำเร็จ (504 ของ Vercel / เน็ตหลุด) → บอกสั้นๆ ว่าระบบจะลองใหม่ให้เอง
    // ใช้ syncNotice ไม่ใช่ errorBanner เพราะ errorBanner ใช้บอกผลที่แอดมินสั่งเอง ("ส่งไม่สำเร็จ") ห้ามถูกทับ
    const noticeSyncDown = () => {
      const sig = 'sync-down'
      if (sig === dismissedSyncSigRef.current) return
      // ปัญหาชั่วคราวของรอบนี้ห้ามทับเรื่องที่สำคัญกว่าซึ่งค้างอยู่ (เช่น "การเชื่อมต่อเพจหมดอายุ")
      setSyncNotice(cur => (cur && cur.sig !== sig) ? cur : { sig, text: 'ดึงข้อความใหม่จาก Facebook ไม่สำเร็จ — จะลองใหม่อัตโนมัติ' })
    }
    try {
      // มีเวลาจำกัดเสมอ — ไม่งั้น fetch ค้างตอนสลับ wifi↔4G จะล็อก syncInFlightRef ไว้ถาวร
      const res = await fetchWithTimeout('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(pageId ? { pageId } : {}), ...(force ? { force: true } : {}) }),
      }, SYNC_TIMEOUT_MS)
      // 502/504 ของ Vercel ตอบเป็น HTML — เดิม res.json() พังแล้วถูก catch กลืน แอดมินไม่รู้เลยว่าไม่ได้ดึงข้อความใหม่
      if (!res.ok) {
        console.error('[inbox/sync] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 500))
        noticeSyncDown()
        return { ok: false, ran: false, skipped: null }
      }
      const data = await res.json().catch(() => null)
      if (!data) { noticeSyncDown(); return { ok: false, ran: false, skipped: null } }
      ok = true
      // รอบนี้ได้ดึงจริงหรือถูกข้ามทั้งหมด (เพิ่งดึงไป / เครื่องอื่นกำลังดึงเพจนี้อยู่)
      // ต้องรู้ให้ได้ ไม่งั้น "กดแล้วสปินเนอร์หยุด" จะแปลว่าได้ข้อความใหม่แล้วทั้งที่ยังไม่ได้ดึงเลย
      const summary: any[] = data?.summary || []
      ranSomething = summary.some((p: any) => !p?.skipped)
      if (summary.length > 0 && !ranSomething) {
        skippedAll = summary.some((p: any) => p?.skipped === 'in_progress') ? 'in_progress' : 'recent'
      }
      // หลัง sync เสร็จ → trigger repair ถ้ามี empty messages ค้างอยู่
      // (ทำเงียบๆ ไม่รอผล ไม่ block UI — silent ไม่งั้นลิสต์จะขึ้น "กำลังโหลด..." ทุกรอบที่ซิงก์)
      fetch('/api/inbox/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageId ? { pageId } : {}),
      }).then(() => loadConvRef.current({ silent: true })).catch(() => {})
      // ดึงข้อมูลจาก Facebook ไม่สำเร็จ → บอกเป็นภาษาที่แอดมินร้านทำต่อได้ (ไม่ใช่ error ดิบของ Graph)
      // และแยกที่แสดงออกจากแบนเนอร์ในห้องแชท ไม่งั้นข้อความ "ส่งไม่สำเร็จ" ที่แอดมินต้องอ่านจะถูกทับทุกรอบ
      const bad: string[] = []
      let tokenDead = false
      for (const p of (data?.summary || [])) {
        if (!p?.errors?.length) continue
        const joined = String(p.errors.join(' '))
        console.warn('[inbox/sync]', p.page_name || p.page_id || 'page', joined.slice(0, 500))   // error ดิบของ Graph อยู่ใน console เท่านั้น ห้ามขึ้นจอ
        if (/access token|OAuthException|session has been invalidated|\(#190\)|code[:\s]*190\b/i.test(joined)) tokenDead = true
        bad.push(p.page_name || 'เพจ')
      }
      if (bad.length === 0) {
        setSyncNotice(null)
        dismissedSyncSigRef.current = ''
      } else {
        const sig = `${tokenDead ? 'token' : 'other'}|${bad.join(',')}`
        const text = tokenDead
          ? `ดึงข้อความใหม่จาก ${bad.join(', ')} ไม่สำเร็จ — การเชื่อมต่อเพจหมดอายุ ให้เจ้าของเพจไปที่เมนู "ช่องทางแชท" แล้วเชื่อมเพจใหม่อีกครั้ง`
          : `ดึงข้อความใหม่จาก ${bad.join(', ')} ไม่สำเร็จ — จะลองใหม่อัตโนมัติ`
        if (sig !== dismissedSyncSigRef.current) setSyncNotice({ sig, text })
      }
    } catch (e) {
      // เน็ตหลุด/ยกเลิกกลางคัน — บอกด้วยข้อความเดียวกัน แล้วรอบถัดไปลองใหม่เอง (แถบนี้หายเองเมื่อดึงสำเร็จ)
      console.error('[inbox/sync] request failed', e)
      noticeSyncDown()
    } finally {
      syncInFlightRef.current = false     // ปลดเสมอ แม้หมดเวลารอ — ไม่งั้นทางเดียวที่ข้อความลูกค้าเข้าระบบจะตายไปเลย
      // ดึงจริง → นับจากตอน "เสร็จ" (รอบที่ใช้เวลานานจะได้ไม่จ่อคิวต่อทันที)
      // ถูกข้ามทั้งหมด → รอบนี้ไม่ได้ทำอะไร อย่าให้ดันรอบจริงถัดไปออกไปเต็มนาที
      if (ranSomething) lastFbSyncRef.current = Date.now()
      else if (skippedAll) lastFbSyncRef.current = Date.now() - SYNC_SKIPPED_BACKOFF_MS
    }
    return { ok, ran: ranSomething, skipped: skippedAll }
  }

  // ดึงข้อความใหม่จาก Facebook แล้วรีเฟรชจอ — ทางเดียวที่ทุกจุดเรียกใช้ (poll / กลับเข้าแอป / ปุ่มดึงเอง)
  // minGapMs = เพิ่งดึงไปไม่ถึงเท่านี้ ไม่ต้องดึงซ้ำ (ฝั่ง server มีตัวกันยิงถี่อีกชั้นอยู่แล้ว)
  // force = แอดมินสั่งเอง → ส่งต่อให้ server ข้ามตัวกันยิงถี่ 45 วิ
  async function maybeSync(minGapMs: number, force = false): Promise<SyncRound | null> {
    if (syncBusy()) return null
    if (Date.now() - lastFbSyncRef.current < minGapMs) return null
    const round = await backgroundSync(undefined, force)
    loadConvRef.current({ silent: true })
    loadMessagesSilentRef.current?.()   // แชทที่เปิดอยู่เห็นข้อความใหม่ทันที ไม่ต้องรอ poll รอบหน้า
    return round
  }
  const maybeSyncRef = useRef(maybeSync)
  maybeSyncRef.current = maybeSync

  // ปุ่ม "ดึงข้อความใหม่" — ระบบดึงให้เองทุกนาทีอยู่แล้ว แต่ตอนลูกค้าสั่งรัวๆ แอดมินอยากกดเองให้แน่ใจ
  // (หน้านี้ล็อกการเลื่อนไว้ ลากลงเพื่อรีเฟรชแบบแอปอื่นจึงใช้ไม่ได้)
  // กดแล้วต้องมีอะไรตอบเสมอ — เดิมถ้ามีรอบค้างอยู่จะ return เงียบๆ ไม่มีสปินเนอร์ ไม่มีข้อความ เหมือนปุ่มเสีย
  async function manualSync() {
    if (syncing) return
    if (syncBusy()) { setToast({ msg: 'กำลังดึงข้อความใหม่อยู่ — รอสักครู่' }); return }
    setSyncing(true)
    try {
      const round = await maybeSync(0, true)   // แอดมินกดเอง = ต้องได้ของใหม่จริง ไม่ใช่โดนข้ามเงียบๆ
      // server ข้ามรอบนี้ทั้งหมด → บอกตามจริง ไม่งั้นสปินเนอร์หยุดแล้วเข้าใจว่าดึงข้อความใหม่มาแล้ว
      if (round?.skipped === 'recent') setToast({ msg: 'เพิ่งดึงข้อความใหม่ไปเมื่อครู่ — ข้อมูลล่าสุดแล้ว' })
      else if (round?.skipped === 'in_progress') setToast({ msg: 'กำลังดึงข้อความใหม่อยู่ — รอสักครู่แล้วลองอีกครั้ง' })
    } finally { setSyncing(false) }
  }

  // ── ตามขนาด "visual viewport" จริง (กันคีย์บอร์ด iOS ดัน layout เด้ง / แถบล่างลอย) ──
  // ใช้ visualViewport.height (หดตามคีย์บอร์ด) แทน innerHeight (ไม่หดบน iOS)
  // + ตาม offsetTop ที่เบราว์เซอร์เลื่อน visual viewport เพื่อให้ composer อยู่เหนือคีย์บอร์ดเป๊ะ
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    let raf = 0
    const apply = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {  // batch — กัน layout thrash จาก scroll event ถี่ๆ
        const raw = vv && vv.height > 0 ? vv.height : window.innerHeight
        // clamp กันค่า transient เล็กผิดปกติ — ต่ำได้ถึง 120px เพราะมือถือแนวนอนเปิดคีย์บอร์ด
        // เหลือพื้นที่จริงแค่ ~150-190px ถ้าตรึงไว้ที่ 240 ช่องพิมพ์จะจมอยู่ใต้คีย์บอร์ด
        const h = Math.max(Math.round(raw), 120)
        const top = vv ? Math.max(Math.round(vv.offsetTop), 0) : 0
        root.style.setProperty('--app-height', `${h}px`)
        root.style.setProperty('--app-offset', `${top}px`)
        // คีย์บอร์ดเปิด = viewport หดลงมากกว่า 120px → ตัด safe-area padding ทิ้ง
        // (ไม่งั้นมีแถบขาวคั่นระหว่างช่องพิมพ์กับคีย์บอร์ด)
        const kbOpen = window.innerHeight - h > 120
        root.style.setProperty('--kb-open', kbOpen ? '0' : '1')
      })
    }
    apply()
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)  // offsetTop เปลี่ยนตอนเบราว์เซอร์เลื่อนเข้า input
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
    }
  }, [])

  // รู้ว่าเป็น owner หรือ agent → ซ่อนเมนู "ช่องทางแชท" / "จัดการทีม" สำหรับลูกทีม
  // โหลดไม่สำเร็จ = "ยังไม่รู้" (null) ไม่ใช่ "ไม่ใช่เจ้าของ" แล้วลองใหม่ให้เอง
  // (เดิมเน็ตสะดุดจังหวะเปิดแอปครั้งเดียว เมนูของเจ้าของร้านจะหายไปทั้งวันจนกว่าจะปิดแอปแล้วเปิดใหม่)
  useEffect(() => {
    let cancelled = false, tries = 0, done = false
    const loadRole = async () => {
      try {
        const r = await fetch('/api/me')
        if (!r.ok) throw new Error(String(r.status))
        const d = await r.json()
        if (cancelled) return
        if (!d?.authenticated) throw new Error('unauthenticated')
        setIsOwner(!!d.role?.isOwner)
        // ลูกทีมที่เข้าด้วย Facebook ก็ไม่เห็นเมนูนี้ — เฉพาะเจ้าของร้านที่ยังไม่มีช่องทางแรก
        setCanManageChannels(!!d.role?.isOwner || (!!d.user?.facebookId && !d.role?.isAgentOnly))
        done = true
      } catch {
        if (cancelled || tries >= 3) return
        tries += 1
        setTimeout(loadRole, 1500 * tries)   // 1.5 / 3 / 4.5 วินาที
      }
    }
    loadRole()
    const retryWhenBack = () => {
      if (done || cancelled) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      tries = 0
      loadRole()
    }
    document.addEventListener('visibilitychange', retryWhenBack)
    window.addEventListener('online', retryWhenBack)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', retryWhenBack)
      window.removeEventListener('online', retryWhenBack)
    }
  }, [])

  // ── Initial load + auto-sync on mount (with throttle) ──
  useEffect(() => {
    // ไม่เรียก loadConversations ที่นี่ — effect [pageFilter, statusFilter, debouncedSearch]
    // ยิงให้อยู่แล้วตอน mount (เดิมยิงซ้ำ 2 ครั้งพร้อมกัน ทำให้ลิสต์กระตุก/สีเพจเปลี่ยนเอง)
    loadQuickReplies()
    // Auto-sync ตอนเปิดแอพ (กัน rate limit ด้วย localStorage throttle 1 นาที)
    try {
      const last = Number(localStorage.getItem('inbox_last_mount_sync') || 0)
      if (Date.now() - last > 60 * 1000) {
        localStorage.setItem('inbox_last_mount_sync', String(Date.now()))
        setSyncing(true)
        // เปิดแอปเอง = แอดมินสั่ง → force (ยังถูกกันไว้ 1 ครั้ง/นาที ด้วย localStorage ข้างบน)
        backgroundSync(undefined, true)
          // ใช้ ref → ได้ตัวล่าสุดที่รู้จัก filter/ค้นหาปัจจุบัน (เดิมใช้ closure ของ render แรก
          // ทำให้ทับลิสต์ที่ผู้ใช้กรองไว้) + silent กันสปินเนอร์เด้ง
          .then(() => loadConvRef.current({ silent: true }))
          .finally(() => setSyncing(false))
      }
    } catch {
      // localStorage may fail in private mode — ไม่เป็นไร
    }
  }, [])

  // เปลี่ยนเพจ → load จาก DB ก่อน
  // ถ้าเพจนั้นยังไม่มีข้อความใน DB เลย (ไม่เคย sync) → auto-trigger sync
  // throttle ด้วย ref → ไม่ sync ซ้ำเพจเดียวกันบ่อยกว่า 2 นาที
  const lastPageSyncRef = useRef<Record<string, number>>({})

  // หน่วงคำค้น 350ms แล้วค่อยยิง server (เดิมกรองแค่แชทที่โหลดมาแล้ว → ลูกค้าเก่าหาไม่เจอ)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  // ตัวกรองปัจจุบัน — อัปเดตทุก render ก่อน effect ทำงาน (loadConversations/แคชอ่านจากตรงนี้)
  listFilterRef.current = { pageFilter, statusFilter, q: debouncedSearch }

  const prevListFilterRef = useRef<{ pageFilter: string; statusFilter: string; q: string } | null>(null)
  // layout effect: สลับรายการ/สปินเนอร์ให้เสร็จก่อนจอวาด — ไม่งั้นกดเพจแล้วจะแว้บขึ้น "ยังไม่มีข้อความ" 1 เฟรม
  useLayoutEffect(() => {
    const key = listKeyOf(pageFilter, statusFilter, debouncedSearch)
    const prevF = prevListFilterRef.current
    const changed = !!prevF && listKeyOf(prevF.pageFilter, prevF.statusFilter, prevF.q) !== key
    prevListFilterRef.current = { pageFilter, statusFilter, q: debouncedSearch }

    if (changed) {
      listScrollTopRef.current = 0   // คนละรายการแล้ว — ตำแหน่งเลื่อนเดิมใช้ไม่ได้
      // แสดงผลทันทีโดยไม่รอ server: แคชของ key นี้ → หรือตัดจากรายการ "ทุกเพจ" ที่โหลดไว้แล้ว
      const cached = listCacheRef.current.get(key)
      const all = listCacheRef.current.get(listKeyOf('', 'all', ''))
      if (cached) setConversations(cached.conversations)
      else if (pageFilter && statusFilter === 'all' && !debouncedSearch && all) {
        setConversations(all.conversations.filter((c: any) => c.page_id === pageFilter))
      } else if (prevF && (prevF.pageFilter !== pageFilter || prevF.statusFilter !== statusFilter)) {
        // ไม่มีข้อมูลของเพจ/ตัวกรองนี้เลย → ขึ้น "กำลังโหลด" ดีกว่าโชว์แชทของเพจ/ตัวกรองเดิมค้างไว้
        setConversations([])
      }
      // กลับไปโหลด 50 รายการแรก — effect จะวิ่งใหม่เองอีกรอบเดียว (ไม่ยิง request ซ้ำ 2 ครั้ง)
      if (listLimit !== 50) { setLoadingList(true); setListLimit(50); return }
    }

    let cancelled = false
    ;(async () => {
      // Fetch ก่อน เช็ค response ตรงๆ (ไม่พึ่ง state ที่ยังไม่ re-render)
      const params = new URLSearchParams()
      if (pageFilter) params.set('pageId', pageFilter)
      if (statusFilter !== 'all') params.set('filter', statusFilter)
      if (debouncedSearch) params.set('q', debouncedSearch)
      params.set('limit', String(listLimit))
      const seq = ++listSeqRef.current
      loadingSeqRef.current = seq
      const stopLoading = () => { if (loadingSeqRef.current === seq) setLoadingList(false) }
      setLoadingList(true)
      let res: any = {}
      try {
        const r = await fetch(`/api/inbox/conversations?${params.toString()}`)
        if (r.status === 401 || r.status === 403) { if (!cancelled) setSessionExpired(true); stopLoading(); return }
        // 500 ฯลฯ — ห้ามล้างลิสต์เป็นค่าว่าง ไม่งั้นจอขึ้น "ยังไม่มีเพจที่เชื่อมต่อ" ให้เข้าใจผิด
        if (!r.ok) {
          if (!cancelled) setListError('โหลดรายการแชทไม่สำเร็จ — ลองใหม่อีกครั้ง')
          stopLoading()
          return
        }
        res = await r.json()
        if (res.error) {
          if (!cancelled) setListError(friendlyError(res.error))
          stopLoading()
          return
        }
      } catch {
        if (!cancelled) setListError('เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
        stopLoading()
        return
      }
      // ถึงจะสลับไปเพจอื่นแล้ว ผลนี้ก็ยังเก็บเข้าแคชได้ (applyListResponse ไม่เอาไปแสดงผิดเพจ)
      applyListResponse(res, key, seq)
      stopLoading()
      if (cancelled) return

      // Auto-sync ถ้าเลือกเพจที่ยังไม่มี conv ใน DB + ไม่ได้ sync ใน 2 นาทีล่าสุด
      // (ไม่ทำตอนกำลังค้นหา — ผลว่างเพราะไม่ตรงคำค้น ไม่ใช่เพราะยังไม่ sync)
      if (pageFilter && !debouncedSearch && (res.conversations || []).length === 0) {
        const now = Date.now()
        const last = lastPageSyncRef.current[pageFilter] || 0
        if (now - last > 2 * 60 * 1000) {
          lastPageSyncRef.current[pageFilter] = now
          setPageSyncing(true)
          try {
            await backgroundSync(pageFilter)
            if (!cancelled) await loadConversations({ silent: true })
          } finally {
            setPageSyncing(false)  // ปลดเสมอ — ไม่งั้นพิมพ์ค้นหาระหว่าง sync แล้วสปินเนอร์ค้างตลอด
          }
        }
      }
    })()
    return () => { cancelled = true }
  }, [pageFilter, statusFilter, debouncedSearch, listLimit])

  // โหลดรายการแชทของแต่ละเพจเก็บไว้ล่วงหน้า (ครั้งเดียวหลังเปิดแอป)
  // → กดสลับเพจครั้งแรกก็ขึ้นทันที แล้วค่อยอัปเดตเบื้องหลัง
  // เพจที่มีแชทใหม่ก่อน (แอดมินจะกดเข้าอันนั้นก่อนอยู่แล้ว) + ทีละเพจแบบเว้นจังหวะ
  // ไม่งั้นมือถือต้องแย่งเน็ตกับการเปิดแชทแรกของแอดมิน ทั้งที่ทุก request ตอบตัวเลข/รายชื่อเพจชุดเดิมซ้ำๆ
  const pagesRef = useRef<any[]>([])
  pagesRef.current = pages
  const unreadByPageRef = useRef<Record<string, number>>({})
  unreadByPageRef.current = unreadByPage
  const hasManyPages = pages.length >= 2
  const prefetchedRef = useRef(false)
  useEffect(() => {
    if (!hasManyPages || prefetchedRef.current) return
    // เน็ตช้า/โหมดประหยัดเน็ต → ไม่ต้องโหลดล่วงหน้า (ผู้ใช้กดเพจไหนค่อยโหลดเพจนั้น)
    const conn: any = typeof navigator !== 'undefined' ? (navigator as any).connection : null
    if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')) return
    let stopped = false
    const timer = setTimeout(async () => {
      prefetchedRef.current = true
      const un = unreadByPageRef.current
      const ids: string[] = [...pagesRef.current]
        .sort((a: any, b: any) => (un[b.id] || 0) - (un[a.id] || 0))
        .map((pg: any) => pg.id)
        .slice(0, 8)
      for (const id of ids) {
        if (stopped) return
        const key = listKeyOf(id, 'all', '')
        if (listCacheRef.current.has(key)) continue
        const seq = ++listSeqRef.current
        try {
          const r = await fetch(`/api/inbox/conversations?pageId=${encodeURIComponent(id)}&limit=50`)
          if (!r.ok) continue
          const res = await r.json()
          if (!res.error && !stopped) applyListResponse(res, key, seq)
        } catch {}
        await new Promise(r => setTimeout(r, 300))   // เว้นจังหวะ ไม่ถือคิวเน็ตค้างไว้ตอนแอดมินกำลังกด
      }
    }, 1500)
    return () => { stopped = true; clearTimeout(timer) }
  }, [hasManyPages])


  // Poll DB ทุก 7 วิ (poll DB ของเราเอง ไม่กิน rate limit FB) → จออัปเดตเองไม่ต้องรีเฟรช
  // ตั้งครั้งเดียวตอนเปิดหน้า (deps []) — เดิมผูกกับแชท/ตัวกรองที่เลือก ตัวจับเวลาจึงถูกรีเซ็ตทุกครั้งที่แตะจอ
  // แอดมินที่สลับแชทถี่กว่า 7 วิ (ช่วงลูกค้าเยอะ) จะไม่เคยได้ tick เลย = ลิสต์ค้างและไม่ได้ดึงข้อความใหม่จาก Facebook
  // ทุก callback อ่านของล่าสุดผ่าน ref (loadConvRef / loadMessagesSilentRef / maybeSyncRef) จึงไม่ค้างตัวกรองเก่า
  useEffect(() => {
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const t = setInterval(() => {
      loadConvRef.current({ silent: true })   // ทำตลอด แม้แอปอยู่เบื้องหลัง — ตัวเลขบนไอคอนแอปจะได้ตรง
      if (!visible()) return
      loadMessagesSilentRef.current?.()
      // ดึงข้อความใหม่จาก Facebook ~1 นาทีครั้งระหว่างที่แอดมินเปิดจออยู่
      // (webhook ของ Facebook ยังไม่ส่งมา นี่คือทางเดียวที่ข้อความลูกค้าเข้าระบบ)
      // หยุดตอนแอปอยู่เบื้องหลัง — ประหยัดแบตกับเน็ตมือถือ
      maybeSyncRef.current(60 * 1000)
    }, 7000)
    return () => clearInterval(t)
  }, [])

  // ตัวเลขแชทใหม่บนชื่อแท็บ / ไอคอนแท็บ / ไอคอนแอปที่ติดตั้ง (นับทุกเพจที่เข้าถึงได้)
  useEffect(() => { updateAppBadge(totalUnread) }, [totalUnread])
  useEffect(() => () => resetTabBadge(), [])

  // ── Realtime: เด้งทันทีเมื่อมีข้อความ/แชทใหม่ (Supabase Realtime) ──
  // ถ้ายังไม่ได้ตั้ง SUPABASE_JWT_SECRET → endpoint คืน token=null → ใช้ poll 7 วิ อย่างเดียว
  // โหลดข้อความ + สถานะของแชทที่เปิดอยู่ใหม่แบบเงียบ (poll / realtime / หลังลบข้อความไม่สำเร็จ)
  loadMessagesSilentRef.current = () => {
    const convId = activeConv?.id
    if (!convId) return
    // แอปอยู่เบื้องหลัง = แอดมินไม่ได้มองจอ → ไม่ต้องดึง
    // API นี้ล้าง "ยังไม่อ่าน" ให้ทุกครั้งที่เรียก ถ้าดึงตอนแอปอยู่เบื้องหลัง
    // ข้อความใหม่ในแชทที่เปิดค้างไว้จะกลายเป็น "อ่านแล้ว" ของทั้งทีม โดยไม่มีใครได้เห็น
    // (ตัวเลขบนไอคอนแอป/ชิป "ใหม่" ก็ไม่ขึ้น) — พอกลับเข้าแอปค่อยดึงแล้วค่อยทำเป็นอ่านแล้ว
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    const seq = ++detailSeqRef.current
    const startedAt = Date.now()
    fetch(`/api/inbox/conversations/${convId}`)
      .then(r => r.json())
      .then(res => {
        // ต้องยังเปิดแชทเดิมอยู่ ไม่งั้นข้อความลูกค้าคนอื่นจะโผล่ผิดแชท
        // + ผลที่ยิงก่อนแต่มาทีหลัง ห้ามทับผลที่ใหม่กว่า
        if (openReqRef.current !== convId || seq < detailAppliedRef.current) return
        detailAppliedRef.current = seq
        if (res.messages) mergeServerMessages(res.messages, startedAt)
        mergeServerConvMeta(convId, res.conversation)
        // ค่าที่ได้กลับมาคือค่าก่อนที่ API จะล้างให้ → >0 แปลว่ารอบนี้เพิ่งทำเป็น "อ่านแล้ว"
        // ลดตัวเลขบนจอตามทันที ไม่ต้องรอรายการโหลดรอบหน้า
        if (res.conversation && (res.conversation.unread_count || 0) > 0) {
          // ตอนกดเปิดแชทลดตัวเลขไปแล้ว → ห้ามลดซ้ำ (ไม่งั้นตัวเลขบนไอคอนแอปหายไปมากกว่าความจริง)
          const already = locallyReadRef.current.has(convId)
          locallyReadRef.current.set(convId, Date.now())   // ผลรายการที่ยังตอบค่าเก่ามา ห้ามเอาจุดแดงกลับมา
          if (!already) markConvReadLocally(res.conversation)
        }
      })
      .catch(() => {})
  }
  const rtTimerRef = useRef<any>(null)
  const rtRefreshRef = useRef<() => void>(() => {})
  // ช่องทาง LINE ถูกซ่อน แต่ webhook LINE ยังเขียนข้อมูลอยู่ → ข้าม event ของแชทที่ไม่อยู่ในเพจที่เห็น
  // ไม่งั้นทุกข้อความ LINE จะสั่งโหลดรายการใหม่บนมือถือแอดมินโดยไม่มีอะไรเปลี่ยน (poll 7 วิ ยังเป็นตัวสำรอง)
  const rtIgnoreRef = useRef<(table: string, row: any) => boolean>(() => false)
  rtIgnoreRef.current = (table, row) => {
    if (!row) return false
    if (table === 'conversations') {
      // อัปเดตเฉพาะรูปโปรไฟล์ (จาก /api/inbox/avatar) → แก้ในจอเลย ไม่ต้องโหลดรายการใหม่
      // (ตอนเปิดครั้งแรกหลัง deploy รูปถูกเก็บใหม่ทีละหลายสิบแชท ถ้าโหลดใหม่ทุกครั้งมือถือจะกระตุก)
      const local = conversations.find((c: any) => c.id === row.id)
      if (local && local.customer_picture !== row.customer_picture) {
        const ts = (v: any) => (v ? Date.parse(v) : 0)
        const same = ts(local.last_message_at) === ts(row.last_message_at)
          && (local.last_message ?? null) === (row.last_message ?? null)
          && (local.unread_count ?? 0) === (row.unread_count ?? 0)
          && (local.last_sender ?? null) === (row.last_sender ?? null)
          && !!local.is_archived === !!row.is_archived
          && !!local.is_resolved === !!row.is_resolved
          && !!local.is_starred === !!row.is_starred
          && (local.customer_name ?? null) === (row.customer_name ?? null)
        if (same) {
          const patch = (c: any) => c.id === row.id ? { ...c, customer_picture: row.customer_picture } : c
          setConversations(prev => prev.map(patch))
          patchCachedConvs(patch)
          setActiveConv((c: any) => c && c.id === row.id ? { ...c, customer_picture: row.customer_picture } : c)
          return true
        }
      }
      if (LINE_ENABLED) return false
      const pid = row.page_id
      return !!pid && pages.length > 0 && !pages.some((p: any) => p.id === pid)
    }
    if (LINE_ENABLED) return false
    const cid = row.conversation_id
    return !!cid && pages.length > 0 && activeConv?.id !== cid && !conversations.some((c: any) => c.id === cid)
  }
  rtRefreshRef.current = () => {
    if (rtTimerRef.current) return  // coalesce burst ของข้อความ
    rtTimerRef.current = setTimeout(() => {
      rtTimerRef.current = null
      loadConversations({ silent: true })
      loadMessagesSilentRef.current?.()   // ที่เดียวกับ poll — มีทั้งกัน race และกันทำเป็น "อ่านแล้ว" ตอนไม่ได้ดูจอ
    }, 250)
  }
  // ต่อ realtime แบบ "ซ่อมตัวเองได้": token หมดอายุก็ขอใหม่ก่อนหมด, ขอ token รอบแรกไม่ติดก็ลองใหม่,
  // ช่องทางหลุด (มือถือหลับ/เน็ตสะดุด) ก็ต่อกลับให้เอง
  // เดิมขอ token ครั้งเดียวตอนเปิดหน้า ไม่มีการต่ออายุและไม่มีใครดูสถานะ → เปิดแอปทิ้งไว้ทั้งวันแล้วเงียบไปเฉยๆ
  useEffect(() => {
    let client: any = null, channel: any = null, stopped = false
    let refreshT: any = null, retryT: any = null, attempt = 0, expMs = 0

    const getToken = async (): Promise<string | null> => {
      const r = await fetch('/api/realtime/token', { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) return null   // หมดสิทธิ์ — มีหน้าจอ "เซสชันหมดอายุ" จัดการอยู่แล้ว
      if (!r.ok) throw new Error(`rt token ${r.status}`)
      const j = await r.json()
      if (!j?.token) return null                              // ยังไม่ได้ตั้ง SUPABASE_JWT_SECRET → ใช้ poll อย่างเดียว
      const ttl = Number(j.expiresInSec) > 0 ? Number(j.expiresInSec) : 3600
      expMs = Date.now() + ttl * 1000
      return String(j.token)
    }

    // ขอ token ใหม่ก่อนหมดอายุ ~10 นาที (setAuth จะส่ง access_token ใหม่ให้ช่องที่ join อยู่ ไม่ต้อง subscribe ใหม่)
    const scheduleRefresh = () => {
      clearTimeout(refreshT)
      refreshT = setTimeout(refresh, Math.max(60_000, expMs - Date.now() - 10 * 60_000))
    }
    const refresh = async () => {
      if (stopped || !client) return
      try {
        const t = await getToken()
        if (stopped || !t || !client) return
        await client.realtime.setAuth(t)
        scheduleRefresh()
      } catch {
        if (!stopped) { clearTimeout(refreshT); refreshT = setTimeout(refresh, 60_000) }
      }
    }
    const retry = () => {
      if (stopped) return
      clearTimeout(retryT)
      retryT = setTimeout(start, Math.min(60_000, 2000 * 2 ** attempt++))
    }

    async function start() {
      if (stopped) return
      try {
        const t = await getToken()
        if (stopped || !t) return
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!url || !anon) return
        if (!client) {
          const { createClient } = await import('@supabase/supabase-js')
          if (stopped) return
          // ปิดระบบ auth ของ supabase ทิ้ง — หน้านี้ใช้ token ของเราเอง
          // ไม่งั้นทุกครั้งที่เข้าหน้านี้จะได้ตัวจับเวลา refresh + listener ค้างเพิ่มอีกชุด
          client = createClient(url, anon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            realtime: { params: { eventsPerSecond: 10 } },
          })
        }
        await client.realtime.setAuth(t)
        if (stopped) { teardown(); return }
        if (channel) { const old = channel; channel = null; try { client.removeChannel(old) } catch {} }
        const ch = client.channel('inbox-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox_messages' }, (e: any) => { if (!stopped && !rtIgnoreRef.current('inbox_messages', e?.new)) rtRefreshRef.current() })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (e: any) => { if (!stopped && !rtIgnoreRef.current('conversations', e?.new)) rtRefreshRef.current() })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (e: any) => { if (!stopped && !rtIgnoreRef.current('conversations', e?.new)) rtRefreshRef.current() })
        channel = ch
        ch.subscribe((status: string) => {
          if (stopped || ch !== channel) return   // callback ของช่องเก่า/ตอนออกจากหน้า — ไม่ต้องทำอะไร
          if (status === 'SUBSCRIBED') { attempt = 0; scheduleRefresh(); rtRefreshRef.current() }  // ตามเก็บของที่พลาดตอนหลุด
          else if (status === 'CHANNEL_ERROR') refresh()                 // ส่วนใหญ่คือ token หมดอายุ
          else if (status === 'CLOSED' || status === 'TIMED_OUT') retry() // server ปิดช่อง → สร้างใหม่
        })
      } catch {
        retry()   // เน็ตยังไม่พร้อมตอนเปิดแอป → ถอยแล้วลองใหม่ (เดิมเงียบไปทั้งวัน)
      }
    }

    const teardown = () => {
      try { client?.removeAllChannels?.(); client?.realtime?.disconnect?.() } catch {}
      client = null; channel = null
    }
    const onVisible = () => {
      if (stopped || typeof document === 'undefined' || document.visibilityState !== 'visible') return
      if (!client) retry()
      else if (expMs && expMs - Date.now() < 15 * 60_000) refresh()
    }

    start()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      stopped = true
      clearTimeout(refreshT); clearTimeout(retryT)
      if (rtTimerRef.current) { clearTimeout(rtTimerRef.current); rtTimerRef.current = null }
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      teardown()
    }
  }, [])

  // โหลดค่า "เปิดปุ่ม AI ช่วยตอบ" ของเพจที่กำลังเปิดแชทอยู่ (ไม่งั้นสวิตช์ในตั้งค่าไม่มีผลจริง)
  const aiFetchedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const pid = activeConv?.page_id
    if (!pid) return
    const cacheKey = `${pid}::${settingsVer}`   // settingsVer เพิ่มขึ้นเมื่อปิดหน้าตั้งค่า → ดึงค่าใหม่
    if (aiFetchedRef.current.has(cacheKey)) return
    aiFetchedRef.current.add(cacheKey)
    let cancelled = false
    fetch(`/api/inbox/settings?pageId=${pid}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const s = d.settings?.[0]
        setAiEnabledByPage(prev => ({ ...prev, [pid]: s ? s.ai_assist_enabled !== false : true }))
      })
      .catch(() => { if (!cancelled) setAiEnabledByPage(prev => ({ ...prev, [pid]: true })) })
    return () => { cancelled = true }
  }, [activeConv?.page_id, settingsVer])

  // หมุนจอ/เปลี่ยนขนาด → ปิดเมนูที่เปิดค้าง (ไม่งั้นปุ่มหายไปตาม breakpoint
  // แต่ overlay เต็มจอยังอยู่ บล็อกการแตะทั้งหน้า)
  useEffect(() => {
    const onResize = () => { setShowChatMenu(false); setShowMobileMenu(false) }
    window.addEventListener('orientationchange', onResize)
    return () => window.removeEventListener('orientationchange', onResize)
  }, [])

  // กด Esc = ปิดชั้นบนสุดที่เปิดอยู่ (เมนู → modal) — มาตรฐานที่ผู้ใช้คาดหวัง
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showMobileMenu) { setShowMobileMenu(false); return }
      if (showChatMenu) { setShowChatMenu(false); return }
      if (renamePage) { setRenamePage(null); setNicknameError(null); return }
      if (showSavedReplies) { setShowSavedReplies(false); return }
      if (showSettings) { setShowSettings(false); return }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showMobileMenu, showChatMenu, renamePage, showSavedReplies, showSettings])

  // toast หายเองใน 5 วิ — ยกเว้น sticky ("ส่งไม่สำเร็จ") ที่แอดมินต้องกดรับรู้เอง
  useEffect(() => {
    if (!toast || toast.sticky) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // รีเฟรชทันทีเมื่อกลับมาที่แอป/แท็บ (สลับแอปแล้วกลับมา → เห็นล่าสุดเลย ไม่ต้องรอ poll)
  // + ดึงข้อความใหม่จาก Facebook ด้วยถ้าห่างจากรอบล่าสุดเกิน 30 วิ
  //   (เดิมอ่านจากฐานข้อมูลอย่างเดียว ปลดล็อกมือถือมาจึงเห็นลิสต์เดิม ทั้งที่ลูกค้าสั่งของไว้ตั้งแต่เมื่อกี้)
  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      rtRefreshRef.current()
      // force = ข้ามตัวกันยิงถี่ 45 วิ ของ server (ไม่งั้นกลับเข้าแอปในช่วง 30-45 วิ จะไม่ได้ดึงอะไรเลย)
      // ยังมีตัวกัน 30 วิ ฝั่งนี้อยู่ — สลับแท็บไปมาจึงไม่ยิงถี่จน Facebook จำกัดอัตรา
      maybeSyncRef.current(30 * 1000, true)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible) }
  }, [])

  // มีข้อความใหม่เข้ามาตอนเปิดแชทอยู่:
  // - แอดมินอยู่ท้ายสุด (หรือเป็นข้อความที่ตัวเองเพิ่งส่ง) → เลื่อนตามให้เลย
  // - กำลังเลื่อนอ่านข้อความเก่าอยู่ → ไม่แย่งจอ แต่ขึ้นปุ่ม "มีข้อความใหม่ ↓" ให้กดลงไปดู
  // (เดิมฟองใหม่ไปต่อท้ายใต้ขอบจอเฉยๆ จอไม่ขยับ แอดมินนึกว่าลูกค้ายังไม่ตอบ)
  // แถวที่ "เครื่องนี้" เพิ่งกดส่งเอง = ฟองชั่วคราว หรือแถวจริงที่เพิ่งบันทึกไปไม่กี่วินาที
  // ห้ามดูแค่ direction === 'outbound' — ข้อความที่เพื่อนร่วมทีม/แอป Facebook ตอบก็เป็น outbound เหมือนกัน
  // (ดึงเข้ามาทาง sync) ถ้าเลื่อนจอตามจะกระชากจอตอนแอดมินกำลังเลื่อนอ่านที่อยู่ส่งของของลูกค้า
  const isJustSentHere = (m: any) => {
    const id = String(m?.id ?? '')
    if (id.startsWith('temp-')) return true
    return Date.now() - (localRowsRef.current.get(id) ?? 0) < 15_000
  }
  useLayoutEffect(() => {
    const isTemp = (m: any) => typeof m?.id === 'string' && m.id.startsWith('temp-')
    const last = messages[messages.length - 1]
    const lastId = last ? String(last.id) : null
    // ฟอง "กำลังส่ง"/"ส่งไม่สำเร็จ" ต่อท้ายเสมอ (mergeServerMessages) → ถ้าดูแค่ตัวท้ายสุด
    // ฟองแดงที่ค้างไว้จะบังไม่ให้รู้ว่ามีข้อความลูกค้าเข้ามาใหม่เลย ต้องดู "แถวจริง" ตัวท้ายสุดด้วย
    let lastRealIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) { if (!isTemp(messages[i])) { lastRealIdx = i; break } }
    const lastReal = lastRealIdx >= 0 ? messages[lastRealIdx] : null
    const realId = lastReal ? String(lastReal.id) : null
    const prevId = lastMsgIdRef.current
    const prevRealId = lastRealMsgIdRef.current
    lastMsgIdRef.current = lastId
    lastRealMsgIdRef.current = realId
    if (!lastId) return
    const realChanged = realId !== prevRealId
    if (lastId === prevId && !realChanged) return   // รอบ poll ที่ได้ข้อความชุดเดิม — ห้ามขยับจอ
    const el = msgPaneRef.current
    if (!el) return
    if (prevId === null && prevRealId === null) { el.scrollTop = el.scrollHeight; return }   // เพิ่งเปิดแชท
    // มีแถวจริงใหม่ → ใช้แถวนั้นตัดสิน ไม่งั้นใช้ฟองท้ายสุด (เช่นฟองที่เพิ่งกดส่ง)
    const anchor = realChanged && lastReal ? lastReal : last
    if (nearBottomRef.current || isJustSentHere(anchor)) {
      el.scrollTop = el.scrollHeight
      nearBottomRef.current = true
      setNewMsgCount(0)
    } else if (realChanged) {
      // sync รอบเดียวมักได้หลายข้อความพร้อมกัน (ลูกค้าพิมพ์รัว) — นับจากแถวที่เพิ่งต่อท้ายจริงๆ
      // ไม่ใช่ +1 ต่อรอบ ไม่งั้นปุ่มบอก "1 ข้อความ" ทั้งที่มี 5 ข้อความรออยู่
      const prevRealIdx = prevRealId ? messages.findIndex(m => String(m.id) === prevRealId) : -1
      // หาแถวเดิมไม่เจอ (ถูกลบจากอีกเครื่อง) → นับแค่ 1 เหมือนเดิม ดีกว่าไปนับทั้งแชท
      const added = prevRealIdx >= 0 ? messages.slice(prevRealIdx + 1, lastRealIdx + 1) : [lastReal]
      const n = added.filter(m => m && !isJustSentHere(m)).length
      if (n > 0) setNewMsgCount(c => c + n)
    }
  }, [messages])

  // id ของฟองชั่วคราว — ใส่ตัวสุ่มกันชนกันเมื่อกดส่งรัวๆ ภายในมิลลิวินาทีเดียวกัน
  const newTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // อัปเดตฟองเดิม หรือใส่กลับเข้าไปถ้าไม่อยู่แล้ว
  // (ออกจากแชทแล้วกลับเข้ามาใหม่ระหว่างรอผล ฟองเดิมถูกล้างไปตอนเปิดแชท — ผล "ส่งไม่สำเร็จ" ต้องไม่หายตาม)
  // จับได้ทั้ง id ของฟองชั่วคราว และ id จริงของแถวที่ server บันทึกไว้
  // (poll อาจสลับฟองชั่วคราวเป็นแถวจริงไปก่อนผลส่งจะกลับมา — ต่อท้ายตรงๆ จะได้ 2 ฟอง + React key ซ้ำ)
  const upsertMsg = (id: string, next: any) => setMessages(prev => {
    const nid = String(next?.id ?? id)
    const hit = (m: any) => String(m.id) === String(id) || String(m.id) === nid
    if (!prev.some(hit)) return [...prev, next]
    let done = false
    return prev.flatMap((m: any) => {
      if (!hit(m)) return [m]
      if (done) return []          // มีทั้งฟองชั่วคราวและแถวจริงอยู่พร้อมกัน → เหลือใบเดียว
      done = true
      return [next]
    })
  })

  // ส่งไม่สำเร็จตอนแอดมินออกจากแชทนั้นไปแล้ว → ต้องมีอะไรบอก ไม่ใช่เงียบหาย
  function notifySendFailedElsewhere(convName: string, conv: any, isImage?: boolean) {
    setToast({
      msg: `${isImage ? 'ส่งรูปถึง' : 'ส่งข้อความถึง'} ${convName} ไม่สำเร็จ`,
      action: { label: 'เปิดแชท', run: () => loadMessages(conv) },
      sticky: true,
    })
  }

  // ── Send message ──
  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? draftValueRef.current).trim()
    if (!activeConv || !text) return
    const convId = activeConv.id          // ผูกกับแชทนี้ — สลับแชทระหว่างส่งจะไม่เด้งผิดที่
    if (sendingConvsRef.current.has(convId)) return   // กันกดซ้ำเฉพาะแชทนี้ แชทอื่นยังส่งได้
    const convSnap = activeConv
    const convName = activeConv.customer_name || 'ลูกค้า'
    const isThis = () => openReqRef.current === convId
    setBusy(sendingConvsRef, convId, true)
    setErrorBanner(null)
    if (!overrideText) { composerApiRef.current?.clear(); draftValueRef.current = ''; draftsRef.current.delete(convId) }

    // optimistic
    const optimistic = {
      id: newTempId(),
      conversation_id: convId,
      direction: 'outbound',
      message_text: text,
      sent_by: 'page_user',
      delivery_status: 'sending',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetchWithTimeout('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, text }),
      }, SEND_TIMEOUT_MS)
      const data = await res.json().catch(() => ({}))
      if (data.message?.id) localRowsRef.current.set(String(data.message.id), Date.now())
      if (!res.ok || !data.success) {
        const msg = friendlyError(data.error) || 'ส่งไม่สำเร็จ'
        const failed = { ...optimistic, delivery_status: 'failed', error_message: msg, local_only: true }
        // server ไม่ได้บันทึกแถวไว้ → เก็บเองในเครื่องเสมอ แม้แอดมินยังอยู่ในแชทนี้
        // (ฟองแดงอยู่ใน state เท่านั้น สลับไปแชทอื่นแล้วกลับมา state ถูกตั้งใหม่ = ข้อความที่พิมพ์หายถาวร)
        if (!data.message) stashFailed(convId, failed)
        if (isThis()) {
          setErrorBanner(msg)
          // ใช้แถวที่ server บันทึกไว้ (id จริง) แทนฟองชั่วคราว → กด "ลบ"/"ส่งอีกครั้ง" แล้วไม่เด้งกลับมา
          upsertMsg(optimistic.id, data.message ? { ...data.message, error_message: msg } : failed)
          if (data.blockCode) setActiveConv((c: any) => c && c.id === convId ? { ...c, send_block_code: data.blockCode } : c)
        } else {
          notifySendFailedElsewhere(convName, convSnap)
        }
        loadConversations({ silent: true })
      } else {
        // data.message อาจเป็น null ได้ (insert สำเร็จแต่ select กลับไม่ได้) → ห้ามยัด null ลง array
        if (isThis()) {
          setMessages(prev => prev.map(m => m.id === optimistic.id
            ? (data.message || { ...m, delivery_status: 'sent' }) : m))
          // ส่งถึงลูกค้าแล้ว = ข้อจำกัด 24 ชม./#551 หมดไปแล้ว (server ก็ล้างค่าให้เหมือนกัน)
          // ไม่ล้างตรงนี้ แถบส้ม "ห้ามตอบ" จะค้างอยู่ใต้ข้อความที่เพิ่งส่งสำเร็จ
          setActiveConv((c: any) => c && c.id === convId ? { ...c, send_block_code: null, send_block_at: null } : c)
        }
        loadConversations({ silent: true })
      }
    } catch (e: any) {
      // หมดเวลารอ — ห้ามบอกว่า "ส่งไม่สำเร็จ" ลอยๆ เพราะ server อาจส่งถึงลูกค้าไปแล้ว
      // (กดส่งซ้ำตรงนี้ = ลูกค้าได้ข้อความซ้ำ) → บอกว่ากำลังตรวจสอบ แล้วดึงของจริงมาเทียบ
      const uncertain = isAbortError(e)
      const msg = uncertain ? 'ส่งช้าผิดปกติ — ยังไม่แน่ใจว่าลูกค้าได้รับหรือยัง กำลังตรวจสอบให้' : friendlyError(e?.message)
      const failed = { ...optimistic, delivery_status: 'failed', error_message: msg, local_only: true, uncertain }
      // ไม่มีคำตอบจาก server = ไม่รู้ว่ามีแถวไหม → เก็บไว้ก่อนเสมอ (ถ้าส่งติดจริง loadMessages จะตัดออกให้ตอนเปิดแชทใหม่)
      stashFailed(convId, failed)
      if (isThis()) {
        setErrorBanner(msg)
        upsertMsg(optimistic.id, failed)
      } else {
        notifySendFailedElsewhere(convName, convSnap)
      }
      loadConversations({ silent: true })
      if (uncertain) loadMessagesSilentRef.current?.()   // ถ้า server บันทึกไว้จริง ฟองนี้จะถูกแทนที่เอง
    } finally {
      setBusy(sendingConvsRef, convId, false)
    }
  }

  // จำว่า "ฟองนี้" ถูกกดส่งซ้ำแล้ว — ผูกกับ id ของฟอง ไม่ใช่เนื้อหา
  // (ถ้าผูกเนื้อหา ข้อความสั้นที่ใช้ซ้ำทั้งวันอย่าง "ค่ะ" จะไม่มีปุ่มให้กดอีกเลยตลอดเซสชัน)
  function retryKeyOf(convId: string, m: any) { return `${convId}::${String(m?.id ?? '')}` }
  function markRetried(convId: string, m: any) {
    retriedRef.current.add(retryKeyOf(convId, m))
    setRetriedTick(t => t + 1)
  }

  // แทรกข้อความสำเร็จรูป/คำแนะนำ AI — ต่อท้ายของที่พิมพ์ค้างไว้ ไม่ทับทิ้ง (ช่องพิมพ์อยู่ในคอมโพเนนต์ลูก)
  function insertIntoDraft(text: string) {
    composerApiRef.current?.insert(text)
  }

  // ส่งอีกครั้งจากฟองข้อความที่ส่งไม่สำเร็จ (ทั้งข้อความและรูป)
  // ข้อความที่ส่งไม่สำเร็จ (ไม่เคยถึงลูกค้า) → ลบออกจากแชท ให้แชทตรงกับ Facebook
  function deleteFailedOnServer(m: any): Promise<boolean> {
    if (String(m.id).startsWith('temp-')) return Promise.resolve(true)
    return fetch(`/api/inbox/messages/${encodeURIComponent(String(m.id))}`, { method: 'DELETE' })
      .then(r => r.ok || r.status === 404)  // 404 = ถูกลบไปแล้ว (เช่นจากอีกเครื่อง)
      .catch(() => false)
  }

  async function discardFailed(m: any) {
    if (!window.confirm('ลบข้อความที่ส่งไม่สำเร็จนี้?\n\nลูกค้าไม่ได้รับข้อความนี้ ลบแล้วเอากลับมาไม่ได้')) return
    const id = String(m.id)
    if (!id.startsWith('temp-')) retriedServerIdsRef.current.add(id)  // poll ห้ามเอากลับมา
    setMessages(prev => prev.filter(x => x.id !== m.id))
    if (activeConv?.id) dropFromOutbox(activeConv.id, id)   // ไม่งั้นเปิดแชทใหม่แล้วฟองที่ลบไปกลับมา
    const entry = pendingFilesRef.current.get(id)
    if (entry) { pendingFilesRef.current.delete(id); try { URL.revokeObjectURL(entry.url) } catch {} }
    const ok = await deleteFailedOnServer(m)
    if (!ok) {
      // ลบไม่สำเร็จ → เอากลับมาแสดง จะได้ไม่เข้าใจผิดว่าหายไปแล้ว
      retriedServerIdsRef.current.delete(id)
      setErrorBanner('ลบข้อความไม่สำเร็จ — ลองใหม่อีกครั้ง')
      loadMessagesSilentRef.current?.()
    }
  }

  async function retryMessage(m: any) {
    if (!activeConv) return
    const convId = activeConv.id
    // มีอะไรของแชทนี้กำลังส่ง/อัปโหลดอยู่ → ยิงซ้อนไม่ได้ แต่ต้องบอก ไม่ใช่กดแล้วเงียบเหมือนปุ่มเสีย
    if (sendingConvsRef.current.has(convId) || uploadingConvsRef.current.has(convId)) {
      setErrorBanner('มีข้อความกำลังส่งอยู่ — รอสักครู่แล้วกด "ส่งอีกครั้ง" ใหม่')
      return
    }
    const id = String(m.id)
    const imgUrl = (m.attachments || []).find((a: any) => a?.type === 'image' && a.url)?.url

    // ฟองที่ "หมดเวลารอ" — server อาจส่งถึงลูกค้าไปแล้ว ต้องเช็คของจริงก่อน แล้วถามให้แน่ใจ
    if (m.uncertain) {
      loadMessagesSilentRef.current?.()
      if (!window.confirm('ข้อความนี้อาจส่งถึงลูกค้าไปแล้ว\n\nถ้าส่งอีกครั้ง ลูกค้าอาจได้รับข้อความซ้ำ — ยืนยันส่งซ้ำไหม?')) return
    }

    // รูปที่อัปโหลดไม่สำเร็จ (ยังเป็น blob:) → ต้องอัปโหลดใหม่จากไฟล์เดิม ส่ง URL ไปตรงๆ ไม่ได้
    if (imgUrl && String(imgUrl).startsWith('blob:')) {
      const entry = pendingFilesRef.current.get(id)
      if (!entry) { setErrorBanner('ส่งรูปซ้ำไม่ได้ — กรุณาเลือกรูปใหม่อีกครั้ง'); return }
      markRetried(convId, m)
      setMessages(prev => prev.filter(x => x.id !== m.id))
      dropFromOutbox(convId, id)
      pendingFilesRef.current.delete(id)
      try { URL.revokeObjectURL(entry.url) } catch {}
      await handleSendImage(entry.file)
      return
    }

    markRetried(convId, m)
    dropFromOutbox(convId, id)
    // แถวที่มาจาก DB จะถูกดึงกลับมาตอน poll → จำ id ไว้เพื่อซ่อน + ลบใน DB (รีเฟรชแล้วจะได้ไม่กลับมา)
    if (!String(m.id).startsWith('temp-')) {
      retriedServerIdsRef.current.add(String(m.id))
      deleteFailedOnServer(m)
    }
    setMessages(prev => prev.filter(x => x.id !== m.id))
    if (imgUrl) await sendImageUrl(imgUrl)
    else if (m.message_text) await handleSend(m.message_text)
  }

  // ── ส่งรูปที่อัปโหลดแล้ว (ใช้ทั้งตอนส่งครั้งแรกและตอนกด "ส่งอีกครั้ง") ──
  // convId = แชทปลายทาง (ผูกไว้ตั้งแต่ตอนเลือกรูป) / existingId = ใช้ฟองเดิมที่โชว์รูปในเครื่องอยู่แล้ว
  async function sendImageUrl(imageUrl: string, opts?: { convId?: string; existingId?: string; conv?: any }) {
    const conv = opts?.conv || activeConv
    const convId = opts?.convId || activeConv?.id
    if (!convId) return
    const convName = conv?.customer_name || 'ลูกค้า'
    const isThis = () => openReqRef.current === convId
    const optimistic: any = {
      id: opts?.existingId || newTempId(),
      conversation_id: convId,
      direction: 'outbound',
      message_text: null,
      attachments: [{ type: 'image', url: imageUrl }],
      sent_by: 'page_user',
      delivery_status: 'sending',
      created_at: new Date().toISOString(),
    }
    // มีข้อความอื่นของแชทนี้กำลังส่งอยู่ → ยิงซ้อนไม่ได้ แต่ "ห้ามเงียบ"
    // (เดิม return เปล่า รูปที่อัปโหลดเสร็จแล้วหายไปเฉยๆ ฟองค้าง "กำลังส่ง" ตลอดกาล ไม่มีปุ่มให้กด)
    // imageUrl ตรงนี้เป็นลิงก์ถาวรที่อัปเสร็จแล้ว → กด "ส่งอีกครั้ง" ส่งได้เลย ไม่ต้องอัปใหม่
    if (sendingConvsRef.current.has(convId)) {
      const failed = {
        ...optimistic, delivery_status: 'failed', status_note: '', local_only: true,
        error_message: 'มีข้อความอื่นกำลังส่งอยู่ — กด "ส่งอีกครั้ง" เพื่อส่งรูปนี้',
      }
      stashFailed(convId, failed)   // เก็บไว้เสมอ สลับแชทแล้วกลับมารูปต้องยังอยู่พร้อมปุ่มส่งซ้ำ
      if (isThis()) { setErrorBanner(failed.error_message); upsertMsg(optimistic.id, failed) }
      else notifySendFailedElsewhere(convName, conv, true)
      return
    }
    setBusy(sendingConvsRef, convId, true)
    if (isThis()) setErrorBanner(null)
    // ฟองต้องขึ้นเฉพาะแชทที่เป็นเจ้าของรูปนี้ — ไม่งั้นรูปของลูกค้า A ไปค้าง "กำลังส่ง" ในแชท B
    if (isThis()) {
      setMessages(prev => prev.some(m => m.id === optimistic.id)
        ? prev.map(m => m.id === optimistic.id ? { ...m, ...optimistic } : m)
        : [...prev, optimistic])
    }
    try {
      const res = await fetchWithTimeout('/api/inbox/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, imageUrl }),
      }, SEND_TIMEOUT_MS)
      const data = await res.json().catch(() => ({}))
      if (data.message?.id) localRowsRef.current.set(String(data.message.id), Date.now())
      if (!res.ok || !data.success) {
        const msg = friendlyError(data.error) || 'ส่งรูปไม่สำเร็จ'
        const failed = { ...optimistic, delivery_status: 'failed', error_message: msg, local_only: true }
        // server ไม่ได้บันทึกแถวไว้ → เก็บเองเสมอ แม้แอดมินยังอยู่ในแชทนี้ (สลับแชทแล้วกลับมา state ถูกตั้งใหม่)
        if (!data.message) stashFailed(convId, failed)
        if (isThis()) {
          setErrorBanner(msg)
          // ใช้แถวที่ server บันทึกไว้ (id จริง) แทนฟองชั่วคราว → กด "ลบ"/"ส่งอีกครั้ง" แล้วไม่เด้งกลับมา
          upsertMsg(optimistic.id, data.message ? { ...data.message, error_message: msg } : failed)
          if (data.blockCode) setActiveConv((c: any) => c && c.id === convId ? { ...c, send_block_code: data.blockCode } : c)
        } else {
          notifySendFailedElsewhere(convName, conv, true)
        }
        loadConversations({ silent: true })
      } else {
        if (isThis()) {
          setMessages(prev => prev.map(m => m.id === optimistic.id
            ? (data.message || { ...m, delivery_status: 'sent' }) : m))
          // ส่งถึงลูกค้าแล้ว → เอาแถบส้ม "ห้ามตอบ" ออก (server ก็ล้างค่าให้เหมือนกัน)
          setActiveConv((c: any) => c && c.id === convId ? { ...c, send_block_code: null, send_block_at: null } : c)
        }
        loadConversations({ silent: true })
      }
    } catch (e: any) {
      const uncertain = isAbortError(e)
      const msg = uncertain ? 'ส่งช้าผิดปกติ — ยังไม่แน่ใจว่าลูกค้าได้รับหรือยัง กำลังตรวจสอบให้' : friendlyError(e?.message)
      const failed = { ...optimistic, delivery_status: 'failed', error_message: msg, local_only: true, uncertain }
      // ไม่มีคำตอบจาก server = ไม่รู้ว่ามีแถวไหม → เก็บไว้ก่อนเสมอ (ถ้าส่งติดจริง loadMessages จะตัดออกให้ตอนเปิดแชทใหม่)
      stashFailed(convId, failed)
      if (isThis()) {
        setErrorBanner(msg)
        upsertMsg(optimistic.id, failed)
      } else {
        notifySendFailedElsewhere(convName, conv, true)
      }
      loadConversations({ silent: true })
      if (uncertain) loadMessagesSilentRef.current?.()
    } finally {
      setBusy(sendingConvsRef, convId, false)
    }
  }

  // ── ส่งรูปภาพ: ย่อรูป → อัปโหลด → ส่งผ่าน FB/LINE ──
  async function handleSendImage(file: File) {
    if (!activeConv) return
    const convId = activeConv.id
    if (uploadingConvsRef.current.has(convId) || sendingConvsRef.current.has(convId)) return
    const okTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!okTypes.includes(file.type)) { setErrorBanner('รองรับเฉพาะรูปภาพ (jpg, png, gif, webp)'); return }
    // กันไฟล์ใหญ่ผิดปกติตั้งแต่ต้น (ถอดรหัสรูป 50 MP บนมือถือจะทำให้แอปค้าง)
    if (file.size > 30 * 1024 * 1024) { setErrorBanner('ไฟล์รูปใหญ่เกินไป — ลองถ่ายหน้าจอรูปนี้แล้วส่งภาพที่แคปมาแทน'); return }

    const convSnap = activeConv
    const convName = activeConv.customer_name || 'ลูกค้า'
    setBusy(uploadingConvsRef, convId, true)
    setErrorBanner(null)
    const isThis = () => openReqRef.current === convId
    const previewUrl = URL.createObjectURL(file)
    const tempId = newTempId()
    // โชว์ตัวอย่างรูปทันทีระหว่างย่อ/อัปโหลด — แอดมินจะได้รู้ว่าระบบกำลังทำอะไรอยู่
    setMessages(prev => [...prev, {
      id: tempId, conversation_id: convId, direction: 'outbound', message_text: null,
      attachments: [{ type: 'image', url: previewUrl }],
      sent_by: 'page_user', delivery_status: 'sending', status_note: '⏳ กำลังย่อรูป...',
      created_at: new Date().toISOString(),
    }])
    const setNote = (note: string) => {
      if (isThis()) setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status_note: note } : m))
    }

    let toSend = file
    try {
      // รูปจากกล้องมือถือมักเกินเพดานที่ Vercel รับได้ → ย่อก่อนเสมอ (เร็วกว่าด้วยบนเน็ต 4G)
      toSend = await prepareImageForUpload(file)
      // GIF ไม่ถูกย่อ (จะเสียภาพเคลื่อนไหว) → ถึงตรงนี้ด้วยขนาดจริง ต้องบอกทางแก้คนละแบบ
      if (toSend.size > MAX_UPLOAD_BYTES) throw new Error(oversizeImageMessage(toSend.type))
      setNote('⏳ กำลังส่งรูป...')
      const fd = new FormData()
      fd.append('file', toSend)
      fd.append('conversationId', convId)
      const upRes = await fetchWithTimeout('/api/inbox/upload', { method: 'POST', body: fd }, UPLOAD_TIMEOUT_MS)
      // 413 = Vercel/route ตีกลับเพราะไฟล์ใหญ่ บางทีตอบเป็น text ไม่ใช่ JSON → บอกสาเหตุจริงให้แอดมิน
      if (upRes.status === 413) throw new Error(oversizeImageMessage(toSend.type))
      const upData = await upRes.json().catch(() => ({}))
      if (!upRes.ok || !upData.url) throw new Error(upData.error || 'อัปโหลดรูปไม่สำเร็จ')

      // ใช้ฟองเดิมต่อ + ใช้ไฟล์ในเครื่องแสดงผล (ไม่ต้องโหลดรูปเดิมกลับมาจากเน็ตอีกรอบ)
      rememberLocalPreview(upData.url, previewUrl)
      setNote('')
      setBusy(uploadingConvsRef, convId, false)
      await sendImageUrl(upData.url, { convId, existingId: tempId, conv: convSnap })
      return
    } catch (e: any) {
      const msg = isAbortError(e) ? 'อัปโหลดรูปใช้เวลานานเกินไป — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' : friendlyError(e?.message)
      const failed = {
        id: tempId, conversation_id: convId, direction: 'outbound', message_text: null,
        attachments: [{ type: 'image', url: previewUrl }], sent_by: 'page_user',
        delivery_status: 'failed', error_message: msg, local_only: true, status_note: '',
        created_at: new Date().toISOString(),
      }
      // เก็บไฟล์ที่ย่อแล้วไว้ให้ "ส่งอีกครั้ง" อัปใหม่ได้เลย (blob: URL ส่งตรงไป server ไม่ได้)
      // ห้าม revoke blob — ทั้งฟองที่ค้างไว้และฟองที่กลับมาดูทีหลังต้องยังเห็นรูป
      pendingFilesRef.current.set(tempId, { file: toSend, url: previewUrl })
      stashFailed(convId, failed)   // เก็บไว้เสมอ สลับแชทแล้วกลับมารูปต้องยังอยู่พร้อมปุ่มส่งซ้ำ
      if (isThis()) {
        setErrorBanner(msg)
        upsertMsg(tempId, failed)
      } else {
        setToast({
          msg: `ส่งรูปถึง ${convName} ไม่สำเร็จ — เปิดแชทแล้วกด "ส่งอีกครั้ง"`,
          action: { label: 'เปิดแชท', run: () => loadMessages(convSnap) },
          sticky: true,
        })
      }
    } finally {
      setBusy(uploadingConvsRef, convId, false)
    }
  }

  // ── AI Suggest ──
  async function handleAiSuggest(instruction?: string) {
    if (!activeConv || aiLoading) return
    const convId = activeConv.id                      // ผูกกับแชทนี้
    const isThis = () => openReqRef.current === convId // สลับแชทแล้วต้องไม่เด้งคำแนะนำข้ามคน
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const res = await fetch('/api/inbox/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, instruction }),
      })
      // route หมดเวลา (maxDuration) → Vercel ตอบเป็น HTML ไม่ใช่ JSON
      // ถ้า parse ตรงๆ แอดมินจะเห็น "Unexpected token 'A'..." ซึ่งไม่มีใครรู้ว่าต้องทำอะไรต่อ
      const data: any = await res.json().catch(() => null)
      if (!isThis()) return                            // เปิดแชทอื่นไปแล้ว — ทิ้งผล
      if (res.ok && data?.suggestions?.length) {
        setAiSuggestions(data.suggestions)
        setActiveConv((c: any) => c && c.id === convId
          ? { ...c, ai_category: data.category, ai_sentiment: data.sentiment, ai_summary: data.summary } : c)
      } else {
        const fallback = (res.status === 504 || res.status === 502)
          ? 'AI ใช้เวลานานเกินไป — ลองกดใหม่อีกครั้ง'
          : 'AI ยังสร้างคำแนะนำไม่ได้ ลองใหม่อีกครั้ง'
        setErrorBanner(data?.error ? friendlyError(data.error) : fallback)
      }
    } catch (e: any) {
      if (isThis()) setErrorBanner(friendlyError(e?.message))
    } finally {
      // ต้องเป็น finally — มี return อยู่ใน try (ตอนแอดมินสลับแชทไปก่อนผลกลับมา)
      // ถ้าปล่อยไว้ท้ายฟังก์ชัน ปุ่ม "AI ช่วยตอบ" จะค้างหมุนและกดไม่ได้ทุกแชทไปจนกว่าจะรีโหลดหน้า
      setAiLoading(false)
    }
  }

  // ── Conversation actions ──
  async function patchConv(patch: any, opts?: { silentToast?: boolean; convOverride?: any }) {
    const conv = opts?.convOverride || activeConv
    if (!conv) return
    const before = Object.fromEntries(Object.keys(patch).map(k => [k, (conv as any)[k]]))
    // ผูกกับแชทนี้เสมอ — กัน "เลิกทำ" หลังสลับแชทไปแก้สถานะแชทอื่น
    setActiveConv((c: any) => c && c.id === conv.id ? { ...c, ...patch } : c)   // optimistic
    try {
      const res = await fetch(`/api/inbox/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setActiveConv((c: any) => c && c.id === conv.id ? { ...c, ...before } : c)  // rollback
        setErrorBanner(friendlyError(d.error) || 'บันทึกไม่สำเร็จ')
        return
      }
      // แจ้งผล + ให้เลิกทำได้ (โดยเฉพาะจัดเก็บ ที่ทำให้แชทหายจากลิสต์)
      if (!opts?.silentToast) {
        const label = 'is_archived' in patch ? (patch.is_archived ? 'จัดเก็บแชทแล้ว' : 'เอาออกจากที่จัดเก็บแล้ว')
          : 'is_resolved' in patch ? (patch.is_resolved ? 'จบบทสนทนาแล้ว' : 'เปิดบทสนทนาใหม่แล้ว')
          : 'is_starred' in patch ? (patch.is_starred ? 'ติดดาวแล้ว' : 'เอาดาวออกแล้ว')
          : 'บันทึกแล้ว'
        // ส่ง conv เดิมไปด้วย — กดเลิกทำหลังสลับแชทก็ยังแก้ถูกแชท
        setToast({ msg: label, undo: () => patchConv(before, { silentToast: true, convOverride: conv }) })
      }
      loadConversations({ silent: true })
    } catch (e: any) {
      setActiveConv((c: any) => c && c.id === conv.id ? { ...c, ...before } : c)
      setErrorBanner(friendlyError(e?.message))
    }
  }

  // ── Render ──
  // ── แยกช่องทาง (Facebook / LINE) — เลือกก่อนตอบ ไม่ให้ปนกัน ──
  const channelOf = (p: any) => p?.channel || 'facebook'
  const availableChannels = Array.from(new Set(pages.map(channelOf)))
  const bothChannels = availableChannels.includes('facebook') && availableChannels.includes('line')
  const showChannelGate = bothChannels && channelFilter === null
  const channelPages = channelFilter ? pages.filter(p => channelOf(p) === channelFilter) : pages
  const sumUnread = (arr: any[]) => arr.reduce((s, p) => s + (unreadByPage[p.id] || 0), 0)
  const channelUnread = sumUnread(channelPages)
  const channelNeedsReply = channelPages.reduce((s, p) => s + (needsReplyByPage[p.id] || 0), 0)
  // จำนวน "แชทอื่น" ที่มีข้อความใหม่ — บนมือถือ เปิดแชทอยู่จะไม่เห็นรายการเลย
  // ต้องมีตัวเลขบนปุ่มย้อนกลับ ไม่งั้นลูกค้าคนอื่นทักมาแล้วรอเป็นสิบนาทีกว่าแอดมินจะรู้
  // (ตัวเลขนี้นับเป็น "จำนวนแชท" ไม่ใช่จำนวนข้อความ → แชทที่เปิดอยู่หักออก 1)
  const activeConvRow = activeConv ? conversations.find((c: any) => c.id === activeConv.id) : null
  const otherUnread = Math.max(0, channelUnread - (activeConvRow && (activeConvRow.unread_count || 0) > 0 && !activeConvRow.is_archived ? 1 : 0))

  // ขอบเขตที่แอดมิน "เห็นอยู่จริง" — เลือกเพจอยู่ = เฉพาะเพจนั้น ไม่ใช่ทั้งช่องทาง
  const scopedUnread = pageFilter ? (unreadByPage[pageFilter] || 0) : channelUnread
  const scopedNeedsReply = pageFilter ? (needsReplyByPage[pageFilter] || 0) : channelNeedsReply
  const scopedName = pageFilter
    ? (() => { const p: any = channelPages.find((x: any) => x.id === pageFilter); return p?.nickname || p?.page_name || 'เพจนี้' })()
    : `ทุกเพจ${channelFilter ? ` ${channelFilter === 'line' ? 'LINE' : 'Facebook'}` : ''}`

  // อ่านทั้งหมด — เคลียร์ unread ตามขอบเขตที่เห็นอยู่ (ใช้ตอนจัดการที่ LINE OA แล้วอยากให้ตัวเลขตรง)
  async function markAllRead() {
    if (markingRead || scopedUnread === 0) return
    if (!window.confirm(`ทำเครื่องหมายว่าอ่านแล้ว ${scopedUnread} แชท ใน "${scopedName}"?\n\nการกระทำนี้ย้อนกลับไม่ได้`)) return
    setMarkingRead(true)
    const ids = new Set<string>(pageFilter ? [pageFilter] : channelPages.map((p: any) => p.id))
    // optimistic — ไม่แตะแชทที่จัดเก็บ ให้ตรงกับ API (ไม่งั้นเลขเด้งกลับหลังโหลดใหม่)
    setConversations(prev => prev.map(c => ids.has(c.page_id) && !c.is_archived ? { ...c, unread_count: 0 } : c))
    patchCachedConvs(c => ids.has(c.page_id) && !c.is_archived ? { ...c, unread_count: 0 } : c)
    setUnreadByPage(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = 0 }); return n })
    setTotalUnread(t => Math.max(0, t - scopedUnread))
    try {
      const res = await fetch('/api/inbox/mark-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageFilter ? { pageId: pageFilter } : (channelFilter ? { channel: channelFilter } : {})),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) setErrorBanner(friendlyError(data.error) || 'ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ')
    } catch (e: any) {
      setErrorBanner(friendlyError(e?.message))
    }
    finally { setMarkingRead(false); loadConversations({ silent: true }) }
  }
  const fbPages = pages.filter(p => channelOf(p) === 'facebook')
  const linePages = pages.filter(p => channelOf(p) === 'line')

  // ล้างสถานะแชทที่เปิดอยู่ทั้งหมด (รวม openReqRef/openSeqRef กันผลโหลดเก่าเด้งเปิดเองทีหลัง)
  const resetOpenChat = () => {
    stashDraft()   // กดย้อนกลับแล้วที่พิมพ์ค้างไว้ต้องอยู่ครบตอนเปิดแชทนี้ใหม่
    openSeqRef.current++
    openReqRef.current = ''
    lastMsgIdRef.current = null
    lastRealMsgIdRef.current = null
    draftValueRef.current = ''
    setNewMsgCount(0)
    setActiveConv(null); setMessages([])
    setAiSuggestions([]); setErrorBanner(null); setShowChatMenu(false)
  }
  // ปิดแชท + ถอยรายการ history ที่เพิ่มไว้ตอนเปิดแชท
  // ไม่ถอย = แอดมินกดปุ่มย้อนกลับของเครื่องครั้งแรกแล้วไม่มีอะไรเกิดขึ้น (ต้องกด 2 ครั้งถึงจะออก)
  const clearOpenChat = () => {
    resetOpenChat()
    try { if ((window.history.state as any)?.ibChat) window.history.back() } catch {}
  }
  // ปุ่มย้อนกลับของเครื่อง/ปัดขอบจอ → ปิดแชทที่เปิดอยู่ก่อน ไม่ใช่ออกจากกล่องข้อความไปเลย
  const resetOpenChatRef = useRef(resetOpenChat)
  resetOpenChatRef.current = resetOpenChat
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if ((e.state as any)?.ibChat) return   // ยังอยู่ชั้น "เปิดแชท" (เช่นกดเดินหน้า)
      if (!openReqRef.current) return
      resetOpenChatRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const pickChannel = (ch: 'facebook' | 'line') => {
    setChannelFilter(ch); setPageFilter(''); clearOpenChat()
  }
  // กลับไปหน้าเลือกช่องทาง (Facebook / LINE) ใหม่
  const backToChannels = () => {
    setChannelFilter(null); setPageFilter(''); clearOpenChat()
  }

  // เลือกช่องทางให้อัตโนมัติเมื่อมีช่องทางเดียว + กันค้างเมื่อเพจของช่องทางที่เลือกหายไป
  // (เช่น เจ้าของถอนสิทธิ์เพจ / ยกเลิกการเชื่อม LINE) → ไม่งั้นกล่องข้อความว่างและกดออกไม่ได้
  useEffect(() => {
    if (pages.length === 0) return
    const chans = Array.from(new Set(pages.map(channelOf)))
    if (!channelFilter) {
      if (chans.length === 1) setChannelFilter(chans[0] as 'facebook' | 'line')
      return
    }
    if (!chans.includes(channelFilter)) {
      // ช่องทางที่เลือกไม่มีเพจแล้ว → เด้งไปช่องทางที่เหลือ หรือกลับหน้าเลือก
      if (chans.length === 1) { setChannelFilter(chans[0] as 'facebook' | 'line'); setPageFilter(''); clearOpenChat() }
      else backToChannels()
    }
  }, [pages, channelFilter])

  // เพจที่เลือกอยู่หายไป (ถูกถอนสิทธิ์/ปิดใช้งาน) → กลับไป "ทุกเพจ" แทนที่จะค้างว่างเปล่า
  useEffect(() => {
    if (!pageFilter || pages.length === 0) return
    if (!pages.some(p => p.id === pageFilter)) setPageFilter('')
  }, [pages, pageFilter])

  // server กรองคำค้นให้แล้ว (ค้นทั้งฐานข้อมูล ไม่ใช่แค่ที่โหลดมา) — ที่นี่กรองแค่ช่องทาง
  // ระหว่างรอ debounce ให้กรองแบบหยาบไปก่อน เพื่อให้จอตอบสนองทันที
  // กรองฝั่ง client ต่อไปจนกว่าผลจาก server จะมาถึงจริง (ไม่ใช่แค่ debounce ครบ)
  // ไม่งั้นลิสต์เก่าที่ยังไม่กรองจะเด้งขึ้นมาแทนผลค้นหา 1 จังหวะ
  const searchPending = search.trim() !== debouncedSearch || loadingList
  // useMemo: หน้านี้วาดใหม่บ่อยมาก (toast, ตัวเลขใหม่, กำลังส่ง ฯลฯ) — ไม่ต้องกรองรายการใหม่ทุกครั้ง
  const filteredConvs = useMemo(() => conversations.filter(c => {
    if (channelFilter && (c.connected_pages?.channel || 'facebook') !== channelFilter) return false
    if (pageFilter && c.page_id !== pageFilter) return false
    if (!searchPending || !search.trim()) return true
    const s = search.trim().toLowerCase()
    return (c.customer_name || '').toLowerCase().includes(s)
      || (c.last_message || '').toLowerCase().includes(s)
  }), [conversations, channelFilter, pageFilter, searchPending, search])

  // ── callback ที่ "ไม่เปลี่ยนตัวตน" ให้แถวรายการแชท/ฟองข้อความที่ห่อด้วย React.memo ──
  // ถ้าสร้างใหม่ทุกครั้งที่วาด memo จะไร้ผล (props เปลี่ยนทุกรอบ) แล้วทุกตัวอักษรที่พิมพ์
  // จะสั่งวาดฟองข้อความเป็นร้อยฟอง + รายการแชทอีกหลายสิบแถวใหม่ทั้งหมด
  const openConvRef = useRef<(c: any) => void>(() => {})
  openConvRef.current = (c: any) => {
    rememberListScroll()
    // แตะแชทที่เปิดอยู่แล้ว = ไม่ต้องล้างจอ/ลบที่พิมพ์ค้างไว้ แค่ดึงข้อความใหม่เงียบๆ
    // (ยกเว้นตอนโหลดไม่สำเร็จ — ตรงนั้นแอดมินตั้งใจกดเพื่อ "ลองเข้าแชทใหม่")
    if (activeConv?.id === c.id && !errorBanner) { loadMessagesSilentRef.current?.(); return }
    loadMessages(c)
  }
  const onOpenConv = useCallback((c: any) => openConvRef.current(c), [])
  const retryRef = useRef<(m: any) => void>(() => {})
  retryRef.current = retryMessage
  const onRetryMsg = useCallback((m: any) => { retryRef.current(m) }, [])
  const discardRef = useRef<(m: any) => void>(() => {})
  discardRef.current = discardFailed
  const onDiscardMsg = useCallback((m: any) => { discardRef.current(m) }, [])
  // ค่าที่ทุกฟองใช้ร่วมกัน — คำนวณครั้งเดียวต่อแชท ไม่ใช่ทุกฟองทุกครั้งที่วาด
  const activeCustomerPic = useMemo(() => customerAvatarSrc(activeConv), [activeConv])
  const activeFbInboxUrl = useMemo(() => facebookInboxUrl(activeConv), [activeConv])
  // ข้อความบันทึกที่ "ผูกกับเพจ" ต้องขึ้นเฉพาะแชทของเพจนั้น
  // แอดมินที่ดูแล 2 ร้าน เดิมเห็นของร้าน A ตอนตอบลูกค้าร้าน B → ส่งเลขบัญชีผิดร้านให้ลูกค้า
  // (ข้อความที่ไม่ได้ผูกเพจยังขึ้นทุกแชทเหมือนเดิม — ฝั่ง API ยังไม่ได้บอกว่าเพจนี้เจ้าของคือใคร)
  const repliesForActive = useMemo(
    () => (activeConv?.page_id ? quickReplies.filter(qr => !qr.page_id || qr.page_id === activeConv.page_id) : quickReplies),
    [quickReplies, activeConv?.page_id],
  )
  // ช่องพิมพ์: โฟกัสแล้วเลื่อนลงท้ายแชท (เลื่อนตัวคอลัมน์เอง ไม่ใช่ scrollIntoView ที่ลาก .ib-main ไปด้วย)
  const onComposerFocus = useCallback(() => {
    setTimeout(() => { const el = msgPaneRef.current; if (el) el.scrollTop = el.scrollHeight }, 350)
  }, [])
  const sendRef = useRef<() => void>(() => {})
  sendRef.current = () => { handleSend() }
  const onComposerSend = useCallback(() => { sendRef.current() }, [])

  return (
    <div className="ib-root" data-active={activeConv ? '1' : '0'} style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', background: BG, color: TEXT, fontFamily: 'Inter, "Sarabun", system-ui, sans-serif', position: 'relative', overflow: 'hidden', overscrollBehavior: 'none' }}>
      <style dangerouslySetInnerHTML={{ __html: INBOX_CSS }} />
      {/* Background pattern */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(rgba(24,119,242,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(24,119,242,0.045) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />

      {/* Sidebar (compact mini-rail) */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 244,
        boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(28px)',
        borderRight: `1.5px solid ${BORDER}`, padding: '18px 14px 16px',
        display: 'flex', flexDirection: 'column', gap: 6, zIndex: 50,
        boxShadow: '4px 0 28px rgba(24,119,242,0.08)', overflowY: 'auto',
      }} className="ib-sidebar">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 8px 16px', borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #1877f2 0%, #2e89ff 60%, #5fa3ff 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(11,95,204,0.4)' }}>⚡</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: TEXT, lineHeight: 1.2 }}>FACEBOOK CHAT</div>
            <div style={{ fontSize: 10, color: PRIMARY, fontWeight: 800, marginTop: 1, letterSpacing: 0.5 }}>NAIWANSOOK</div>
          </div>
        </div>

        {session?.user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'linear-gradient(135deg, #eaf2fd, #dcebff)', borderRadius: 12, marginBottom: 12, border: `1px solid ${BORDER}` }}>
            {/* ลิงก์รูปใน session หมดอายุ (รูปแตก) → ขอรูปล่าสุดผ่าน /api/avatar, ไม่มีรูป = ตัวอักษรย่อ */}
            <Avatar name={session.user.name || 'U'} src={selfAvatarSrc} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name || 'ผู้ใช้'}</div>
              <div style={{ fontSize: 9, color: GREEN, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN }} />เชื่อมต่อแล้ว
              </div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: MUTED, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, padding: '6px 10px 4px' }}>เมนูหลัก</div>

        <NavItem icon={<MessageSquare size={15} />} label="กล่องข้อความ" active badge={channelUnread} />
        <button onClick={() => { setSettingsTab('general'); setShowSettings(true) }} style={{ all: 'unset', display: 'block', cursor: 'pointer' }}>
          <NavItem icon={<Settings size={15} />} label="ตั้งค่าแชท" />
        </button>
        {canManageChannels && (
          <Link href="/dashboard/channels" style={{ textDecoration: 'none' }}>
            <NavItem icon={<Share2 size={15} />} label="ช่องทางแชท" />
          </Link>
        )}
        {isOwner && (
          <Link href="/dashboard/team" style={{ textDecoration: 'none' }}>
            <NavItem icon={<Users size={15} />} label="จัดการทีม" />
          </Link>
        )}

        <div style={{ flex: 1, minHeight: 16 }} />

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ ...btnGhost, padding: '10px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'flex-start', color: RED, border: `1.5px solid rgba(220,38,38,0.18)`, fontWeight: 800 }}
        >
          <LogOut size={14} /> ออกจากระบบ
        </button>
      </aside>

      {/* Mobile top bar (visible < 820px) */}
      <div className="ib-mobile-bar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
        borderBottom: `1.5px solid ${BORDER}`, padding: '10px 14px',
        alignItems: 'center', gap: 10, height: 52, boxSizing: 'border-box',
      }}>
        <Link href="/dashboard/inbox" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
          <div style={{ width: 32, height: 32, flexShrink: 0, background: 'linear-gradient(135deg, #1877f2, #5fa3ff)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
          <div className="ib-hide-narrow" style={{ fontWeight: 900, fontSize: 12.5, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>FACEBOOK CHAT</div>
        </Link>
        <div style={{ flex: 1 }} />
        {/* ตัวสลับช่องทางอยู่ที่แท็บใน page bar ที่เดียว (เดิมมี pill ตรงนี้ซ้ำ ดูเป็นคนละฟีเจอร์) */}
        {/* เมนูบนมือถือ — sidebar ถูกซ่อน จึงเป็นทางเดียวที่เข้าถึงตั้งค่า/ช่องทาง/ออกจากระบบได้ */}
        <button
          onClick={() => setShowMobileMenu(true)}
          aria-label="เมนู"
          title="เมนู"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${BORDER}`,
            background: SURFACE2, color: TEXT, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Menu size={19} />
        </button>
      </div>

      {/* Main 3-column layout */}
      <main data-active={activeConv ? '1' : '0'} style={{ marginLeft: 244, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }} className="ib-main">
        {/* เลือกช่องทางก่อน (Facebook / LINE) — โชว์เมื่อมีทั้งสองช่องทางและยังไม่เลือก */}
        {showChannelGate && (
          <div className="ib-channel-gate" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 244, zIndex: 120, background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', overflowY: 'auto' }}>
            {/* margin auto = จัดกลางเมื่อจอสูงพอ / เลื่อนดูได้เมื่อจอเตี้ย (safe center รองรับไม่ทั่ว) */}
            <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: TEXT }}>เลือกช่องทางที่จะตอบ</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 600, marginTop: 4 }}>แยกตอบ Facebook กับ LINE เพื่อไม่ให้สับสน</div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 520 }}>
              {([['facebook', 'Facebook', '#1877f2', 'f', fbPages], ['line', 'LINE', '#06c755', 'L', linePages]] as const).map(([ch, label, color, mark, arr]) => {
                const un = sumUnread(arr)
                return (
                  <button key={ch} className="fbpop" onClick={() => pickChannel(ch as 'facebook' | 'line')}
                    style={{ position: 'relative', flex: '1 1 200px', minWidth: 170, maxWidth: 240, background: 'white', border: `2px solid ${color}`, borderRadius: 20, padding: '26px 18px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, boxShadow: `0 8px 24px ${color}22` }}>
                    {/* แจ้งเตือนจำนวนแชทที่ยังไม่ได้อ่าน — มุมขวาบน */}
                    {un > 0 && (
                      <span style={{ position: 'absolute', top: -10, right: -10, minWidth: 30, height: 30, padding: '0 8px', borderRadius: 15, background: RED, color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(220,38,38,0.5)', border: '2.5px solid white' }}>
                        {un > 99 ? '99+' : un}
                      </span>
                    )}
                    <div style={{ width: 58, height: 58, borderRadius: 16, background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900 }}>{mark}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: TEXT }}>{label}</div>
                    <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{arr.length} เพจ</div>
                    {un > 0 ? (
                      <span style={{ background: '#fee2e2', color: RED, fontSize: 12.5, fontWeight: 900, padding: '4px 13px', borderRadius: 999 }}>🔴 {un} แชทยังไม่อ่าน</span>
                    ) : (
                      <span style={{ background: '#dcfce7', color: GREEN, fontSize: 12, fontWeight: 800, padding: '4px 13px', borderRadius: 999 }}>✓ อ่านครบแล้ว</span>
                    )}
                  </button>
                )
              })}
            </div>
            </div>
          </div>
        )}
        {/* Page tiles top bar — 3 ต่อแถว มีตัวเลข unread สีแดง */}
        {pages.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
            borderBottom: `1.5px solid ${BORDER}`, padding: '12px 16px',
            flexShrink: 0,
          }} className="ib-pagebar">
            {/* สลับช่องทาง Facebook / LINE (โชว์เมื่อมีทั้งสอง) */}
            {bothChannels && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, maxWidth: 980 }}>
                {([['facebook', 'Facebook', '#1877f2', 'f', sumUnread(fbPages)], ['line', 'LINE', '#06c755', 'L', sumUnread(linePages)]] as const).map(([ch, label, color, mark, un]) => {
                  const on = channelFilter === ch
                  return (
                    <button key={ch} className="fbtap" onClick={() => pickChannel(ch as 'facebook' | 'line')}
                      style={{
                        flex: 1, position: 'relative', padding: '9px 12px', borderRadius: 11,
                        border: `2px solid ${on ? color : BORDER}`,
                        background: on ? color : 'white', color: on ? 'white' : TEXT,
                        fontSize: 13, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        boxShadow: on ? `0 5px 16px ${color}55` : SHADOW_SM,
                      }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, background: on ? 'rgba(255,255,255,0.25)' : color, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{mark}</span>
                      {label}
                      {un > 0 && (
                        <span style={{ background: on ? 'rgba(255,255,255,0.3)' : RED, color: 'white', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>{un > 99 ? '99+' : un}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <div ref={pagebarScrollRef} style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              maxWidth: 980,
            }}>
              {/* "ทุกเพจ" tile */}
              <button
                className="fbtap"
                onClick={() => setPageFilter('')}
                style={{
                  position: 'relative', padding: '10px 14px', borderRadius: 12,
                  border: `2px solid ${pageFilter === '' ? PRIMARY : BORDER}`,
                  background: pageFilter === '' ? 'linear-gradient(135deg, #1877f2, #2e89ff)' : 'white',
                  color: pageFilter === '' ? 'white' : TEXT,
                  fontSize: 12.5, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                  boxShadow: pageFilter === '' ? '0 5px 16px rgba(11,95,204,0.32)' : SHADOW_SM,
                }}
              >
                <span style={{ fontSize: 14 }}>📂</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ทุกเพจ ({channelPages.length})
                </span>
                {channelUnread > 0 && (
                  <span style={{
                    background: pageFilter === '' ? 'rgba(255,255,255,0.25)' : RED,
                    color: 'white', fontSize: 10, fontWeight: 800,
                    padding: '2px 7px', borderRadius: 999, minWidth: 20, textAlign: 'center',
                    flexShrink: 0,
                  }}>{channelUnread > 99 ? '99+' : channelUnread}</span>
                )}
              </button>

              {/* แต่ละเพจ — สีพื้นประจำเพจ (แยกชัด) + ชื่อเล่น + ปุ่มแก้ชื่อ + unread */}
              {channelPages.map(p => {
                const pc = pageColor(p.id)
                const active = pageFilter === p.id
                const unread = unreadByPage[p.id] || 0
                const display = p.nickname || p.page_name
                return (
                  // ปุ่มเลือกเพจ + ปุ่มแก้ชื่อ เป็นปุ่มแยกกัน (เดิมซ้อนกันทำให้กดพลาด/คีย์บอร์ดเข้าไม่ถึง)
                  <div key={p.id} style={{ position: 'relative', display: 'flex', minWidth: 0 }}>
                    <button
                      className="fbtap"
                      onClick={() => setPageFilter(p.id)}
                      title={p.nickname ? `${p.nickname} · ${p.page_name}` : p.page_name}
                      aria-pressed={active}
                      style={{
                        flex: 1, minWidth: 0,
                        padding: '10px 44px 10px 12px', borderRadius: 12, minHeight: 44,
                        border: `2px solid ${pc.border}`,
                        background: active ? pc.avatar : pc.bg,
                        color: active ? 'white' : pc.text,
                        fontSize: 12.5, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                        boxShadow: active ? `0 5px 16px ${pc.border}66` : `0 2px 8px ${pc.border}22`,
                      }}
                    >
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: active ? 'white' : pc.border, flexShrink: 0,
                        boxShadow: active ? 'none' : `0 0 0 3px ${pc.border}22`,
                      }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {display}
                      </span>
                      {unread > 0 && (
                        <span style={{
                          background: active ? 'rgba(255,255,255,0.3)' : RED,
                          color: 'white', fontSize: 11, fontWeight: 800,
                          padding: '2px 7px', borderRadius: 999, minWidth: 20, textAlign: 'center',
                          flexShrink: 0,
                        }}>{unread > 99 ? '99+' : unread}</span>
                      )}
                    </button>
                    <button
                      onClick={() => openRename(p)}
                      title="ตั้งชื่อเล่นเพจ"
                      aria-label={`ตั้งชื่อเล่นเพจ ${display}`}
                      style={{
                        position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
                        background: active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.85)',
                        color: active ? 'white' : pc.text,
                        border: 'none', fontFamily: 'inherit',
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 3-column body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Column 1: Conversation List */}
        <section style={{
          width: 340, flexShrink: 0, background: SURFACE,
          borderRight: `1.5px solid ${BORDER}`, display: 'flex', flexDirection: 'column',
        }} className="ib-col1">
          {/* Header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: 'linear-gradient(135deg, #1877f2, #5fa3ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(11,95,204,0.3)',
                }}>
                  <MessageSquare size={16} color="white" strokeWidth={2.5} />
                </div>
                <h1 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: TEXT, letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>กล่องข้อความ</h1>
              </div>
              {/* ดึงข้อความใหม่เดี๋ยวนี้ — ระบบดึงให้เองทุก ~1 นาทีอยู่แล้ว แต่ช่วงลูกค้าสั่งรัวๆ แอดมินอยากกดเองให้แน่ใจ
                  (หน้านี้ล็อกการเลื่อนไว้ "ลากลงเพื่อรีเฟรช" แบบแอปอื่นจึงใช้ไม่ได้) */}
              <button
                onClick={manualSync}
                disabled={syncing || pageSyncing}
                title="ดึงข้อความใหม่จาก Facebook"
                aria-label="ดึงข้อความใหม่จาก Facebook"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '8px 11px', minHeight: 38, borderRadius: 10,
                  border: `1.5px solid ${BORDER2}`, background: SURFACE2,
                  color: syncing || pageSyncing ? MUTED : PRIMARY,
                  fontSize: 11.5, fontWeight: 800, fontFamily: 'inherit',
                  cursor: syncing || pageSyncing ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={13} style={(syncing || pageSyncing) ? { animation: 'spin 1s linear infinite' } : undefined} />
                {(syncing || pageSyncing) ? 'ซิงค์...' : 'ดึงข้อความใหม่'}
              </button>
              {/* ปุ่ม "อ่านแล้ว" ใช้เฉพาะ LINE (LINE ไม่ส่งสถานะอ่านจาก OA Manager มาให้) — Facebook ไม่ต้องมี */}
              {LINE_ENABLED && channelFilter === 'line' && scopedUnread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingRead}
                  title={`ทำเครื่องหมายว่าอ่านแล้ว ${scopedUnread} แชท ใน ${scopedName}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    padding: '8px 12px', minHeight: 38, borderRadius: 10,
                    border: `1.5px solid ${PRIMARY}`,
                    background: 'white', color: PRIMARY, fontSize: 12, fontWeight: 800,
                    fontFamily: 'inherit', cursor: markingRead ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Check size={13} strokeWidth={3} />
                  {pageFilter ? 'อ่านแล้ว (เพจนี้)' : 'อ่านแล้ว (ทุกเพจ)'}
                </button>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาลูกค้า..."
                aria-label="ค้นหาลูกค้า"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                style={{
                  width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10,
                  border: `1.5px solid ${BORDER}`, background: SURFACE2,
                  fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Status filter — high-contrast segmented control (active = filled purple) */}
            <div style={{
              display: 'flex', gap: 3, padding: 4,
              background: '#dcebff', borderRadius: 11,
              border: `1.5px solid ${BORDER2}`,
            }}>
              {([
                ['all', 'ทั้งหมด', null, null],
                // ต้องเป็นตัวเลขของ "ขอบเขตที่กำลังดูอยู่" (เลือกเพจไหน = เฉพาะเพจนั้น)
                // ไม่งั้นชิปบอก 20 แต่ในลิสต์มี 2 รายการ
                ['unread', 'ใหม่', null, scopedUnread > 0 ? scopedUnread : null],
                ['needs_reply', 'ยังไม่ตอบ', null, scopedNeedsReply > 0 ? scopedNeedsReply : null],
                ['starred', null, Star, null],
                ['archived', null, Archive, null],
              ] as const).map(([key, label, Icon, count]) => {
                const active = statusFilter === key
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key as any)}
                    title={key === 'starred' ? 'ติดดาว' : key === 'archived' ? 'จัดเก็บ' : undefined}
                    aria-pressed={active}
                    aria-label={key === 'starred' ? 'ติดดาว' : key === 'archived' ? 'จัดเก็บ' : String(label)}
                    style={{
                      flex: 1, padding: '9px 4px', minHeight: 38, border: 'none',
                      borderRadius: 8,
                      // ACTIVE = filled gradient purple → ชัดเจนเด่นมาก
                      background: active
                        ? 'linear-gradient(135deg, #1877f2, #2e89ff)'
                        : 'transparent',
                      boxShadow: active
                        ? '0 3px 10px rgba(11,95,204,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'none',
                      fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                      fontFamily: 'inherit',
                      // INACTIVE ใช้น้ำเงินเข้ม (contrast ≥ 7:1 บนพื้น #dcebff) — เดิมเทาจางอ่านไม่ออกกลางแดด
                      color: active ? 'white' : '#0b4a9c',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      transition: 'all 0.18s',
                    }}
                  >
                    {Icon ? <Icon size={15} /> : label}
                    {count !== null && count !== undefined && (
                      <span style={{
                        background: active ? 'rgba(255,255,255,0.28)' : RED,
                        color: 'white',
                        fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                        minWidth: 16, textAlign: 'center', lineHeight: 1.5,
                      }}>{count > 99 ? '99+' : count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* แจ้งปัญหาการดึงข้อมูลเบื้องหลัง — อยู่เหนือรายการแชท ไม่ไปทับแบนเนอร์ในห้องแชท */}
          {syncNotice && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 14px', background: '#fff4e5', borderBottom: '1px solid rgba(245,158,11,0.35)',
              fontSize: 12, color: '#92400e', fontWeight: 700, lineHeight: 1.55,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>{syncNotice.text}</div>
              <button
                onClick={() => { dismissedSyncSigRef.current = syncNotice.sig; setSyncNotice(null) }}
                aria-label="ปิดข้อความแจ้งเตือน" title="ปิด"
                style={{ all: 'unset', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
              ><X size={15} /></button>
            </div>
          )}
          {/* โหลดรายการแชทไม่สำเร็จ ทั้งที่ยังมีรายการเก่าค้างอยู่บนจอ — บอกว่าที่เห็นอาจไม่ใช่ล่าสุด */}
          {listError && filteredConvs.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', background: RED_L, borderBottom: `1px solid ${RED}33`,
              fontSize: 12, color: RED, fontWeight: 700,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>{listError}</div>
            </div>
          )}

          {/* List */}
          <div ref={listScrollRef} style={{ flex: 1, overflowY: 'auto' }}>
            {(loadingList || pageSyncing) && filteredConvs.length === 0 && !search.trim() ? (
              <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 12 }}>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <div>{pageSyncing ? 'กำลังดึงแชทจากเพจ...' : 'กำลังโหลด...'}</div>
              </div>
            ) : filteredConvs.length === 0 ? (
              // ระหว่างรอผลค้นหาจาก server อย่าเพิ่งบอกว่า "ไม่พบ" (เดี๋ยวผลโผล่ทีหลัง แอดมินเลิกหาไปแล้ว)
              searchPending && search.trim() ? (
                <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 12.5 }}>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                  <div>กำลังค้นหา "{search.trim()}"...</div>
                </div>
              ) : search.trim() ? (
                <EmptyState
                  icon={<Search size={36} />}
                  title={`ไม่พบ "${search.trim()}"`}
                  hint="ลองพิมพ์ชื่อลูกค้าหรือข้อความให้สั้นลง หรือเปลี่ยนตัวกรอง/เพจ"
                />
              ) : statusFilter !== 'all' ? (
                <EmptyState
                  icon={<ListFilter size={36} />}
                  title="ไม่มีแชทในตัวกรองนี้"
                  hint="ลองกด 'ทั้งหมด' เพื่อดูแชททุกรายการ"
                />
              ) : listError && !listEverLoadedRef.current ? (
                // โหลดรอบแรกไม่สำเร็จ ≠ ไม่มีเพจ — เดิมขึ้น "ยังไม่มีเพจที่เชื่อมต่อ" ทำให้เข้าใจผิดว่าเพจหลุด
                <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
                  <div style={{ marginBottom: 10, opacity: 0.45 }}><AlertCircle size={36} /></div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 4 }}>โหลดรายการแชทไม่สำเร็จ</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 240, margin: '0 auto 12px' }}>
                    ตรวจสอบอินเทอร์เน็ตแล้วกด "ลองใหม่" — ข้อมูลแชทยังอยู่ครบ
                  </div>
                  <button
                    onClick={() => loadConvRef.current()}
                    style={{ ...btnPrimary, padding: '10px 20px', fontSize: 13, minHeight: 42 }}
                  >ลองใหม่</button>
                </div>
              ) : (
                <EmptyState
                  icon={<Inbox size={36} />}
                  title={pages.length === 0 ? 'ยังไม่มีเพจที่เชื่อมต่อ' : 'ยังไม่มีข้อความ'}
                  hint={pages.length === 0
                    // canManageChannels = null คือยังไม่รู้สิทธิ์ (กำลังถาม server อยู่) — ห้ามบอกว่าไม่มีสิทธิ์
                    ? (canManageChannels === null ? 'กำลังตรวจสอบสิทธิ์ของคุณ — สักครู่'
                      : canManageChannels ? (LINE_ENABLED ? 'ไปที่เมนู "ช่องทางแชท" เพื่อเชื่อมต่อเพจหรือ LINE OA' : 'ไปที่เมนู "ช่องทางแชท" เพื่อเชื่อมเพจ Facebook')
                      : 'ให้เจ้าของเพจมอบสิทธิ์เพจให้คุณก่อน')
                    : 'เพจนี้ยังไม่มีบทสนทนา หรือลูกค้ายังไม่ได้ทักเข้ามา'}
                />
              )
            ) : (
              <>
                {filteredConvs.map(c => (
                  <ConvItem
                    key={c.id}
                    conv={c}
                    active={activeConv?.id === c.id}
                    onOpen={onOpenConv}
                  />
                ))}
                {/* โหลดเพิ่ม — เดิมตันที่ 50 รายการ เลื่อนสุดแล้วจบดื้อๆ หาลูกค้าเก่าไม่เจอ */}
                {conversations.length >= listLimit && listLimit < 500 && (
                  <button
                    onClick={() => setListLimit(n => Math.min(n + 50, 500))}
                    disabled={loadingList}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      width: '100%', padding: '16px 12px', minHeight: 52,
                      background: 'transparent', border: 'none', borderTop: `1px solid ${BORDER}`,
                      cursor: loadingList ? 'wait' : 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 800, color: PRIMARY,
                    }}
                  >
                    {loadingList
                      ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> กำลังโหลด...</>
                      : <>โหลดแชทเก่าเพิ่ม</>}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Column 2: Chat Thread */}
        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: SURFACE2 }} className="ib-col2">
          {!activeConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, padding: 20 }}>
              <div style={{ textAlign: 'center', maxWidth: 320 }}>
                <div style={{ fontSize: 48, marginBottom: 10, lineHeight: 1 }}>💬</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, marginBottom: 5 }}>เลือกบทสนทนา</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>เลือกข้อความจากด้านซ้ายเพื่อเริ่มแชทกับลูกค้า</div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header — page-colored top stripe so admin always knows which page they're replying from */}
              <div style={{
                padding: '12px 14px', background: SURFACE,
                borderBottom: `1.5px solid ${BORDER}`,
                borderTop: `4px solid ${pageColor(activeConv.page_id).border}`,
                display: 'flex', alignItems: 'center', gap: 10, boxShadow: SHADOW_SM,
                position: 'relative', flexShrink: 0,
              }}>
                <button
                  onClick={clearOpenChat}
                  className="ib-back"
                  title={otherUnread > 0 ? `กลับไปเลือกแชทอื่น (มีแชทใหม่ ${otherUnread})` : 'กลับไปเลือกแชทอื่น'}
                  aria-label={otherUnread > 0 ? `กลับไปเลือกแชทอื่น มีแชทใหม่ ${otherUnread} แชท` : 'กลับไปเลือกแชทอื่น'}
                  style={{
                    display: 'none', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    width: 40, height: 40, flexShrink: 0, borderRadius: 11,
                    background: pageColor(activeConv.page_id).bg,
                    color: pageColor(activeConv.page_id).text,
                    border: `1.5px solid ${pageColor(activeConv.page_id).border}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <ChevronLeft size={22} strokeWidth={2.6} />
                  {/* บนมือถือ เปิดแชทอยู่จะไม่เห็นรายการเลย — ตัวเลขนี้คือสัญญาณเดียวว่ามีลูกค้าคนอื่นรออยู่ */}
                  {otherUnread > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px',
                      borderRadius: 999, background: RED, color: 'white', fontSize: 10.5, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid white', lineHeight: 1,
                    }}>{otherUnread > 99 ? '99+' : otherUnread}</span>
                  )}
                </button>
                <Avatar name={activeConv.customer_name} src={customerAvatarSrc(activeConv)} size={40} ringColor={pageColor(activeConv.page_id).border} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: TEXT, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {activeConv.customer_name || 'ลูกค้า'}
                    </span>
                    {activeConv.is_starred && <Star size={13} fill={YELLOW} color={YELLOW} style={{ flexShrink: 0 }} />}
                  </div>
                  <div style={{ marginTop: 3, display: 'flex' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 999,
                      background: pageColor(activeConv.page_id).bg,
                      color: pageColor(activeConv.page_id).text,
                      fontSize: 11.5, fontWeight: 900,
                      border: `1.5px solid ${pageColor(activeConv.page_id).border}`,
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {activeConv.connected_pages?.channel === 'line' ? (
                        <span style={{ fontSize: 8, fontWeight: 900, color: 'white', background: '#06c755', borderRadius: 3, padding: '1px 3px', flexShrink: 0 }}>LINE</span>
                      ) : (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pageColor(activeConv.page_id).border, flexShrink: 0 }} />
                      )}
                      {activeConv.connected_pages?.nickname || activeConv.connected_pages?.page_name || 'เพจ'}
                    </span>
                  </div>
                </div>

                {/* จอใหญ่: ปุ่มเรียงให้เห็นเลย */}
                <div className="ib-chat-actions ib-hide-mobile" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => patchConv({ is_starred: !activeConv.is_starred })}
                    title={activeConv.is_starred ? 'เลิกติดดาว' : 'ติดดาว'}
                    aria-label={activeConv.is_starred ? 'เลิกติดดาว' : 'ติดดาว'}
                    style={{ ...btnGhost, padding: 8 }}
                  >
                    <Star size={14} fill={activeConv.is_starred ? YELLOW : 'transparent'} color={activeConv.is_starred ? YELLOW : MUTED} />
                  </button>
                  <button
                    onClick={() => patchConv({ is_resolved: !activeConv.is_resolved })}
                    title={activeConv.is_resolved ? 'เปิดบทสนทนาใหม่' : 'จบบทสนทนา'}
                    aria-label={activeConv.is_resolved ? 'เปิดบทสนทนาใหม่' : 'จบบทสนทนา'}
                    style={{ ...btnGhost, padding: 8, color: activeConv.is_resolved ? GREEN : MUTED }}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={() => patchConv({ is_archived: !activeConv.is_archived })}
                    title="จัดเก็บ"
                    aria-label="จัดเก็บ"
                    style={{ ...btnGhost, padding: 8 }}
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    title="ข้อมูลลูกค้า"
                    aria-label="ข้อมูลลูกค้า"
                    className="ib-toggle-right"
                    style={{ ...btnGhost, padding: 8 }}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>

                {/* มือถือ: รวมปุ่มรองไว้ในเมนู ⋯ → ชื่อลูกค้าได้พื้นที่เต็ม */}
                <button
                  onClick={() => setShowChatMenu(v => !v)}
                  className="ib-only-mobile-flex"
                  title="ตัวเลือกเพิ่มเติม"
                  aria-label="ตัวเลือกเพิ่มเติม"
                  aria-expanded={showChatMenu}
                  style={{
                    display: 'none', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, flexShrink: 0, borderRadius: 11,
                    background: showChatMenu ? PRIMARY_LIGHT : SURFACE2,
                    color: showChatMenu ? PRIMARY : MUTED,
                    border: `1.5px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <MoreVertical size={18} />
                </button>

              {/* เมนูตัวเลือกบนมือถือ — อยู่ในหัวแชท (position:relative) จึงเกาะใต้หัวเสมอ */}
              {showChatMenu && (
                <>
                  <div
                    onClick={() => setShowChatMenu(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  />
                  <div style={{
                    position: 'absolute', top: '100%', right: 12, marginTop: 6, zIndex: 100,
                    background: SURFACE, borderRadius: 14, border: `1.5px solid ${BORDER}`,
                    boxShadow: '0 12px 40px rgba(15,23,42,0.18)', overflow: 'hidden', minWidth: 210,
                  }}>
                    {[
                      {
                        label: activeConv.is_starred ? 'เลิกติดดาว' : 'ติดดาว',
                        icon: <Star size={16} fill={activeConv.is_starred ? YELLOW : 'transparent'} color={activeConv.is_starred ? YELLOW : MUTED} />,
                        onClick: () => patchConv({ is_starred: !activeConv.is_starred }),
                      },
                      {
                        label: activeConv.is_resolved ? 'เปิดบทสนทนาใหม่' : 'จบบทสนทนา',
                        icon: <CheckCircle2 size={16} color={activeConv.is_resolved ? GREEN : MUTED} />,
                        onClick: () => patchConv({ is_resolved: !activeConv.is_resolved }),
                      },
                      {
                        label: activeConv.is_archived ? 'เอาออกจากที่จัดเก็บ' : 'จัดเก็บแชทนี้',
                        icon: <Archive size={16} color={MUTED} />,
                        onClick: () => patchConv({ is_archived: !activeConv.is_archived }),
                      },
                      ...(bothChannels ? [{
                        label: `เปลี่ยนช่องทาง (${channelFilter === 'line' ? 'LINE' : 'Facebook'})`,
                        icon: <Share2 size={16} color={channelFilter === 'line' ? '#06804a' : PRIMARY} />,
                        onClick: backToChannels,
                      }] : []),
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={() => { setShowChatMenu(false); item.onClick() }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                          padding: '13px 16px', background: 'transparent', border: 'none',
                          borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: TEXT,
                          textAlign: 'left',
                        }}
                      >
                        {item.icon}{item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              </div>

              {/* Error banner */}
              {errorBanner && (
                <div style={{
                  padding: '10px 18px', background: RED_L, borderBottom: `1px solid ${RED}33`,
                  fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700,
                }}>
                  <AlertCircle size={14} />
                  <div style={{ flex: 1 }}>{errorBanner}</div>
                  <button onClick={() => setErrorBanner(null)} aria-label="ปิดข้อความแจ้งเตือน" title="ปิด" style={{ all: 'unset', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
                </div>
              )}

              {/* Messages */}
              <div
                ref={msgPaneRef}
                onScroll={e => {
                  const el = e.currentTarget
                  nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
                  if (nearBottomRef.current && newMsgCount > 0) setNewMsgCount(0)
                }}
                style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}
              >
                {/* ระหว่างโหลดประวัติแชท ยังส่งข้อความได้ → ถ้ามีฟองอยู่แล้วต้องโชว์ ไม่ใช่ขึ้นสปินเนอร์ทับ */}
                {loadingMessages && messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 12 }}>
                    ยังไม่มีข้อความในบทสนทนานี้
                  </div>
                ) : messages.map((m, i) => (
                  <MessageBubble
                    key={m.id || i}
                    message={m}
                    customerName={activeConv.customer_name}
                    customerPic={activeCustomerPic}
                    fbInboxUrl={activeFbInboxUrl}
                    onDiscard={onDiscardMsg}
                    onRetry={onRetryMsg}
                    // ส่งเป็น true/false แทนการสลับ callback → props ของฟองไม่เปลี่ยนตัวตนทุกครั้งที่วาด
                    canRetry={!(retriedTick >= 0 && retriedRef.current.has(retryKeyOf(activeConv.id, m)))}
                    onMediaReady={onMediaReady}
                  />
                ))}
                {/* ลูกค้าตอบมาตอนกำลังเลื่อนอ่านข้อความเก่า → ไม่กระชากจอ แต่ต้องรู้ว่ามีของใหม่อยู่ข้างล่าง */}
                {newMsgCount > 0 && (
                  <button
                    onClick={() => {
                      const el = msgPaneRef.current
                      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
                      nearBottomRef.current = true
                      setNewMsgCount(0)
                    }}
                    style={{
                      position: 'sticky', bottom: 8, alignSelf: 'center', zIndex: 5,
                      padding: '9px 16px', minHeight: 40, borderRadius: 999, border: 'none',
                      background: PRIMARY, color: 'white', fontWeight: 800, fontSize: 12.5,
                      fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 6px 18px rgba(11,95,204,0.4)',
                    }}
                  >
                    มีข้อความใหม่ {newMsgCount > 99 ? '99+' : newMsgCount} ข้อความ ↓
                  </button>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Suggestions */}
              {aiSuggestions.length > 0 && (
                <div style={{
                  padding: '12px 18px', background: 'linear-gradient(135deg, #eaf2fd, #dcebff)',
                  borderTop: `1px solid ${BORDER2}`,
                  // คำแนะนำ 3 ข้อสูงเกือบ 300px — พอคีย์บอร์ดเด้ง จอเหลือ ~360px
                  // ถ้าไม่จำกัดความสูง แถวช่องพิมพ์กับปุ่ม "ส่ง" จะถูกดันตกจอ พิมพ์ต่อเองไม่ได้
                  flex: '0 1 auto', minHeight: 0,
                  maxHeight: 'calc(var(--app-height, 100vh) * 0.4)',
                  overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={13} />
                    <span style={{ flex: 1 }}>AI แนะนำคำตอบ — กดเพื่อใช้</span>
                    {/* เดิมปิดไม่ได้ ต้องเลือกสักอันหรือสลับแชทหนี */}
                    <button
                      onClick={() => setAiSuggestions([])}
                      aria-label="ปิดคำแนะนำ AI"
                      title="ปิดคำแนะนำ"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: PRIMARY, display: 'flex', padding: 4, minHeight: 30, minWidth: 30, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {aiSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { insertIntoDraft(s); setAiSuggestions([]) }}
                        style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                          border: `1.5px solid ${BORDER2}`, background: 'white',
                          fontSize: 12, color: TEXT, cursor: 'pointer', fontFamily: 'inherit',
                          lineHeight: 1.5, transition: 'all 0.15s',
                          whiteSpace: 'normal', wordBreak: 'break-word',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = SURFACE2; e.currentTarget.style.borderColor = PRIMARY }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = BORDER2 as string }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* แจ้งเตือนแชทที่ส่งไม่ได้ (ลูกค้าไม่พร้อม) */}
              {activeConv.send_block_code && (
                <div style={{
                  padding: '10px 18px', background: '#fff4e5',
                  borderTop: '1px solid rgba(245,158,11,0.3)',
                  fontSize: 12, color: '#92400e', fontWeight: 600, lineHeight: 1.55,
                  display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0,
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    {activeConv.send_block_code === 551
                      ? 'ลูกค้ายังไม่เปิด Messenger คุยกับเพจ (หรือปิดรับ/บล็อกเพจ) — พิมพ์ตอบได้ แต่จะส่งไม่ออกจนกว่าลูกค้าจะทักกลับมาก่อน'
                      : 'เกิน 24 ชม. นับจากข้อความล่าสุดของลูกค้า — Facebook ห้ามตอบจนกว่าลูกค้าจะทักกลับมาใหม่'}
                  </div>
                </div>
              )}

              {/* Composer — flexShrink: 0 กันโดนบีบตกจอตอนคีย์บอร์ดเปิด */}
              <div style={{ padding: '10px 14px 14px', background: SURFACE, borderTop: `1.5px solid ${BORDER}`, flexShrink: 0 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSendImage(f); e.target.value = '' }}
                />
                {/* 2 แถวบนมือถือ (ช่องพิมพ์ได้พื้นที่เต็ม) → แถวเดียวบนจอใหญ่ */}
                <div className="ib-composer">
                  <div className="ib-composer-actions">
                    {/* ข้อความตอบกลับที่บันทึกไว้ (saved replies) */}
                    <button
                      onClick={() => {
                        setShowSavedReplies(true)
                        // โหลดรอบก่อนพลาด (เน็ตหลุดตอนเปิดแอป) หรือรายการที่ถืออยู่เป็นของเพจอื่น → โหลดใหม่ตามเพจของแชทนี้
                        const qrPage = activeConv.page_id || ''
                        if (qrLoadFailed || quickReplies.length === 0 || qrLoadedForRef.current !== qrPage) loadQuickReplies(qrPage)
                      }}
                      className="ib-composer-grow"
                      title="ข้อความตอบกลับที่บันทึกไว้"
                      aria-label="ข้อความตอบกลับที่บันทึกไว้"
                      style={{
                        padding: '10px 12px', borderRadius: 12, border: 'none', flexShrink: 0,
                        background: 'linear-gradient(135deg, #1877f2, #2e89ff)', color: 'white',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                        boxShadow: '0 4px 12px rgba(24,119,242,0.32)', minHeight: 42,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Plus size={17} strokeWidth={2.8} />
                      <span className="ib-only-mobile">ข้อความบันทึก</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || sending}
                      title="แนบรูปภาพ"
                      aria-label="แนบรูปภาพ"
                      style={{
                        padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
                        background: SURFACE2, color: PRIMARY, flexShrink: 0,
                        cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center',
                        minHeight: 42,
                      }}
                    >
                      {uploading ? <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={17} />}
                    </button>
                    {aiEnabledByPage[activeConv.page_id] !== false && (
                    <button
                      onClick={() => handleAiSuggest()}
                      disabled={aiLoading}
                      className="ib-composer-grow"
                      title="ให้ AI ช่วยร่างคำตอบ"
                      style={{
                        padding: '10px 13px', borderRadius: 12, border: 'none', flexShrink: 0,
                        background: aiLoading ? '#dcebff' : 'linear-gradient(135deg, #8b5cf6, #2e89ff)',
                        color: aiLoading ? PRIMARY : 'white', cursor: aiLoading ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800,
                        fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(139,92,246,0.3)', minHeight: 42,
                      }}
                    >
                      {aiLoading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
                      AI ช่วยตอบ
                    </button>
                    )}
                  </div>

                  {/* key = ล้างช่องพิมพ์ให้เองเมื่อสลับแชท (ค่าเริ่มต้นดึงจากร่างที่เก็บไว้ของแชทนั้น) */}
                  <Composer
                    key={activeConv.id}
                    initialText={draftsRef.current.get(activeConv.id) || ''}
                    isDesktop={isDesktop}
                    sending={sending}
                    onSend={onComposerSend}
                    onTextChange={onDraftChange}
                    onFocusScroll={onComposerFocus}
                    apiRef={composerApiRef}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Column 3: Right panel — customer info */}
        {activeConv && showRightPanel && (
          <aside style={{
            width: 280, flexShrink: 0, background: SURFACE,
            borderLeft: `1.5px solid ${BORDER}`, padding: 18, overflowY: 'auto',
          }} className="ib-col3">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 18, borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
              <Avatar name={activeConv.customer_name} src={customerAvatarSrc(activeConv)} size={64} />
              <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, textAlign: 'center' }}>
                {activeConv.customer_name || 'ลูกค้า'}
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>📄 {activeConv.connected_pages?.nickname || activeConv.connected_pages?.page_name}</div>
            </div>

            {/* AI Insights */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                <Bot size={11} style={{ display: 'inline', marginRight: 4 }} /> AI Insights
              </div>

              {activeConv.ai_category && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>หมวดหมู่</div>
                  <span style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: 999,
                    background: categoryConfig[activeConv.ai_category]?.bg || '#f1f5f9',
                    color: categoryConfig[activeConv.ai_category]?.color || MUTED,
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {categoryConfig[activeConv.ai_category]?.label || activeConv.ai_category}
                  </span>
                </div>
              )}

              {activeConv.ai_sentiment && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>อารมณ์ลูกค้า</div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: sentimentConfig[activeConv.ai_sentiment]?.color }}>
                    {sentimentConfig[activeConv.ai_sentiment]?.emoji} {sentimentConfig[activeConv.ai_sentiment]?.label}
                  </span>
                </div>
              )}

              {activeConv.ai_summary && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>สรุปบทสนทนา</div>
                  <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6, padding: 8, background: SURFACE2, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                    {activeConv.ai_summary}
                  </div>
                </div>
              )}

              {!activeConv.ai_category && !activeConv.ai_sentiment && (
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                  กดปุ่ม "AI ช่วยตอบ" เพื่อให้ AI วิเคราะห์บทสนทนา
                </div>
              )}
            </div>

            {/* AI tone tweaks */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                <Zap size={11} style={{ display: 'inline', marginRight: 4 }} /> สั่ง AI
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: '💬 ตอบสั้นๆ', val: 'ตอบให้สั้นกระชับที่สุด ไม่เกิน 2 ประโยค' },
                  { label: '📝 ตอบละเอียด', val: 'ตอบแบบละเอียด อธิบายครบถ้วน' },
                  { label: '😊 อบอุ่นมากขึ้น', val: 'ตอบให้อบอุ่น เป็นกันเอง มี emoji เพิ่ม' },
                  { label: '💼 ทางการ', val: 'ตอบแบบทางการ มืออาชีพ' },
                  { label: '🛒 ปิดการขาย', val: 'ช่วยปิดการขาย แนะนำให้ลูกค้ายืนยันสั่งซื้อ' },
                ].map(t => (
                  <button
                    key={t.label}
                    onClick={() => handleAiSuggest(t.val)}
                    disabled={aiLoading}
                    style={{
                      ...btnGhost, padding: '7px 10px', fontSize: 11, fontWeight: 700,
                      textAlign: 'left', color: TEXT, justifyContent: 'flex-start',
                    }}
                  >{t.label}</button>
                ))}
              </div>
            </div>
          </aside>
        )}
        </div>
      </main>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          pages={pages}
          isOwner={isOwner === true}
          initialTab={settingsTab}
          onClose={() => {
            setShowSettings(false)
            setSettingsTab('general')
            // บังคับดึงค่าใหม่ → สวิตช์ "เปิดปุ่ม AI ช่วยตอบ" มีผลทันที แม้ยังเปิดแชทเดิมค้างอยู่
            setSettingsVer(v => v + 1)
          }}
          onSaved={() => { loadConversations(); loadQuickReplies() }}
        />
      )}

      {/* ข้อความตอบกลับที่บันทึกไว้ (saved replies) — เปิดจากปุ่ม + ในแถบพิมพ์ */}
      {showSavedReplies && (
        <div onClick={() => setShowSavedReplies(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 210, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          {/* --app-height มาจาก visualViewport: ใช้แทน dvh เพราะ iOS ต่ำกว่า 15.4 ไม่รู้จัก dvh
              → ความสูงไม่ถูกจำกัด แผ่นจะสูงเลยขอบบน ปุ่ม "ยกเลิก"/"+ สร้าง" หลุดจอกดไม่ได้
              ข้อดีอีกอย่าง: ค่านี้หดตามคีย์บอร์ดด้วย */}
          <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, width: '100%', maxWidth: 520, maxHeight: 'calc(var(--app-height, 100vh) * 0.72)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(15,23,42,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
              <div style={{ width: 44, height: 5, borderRadius: 3, background: '#cbd5e1' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <button onClick={() => setShowSavedReplies(false)} style={{ background: 'transparent', border: 'none', color: MUTED, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: TEXT }}>ข้อความตอบกลับที่บันทึกไว้</div>
              {/* เพิ่ม/ลบข้อความบันทึกได้เฉพาะเจ้าของเพจ (API ตีกลับ 403) — ลูกทีมกดแล้วจะงงว่าทำไมไม่มีอะไรเกิดขึ้น */}
              {isOwner
                ? <button onClick={() => { setShowSavedReplies(false); setSettingsTab('qr'); setShowSettings(true) }} style={{ background: 'transparent', border: 'none', color: PRIMARY, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ สร้าง</button>
                : <span style={{ width: 52 }} />}
            </div>
            {/* minHeight: 0 → ส่วนนี้คือส่วนที่ย่อและเลื่อนเอง หัวแผ่นกับปุ่มด้านบนจะไม่ถูกดันหลุดจอ */}
            <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, padding: '4px 0 calc(16px + env(safe-area-inset-bottom))' }}>
              {repliesForActive.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: MUTED, fontSize: 13, lineHeight: 1.8 }}>
                  {qrLoadFailed ? (
                    <>
                      โหลดข้อความบันทึกไม่สำเร็จ<br />
                      <button
                        onClick={() => loadQuickReplies(activeConv?.page_id || '')}
                        style={{ marginTop: 10, padding: '9px 16px', minHeight: 40, fontSize: 12.5, fontWeight: 800, borderRadius: 10, border: `1.5px solid ${BORDER}`, background: SURFACE2, color: PRIMARY, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ลองใหม่อีกครั้ง
                      </button>
                    </>
                  ) : (
                    <>
                      ยังไม่มีข้อความบันทึกไว้<br />
                      <span style={{ fontSize: 12 }}>
                        {isOwner ? 'กด "+ สร้าง" เพื่อเพิ่มข้อความตอบกลับที่ใช้บ่อย' : 'ให้เจ้าของเพจเพิ่มให้ที่เมนู "ตั้งค่าแชท"'}
                      </span>
                    </>
                  )}
                </div>
              ) : repliesForActive.map(qr => (
                <button
                  key={qr.id}
                  onClick={() => { insertIntoDraft(qr.message); setShowSavedReplies(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 18px', background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: TEXT, marginBottom: 3 }}>⚡ {qr.title}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{qr.message}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: PRIMARY, background: PRIMARY_LIGHT, padding: '6px 13px', borderRadius: 999, flexShrink: 0 }}>ใช้</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rename page nickname modal */}
      {renamePage && (
        <div
          onClick={() => { setRenamePage(null); setNicknameError(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 24px 70px rgba(15,23,42,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: pageColor(renamePage.id).avatar,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              }}><Pencil size={17} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: TEXT }}>ตั้งชื่อเล่นเพจ</div>
                <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renamePage.page_name}</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, margin: '10px 0 12px' }}>
              ชื่อเล่นจะแสดงแทนชื่อเต็มในกล่องข้อความ ช่วยให้ดูสะอาดและโฟกัสที่ข้อความลูกค้า
            </p>
            <input
              autoFocus
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => {
                // ยัง "เลือกคำ" จาก IME อยู่ → Enter คือยืนยันคำ ไม่ใช่กดบันทึก
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                if (e.key === 'Enter') saveNickname()
              }}
              placeholder={renamePage.page_name}
              maxLength={60}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14, fontWeight: 700,
                border: `2px solid ${pageColor(renamePage.id).border}`, borderRadius: 12,
                fontFamily: 'inherit', background: SURFACE2, boxSizing: 'border-box', marginBottom: 14, color: TEXT,
              }}
            />
            {nicknameError && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
                padding: '9px 11px', background: RED_L, border: `1px solid ${RED}44`, borderRadius: 10,
                fontSize: 12, fontWeight: 700, color: RED, lineHeight: 1.5,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{nicknameError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setNicknameDraft(''); }}
                title="ล้างชื่อเล่น (กลับไปใช้ชื่อเต็ม)"
                style={{ padding: '11px 14px', fontSize: 12, fontWeight: 800, background: SURFACE2, color: MUTED, border: `1.5px solid ${BORDER}`, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ล้าง
              </button>
              <button
                onClick={() => { setRenamePage(null); setNicknameError(null) }}
                style={{ flex: 1, padding: '11px 14px', fontSize: 13, fontWeight: 800, background: SURFACE2, color: TEXT, border: `1.5px solid ${BORDER}`, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ยกเลิก
              </button>
              <button
                className="fbtap"
                onClick={saveNickname}
                disabled={savingNickname}
                style={{
                  flex: 1, padding: '11px 14px', fontSize: 13, fontWeight: 900,
                  background: savingNickname ? '#94a3b8' : 'linear-gradient(135deg, #1877f2, #2e89ff)',
                  color: 'white', border: 'none', borderRadius: 11, cursor: savingNickname ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Check size={15} /> {savingNickname ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* เมนูมือถือ — sidebar ถูกซ่อนที่ ≤820px ถ้าไม่มีอันนี้จะเข้าตั้งค่า/ช่องทาง/ออกจากระบบไม่ได้เลย */}
      {showMobileMenu && (
        <div
          onClick={() => setShowMobileMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 330, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: SURFACE, width: '100%', borderRadius: '20px 20px 0 0',
              padding: '10px 14px calc(env(safe-area-inset-bottom, 0px) + 18px)',
              boxShadow: '0 -12px 40px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '4px auto 14px' }} />
            {session?.user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: SURFACE2, borderRadius: 12, marginBottom: 10 }}>
                <Avatar name={session.user.name || 'U'} src={selfAvatarSrc} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name || 'ผู้ใช้'}</div>
                  <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>● เชื่อมต่อแล้ว</div>
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowMobileMenu(false); setSettingsTab('general'); setShowSettings(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: TEXT, textAlign: 'left' }}
            >
              <Settings size={17} color={PRIMARY} /> ตั้งค่าแชท
            </button>
            {canManageChannels && (
              <Link href="/dashboard/channels" onClick={() => setShowMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', borderBottom: `1px solid ${BORDER}`, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: TEXT }}>
                <Share2 size={17} color={PRIMARY} /> ช่องทางแชท
              </Link>
            )}
            {isOwner && (
              <Link href="/dashboard/team" onClick={() => setShowMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', borderBottom: `1px solid ${BORDER}`, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: TEXT }}>
                <Users size={17} color={PRIMARY} /> จัดการทีม
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: RED, textAlign: 'left' }}
            >
              <LogOut size={17} /> ออกจากระบบ
            </button>
          </div>
        </div>
      )}

      {/* แบนเนอร์ error ตอนอยู่หน้ารายการแชท (ในแชทมีของตัวเองอยู่แล้ว)
          — ไม่งั้น error ที่เกิดตอนโหลดลิสต์/กด "อ่านทั้งหมด" จะไม่มีใครเห็นเลย */}
      {errorBanner && !activeConv && (
        <div style={{
          position: 'fixed', left: 12, right: 12, zIndex: 310,
          top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
          padding: '11px 14px', background: RED_L, border: `1.5px solid ${RED}55`, borderRadius: 12,
          fontSize: 12.5, color: RED, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700,
          boxShadow: '0 10px 30px rgba(15,23,42,0.16)', maxWidth: 620, margin: '0 auto',
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{errorBanner}</div>
          <button onClick={() => setErrorBanner(null)} aria-label="ปิดข้อความแจ้งเตือน" title="ปิด" style={{ all: 'unset', cursor: 'pointer', padding: 6, display: 'flex', flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}

      {/* เซสชันหมดอายุ — บอกให้ล็อกอินใหม่ แทนที่จะขึ้นว่า "ยังไม่มีเพจ" ให้เข้าใจผิด */}
      {sessionExpired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 350, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: SURFACE, borderRadius: 20, padding: 26, width: '100%', maxWidth: 380, textAlign: 'center', boxShadow: '0 24px 70px rgba(15,23,42,0.3)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: TEXT, marginBottom: 6 }}>เซสชันหมดอายุ</div>
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, margin: '0 0 18px' }}>
              ระบบออกจากระบบให้อัตโนมัติเพื่อความปลอดภัย<br />กรุณาเข้าสู่ระบบใหม่เพื่อตอบแชทต่อ
            </p>
            <button
              onClick={() => signOut({ callbackUrl: '/login?callbackUrl=/dashboard/inbox' })}
              style={{
                width: '100%', padding: '13px', fontSize: 14, fontWeight: 900, minHeight: 46,
                background: 'linear-gradient(135deg, #1877f2, #2e89ff)', color: 'white',
                border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              เข้าสู่ระบบใหม่
            </button>
          </div>
        </div>
      )}

      {/* Toast + เลิกทำ */}
      {toast && (
        <div className={activeConv ? 'ib-toast-above-composer' : undefined} style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)', zIndex: 320,
          background: '#1a1f3c', color: 'white', borderRadius: 14,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 14px 40px rgba(15,23,42,0.35)', maxWidth: 'calc(100vw - 32px)',
        }}>
          {/* ห้ามตัดท้ายข้อความ — "ส่งรูปไม่สำเร็จ" ถูกตัดเหลือ "ส่งรูป..." จะอ่านเหมือนส่งสำเร็จ */}
          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, minWidth: 0 }}>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => { const u = toast.undo!; setToast(null); u() }}
              style={{
                background: 'transparent', border: 'none', color: '#7fb8ff',
                fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
                padding: '4px 2px', flexShrink: 0, minHeight: 32,
              }}
            >
              เลิกทำ
            </button>
          )}
          {toast.action && (
            <button
              onClick={() => { const a = toast.action!; setToast(null); a.run() }}
              style={{
                background: 'transparent', border: 'none', color: '#7fb8ff',
                fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
                padding: '4px 2px', flexShrink: 0, minHeight: 32, whiteSpace: 'nowrap',
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => setToast(null)} aria-label="ปิด" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Components ───────────────────────────────────────────────

function NavItem({ icon, label, active, badge }: { icon: ReactNode; label: string; active?: boolean; badge?: number }) {
  const baseColor = active ? PRIMARY : '#374151'
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '10px 12px', borderRadius: 11,
        background: active ? 'linear-gradient(135deg, #eaf2fd, #dcebff)' : 'transparent',
        color: baseColor, cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 800 : 700,
        border: `1px solid ${active ? BORDER2 : 'transparent'}`,
        boxShadow: active ? '0 3px 10px rgba(11,95,204,0.12)' : 'none',
        position: 'relative', transition: 'all 0.15s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{ background: RED, color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </div>
  )
}

// รูปลูกค้า: ถ้าเป็นรูปในระบบเราแล้ว ใช้ตรงๆ · "none:" = ไม่มีรูป · อย่างอื่น (ลิงก์ FB ชั่วคราว/หมดอายุ)
// → ขอผ่าน /api/inbox/avatar ให้ระบบดึงมาเก็บใหม่ (ครั้งเดียว รอบถัดไปได้ URL ถาวรจากรายการเลย)
function customerAvatarSrc(conv: any): string | undefined {
  const pic: string | null = conv?.customer_picture || null
  // ยังไม่มีรูปเลย (Facebook ไม่ให้สิทธิ์ดึงรูปโปรไฟล์) → ขึ้นตัวอักษรย่อทันที
  // เดิมยิง /api/inbox/avatar ให้ทุกแถวที่ยังไม่มีรูป = เปิดกล่องข้อความทีเดียว 50 request
  // แต่ละอันปลุก serverless + query DB + ยิง Graph ไปแย่งเน็ตกับการส่งข้อความของแอดมินเอง
  // (ฝั่ง sync/webhook เก็บรูปให้อยู่แล้ว พอมีรูปแถวนี้จะมี URL จริงเอง)
  if (!pic) return undefined
  if (pic.includes('/storage/v1/object/public/chat-uploads/avatars/')) return pic
  if (pic.startsWith('none:')) return undefined
  if (!conv?.id || String(conv.id).startsWith('temp-')) return pic
  return `/api/inbox/avatar/${encodeURIComponent(conv.id)}`   // ลิงก์ FB เดิมที่หมดอายุ → ให้ระบบดึงมาเก็บใหม่
}

const Avatar = memo(function Avatar({ name, src, size = 40, ringColor }: { name?: string; src?: string; size?: number; ringColor?: string }) {
  const ring = ringColor ? `2px solid ${ringColor}` : '1.5px solid white'
  // ตัวอักษรย่ออยู่ข้างล่างเสมอ รูปซ้อนทับเมื่อโหลดเสร็จ — ระหว่างรอรูป (หรือรูปแตก) จะไม่เห็นวงกลมว่างๆ
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setBroken(false); setLoaded(false) }, [src])
  const showImg = !!src && !broken
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #5fa3ff, #2e89ff)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, boxShadow: SHADOW_SM,
      border: ring, boxSizing: 'border-box',
    }}>
      {/* ตัดตาม code point — ชื่อที่ขึ้นต้นด้วย emoji (เช่น "🌸น้องมิว") จะไม่กลายเป็น "�" */}
      {(Array.from(name || '?')[0] || '?').toUpperCase()}
      {showImg && (
        <img
          src={src}
          alt=""
          // แถวที่ยังไม่เลื่อนมาถึงไม่ต้องโหลด — รายการแชทยาวได้ถึง 500 แถว
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity .15s' }}
        />
      )}
    </div>
  )
})

// ── ช่องพิมพ์ข้อความ + ปุ่มส่ง ──
// แยกเป็นคอมโพเนนต์ของตัวเอง และเก็บ "ข้อความที่กำลังพิมพ์" ไว้ในนี้เอง
// เดิมเก็บใน state ของทั้งหน้า → ทุกตัวอักษรที่พิมพ์สั่งวาดใหม่ทั้งกล่องข้อความ
// (ฟองแชทได้ถึง 200 ฟอง + รายการแชทอีกได้ถึง 500 แถว ที่ยังอยู่ในจอแค่ถูก CSS ซ่อนไว้)
// มือถือรุ่นประหยัดจึงพิมพ์แล้วตัวอักษรขึ้นเป็นชุดๆ ตามไม่ทัน
// ตอนนี้พิมพ์ = วาดใหม่เฉพาะแถวนี้ ส่วนหน้าแม่รู้ค่าล่าสุดผ่าน onTextChange (เขียนลง ref ไม่ใช่ state)
type ComposerApi = { insert: (text: string) => void; clear: () => void }

// Facebook ไม่รับข้อความยาวเกิน 2,000 ตัวอักษร (api/inbox/send ตีกลับ 400 ตั้งแต่ยังไม่ยิงไป Graph)
// ห้ามใช้ maxLength ของ textarea — มันตัดท้ายข้อความที่วางมาแบบเงียบๆ แอดมินจะไม่รู้ว่าหายไปท่อนไหน
const FB_TEXT_LIMIT = 2000
const FB_TEXT_WARN_AT = 1800

const Composer = memo(function Composer({ initialText, isDesktop, sending, onSend, onTextChange, onFocusScroll, apiRef }: {
  initialText: string
  isDesktop: boolean
  sending: boolean
  onSend: () => void
  onTextChange: (text: string) => void
  onFocusScroll: () => void
  apiRef: React.MutableRefObject<ComposerApi | null>
}) {
  const [text, setText] = useState(initialText)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const textRef = useRef(text)
  textRef.current = text
  const changeRef = useRef(onTextChange)
  changeRef.current = onTextChange
  const set = (v: string) => { textRef.current = v; setText(v); changeRef.current(v) }

  // ช่องพิมพ์ขยายตามจำนวนบรรทัด (สูงสุด 140px) — เดิม rows=1 ตายตัว พิมพ์ยาวแล้วอ่านไม่ออก
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight ไม่รวมเส้นขอบ แต่ทั้งหน้าใช้ box-sizing: border-box → สูงขาดไป ~3px
    // ผลคือพิมพ์บรรทัดเดียวก็มีแถบเลื่อนโผล่ (เห็นชัดบน Windows)
    const border = el.offsetHeight - el.clientHeight
    const needed = el.scrollHeight + border
    el.style.height = `${Math.min(needed, 140)}px`
    el.style.overflowY = needed > 140 ? 'auto' : 'hidden'
  }, [text])

  // ให้หน้าแม่สั่งแทรกข้อความ (ข้อความบันทึก/คำแนะนำ AI) และล้างช่องหลังส่งสำเร็จได้
  useEffect(() => {
    apiRef.current = {
      insert: (t: string) => {
        const cur = textRef.current.trim()
        set(cur ? `${cur}\n${t}` : t)
        setTimeout(() => { const el = taRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, 30)
      },
      clear: () => set(''),
    }
    return () => { apiRef.current = null }
  }, [apiRef])

  // นับแบบเดียวกับฝั่ง server (text.trim()) ไม่งั้นตัวเลขบนจอกับที่ Facebook เห็นไม่ตรงกัน
  const len = text.trim().length
  const empty = len === 0
  const tooLong = len > FB_TEXT_LIMIT
  const cantSend = empty || sending || tooLong
  return (
    // flexWrap + flexBasis:100% ที่ตัวนับ → ตัวนับได้บรรทัดของตัวเอง ช่องพิมพ์กับปุ่มส่งยังอยู่แถวเดิม
    <div className="ib-composer-input" style={{ flexWrap: 'wrap' }}>
      {len >= FB_TEXT_WARN_AT && (
        <div role="status" style={{ flexBasis: '100%', order: -1, fontSize: 12, fontWeight: 800, lineHeight: 1.5, color: tooLong ? RED : MUTED }}>
          {tooLong
            ? `ข้อความยาว ${len}/2,000 ตัวอักษร — Facebook ไม่รับ ต้องลบให้สั้นลง หรือแบ่งส่งเป็นหลายข้อความ`
            : `${len}/2,000 ตัวอักษร`}
        </div>
      )}
      <textarea
        ref={taRef}
        value={text}
        onChange={e => set(e.target.value)}
        onKeyDown={e => {
          // Enter = ส่ง เฉพาะบนคอม (มีเมาส์/คีย์บอร์ดจริง)
          // บนมือถือ Enter = ขึ้นบรรทัดใหม่ (ไม่งั้นพิมพ์หลายบรรทัดไม่ได้)
          if (e.key !== 'Enter' || e.shiftKey || !isDesktop) return
          // ยังเลือกคำจาก IME อยู่ (จีน/ญี่ปุ่น/เวียดนาม หรือคำแนะนำของ macOS)
          // Enter ตรงนี้คือ "ยืนยันคำ" ไม่ใช่ "ส่ง" — Safari รายงานเป็น keyCode 229
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          e.preventDefault()
          if (textRef.current.trim().length > FB_TEXT_LIMIT) return   // ยาวเกินลิมิต — กด Enter ก็ห้ามส่ง เหมือนปุ่มส่งที่ปิดอยู่
          onSend()
        }}
        onFocus={onFocusScroll}
        placeholder="พิมพ์ข้อความ..."
        rows={1}
        aria-label="ช่องพิมพ์ข้อความตอบลูกค้า"
        className="ib-chat-input"
        style={{
          flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 12,
          border: `1.5px solid ${BORDER}`, background: SURFACE2,
          fontSize: 16, fontFamily: 'inherit', resize: 'none', outline: 'none',
          maxHeight: 140, overflowY: 'auto', color: TEXT, lineHeight: 1.5,
        }}
      />
      <button
        type="button"
        // กันปุ่มแย่งโฟกัสไปจากช่องพิมพ์ — บน Android คีย์บอร์ดจะปิดทุกครั้งที่กดส่ง
        // แล้วจอเด้ง ต้องแตะช่องพิมพ์ใหม่ทุกข้อความ
        onMouseDown={e => e.preventDefault()}
        onClick={onSend}
        disabled={cantSend}
        // บอกเหตุผลที่กดไม่ได้ — ปุ่มจางเฉยๆ แอดมินจะนึกว่าแอปค้าง
        title={tooLong ? 'ข้อความยาวเกิน 2,000 ตัวอักษร — Facebook ไม่รับ' : undefined}
        style={{
          ...btnPrimary, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13.5, flexShrink: 0, minHeight: 44,
          opacity: cantSend ? 0.5 : 1,
          cursor: cantSend ? 'not-allowed' : 'pointer',
        }}
      >
        {sending ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        ส่ง
      </button>
    </div>
  )
})

const ConvItem = memo(function ConvItem({ conv, active, onOpen }: { conv: any; active: boolean; onOpen: (conv: any) => void }) {
  const unread = conv.unread_count > 0
  const pc = pageColor(conv.page_id)
  const isLine = conv.connected_pages?.channel === 'line'
  const pageName = conv.connected_pages?.nickname || conv.connected_pages?.page_name
  const bgFor = () => active ? PRIMARY_LIGHT : (unread ? `linear-gradient(90deg, ${pc.bg} 0%, ${pc.bg}55 40%, white 100%)` : 'white')
  return (
    <button
      onClick={() => onOpen(conv)}
      aria-current={active ? 'true' : undefined}
      aria-label={`แชทกับ ${conv.customer_name || 'ลูกค้า'} เพจ ${pageName || ''}${unread ? ` ยังไม่อ่าน ${conv.unread_count} ข้อความ` : ''}`}
      style={{
        display: 'flex', gap: 11, padding: '13px 14px', cursor: 'pointer',
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        borderTop: 'none', borderRight: 'none',
        borderBottom: `1px solid ${BORDER}`,
        background: bgFor(),
        borderLeft: `4px solid ${active ? PRIMARY : pc.border}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = SURFACE2 }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = bgFor() }}
    >
      <Avatar name={conv.customer_name} src={customerAvatarSrc(conv)} size={44} ringColor={pc.border} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
          <div style={{
            fontSize: 14.5, fontWeight: unread ? 900 : 700, color: TEXT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>
            {conv.customer_name || 'ลูกค้า'}
            {conv.is_starred && <Star size={12} fill={YELLOW} color={YELLOW} style={{ marginLeft: 5, display: 'inline', verticalAlign: 'middle' }} />}
          </div>
          <div style={{ fontSize: 11.5, color: unread ? PRIMARY : MUTED, flexShrink: 0, fontWeight: unread ? 800 : 600 }}>
            {timeAgo(conv.last_message_at)}
          </div>
        </div>

        {/* ป้ายเพจ + สถานะ — รวมไว้แถวเดียว ลดความรก */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 999,
            background: pc.bg, color: pc.text,
            fontSize: 11.5, fontWeight: 800,
            border: `1px solid ${pc.border}33`,
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isLine ? (
              <span style={{ fontSize: 9.5, fontWeight: 900, color: 'white', background: '#06804a', borderRadius: 4, padding: '1px 4px', flexShrink: 0, letterSpacing: 0.3 }}>LINE</span>
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc.border, flexShrink: 0 }} />
            )}
            {pageName}
          </span>
          {conv.send_block_code && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 9px', borderRadius: 999,
              background: '#fff4e5', color: '#92400e',
              fontSize: 11.5, fontWeight: 800, border: '1px solid rgba(245,158,11,0.45)',
            }}>
              ⚠️ รอลูกค้าทัก
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontSize: 13, color: unread ? TEXT : MUTED, fontWeight: unread ? 700 : 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          }}>
            {conv.last_sender === 'page' && <span style={{ color: MUTED }}>คุณ: </span>}
            {conv.last_message || '(ไม่มีข้อความ)'}
          </div>
          {unread && (
            // แดงให้ตรงกับตัวเลขบนไทล์เพจ/หน้าเลือกช่องทาง (เดิมน้ำเงิน = สีเดียวกับ "กำลังเลือก" ทำให้สับสน)
            <span style={{ background: RED, color: 'white', fontSize: 11.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, minWidth: 20, textAlign: 'center', flexShrink: 0 }}>
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

// ทำลิงก์/เบอร์โทรในข้อความลูกค้าให้กดได้ (เดิมเป็น text ต้องกดค้าง copy เอง)
const Linkify = memo(function Linkify({ text, onDark }: { text: string; onDark?: boolean }) {
  const linkStyle: any = {
    color: onDark ? '#d6e9ff' : PRIMARY,
    textDecoration: 'underline',
    wordBreak: 'break-all',
  }
  const src = String(text ?? '')
  // ห้ามใช้ lookbehind ((?<!...)) — iOS Safari ต่ำกว่า 16.4 โยน SyntaxError ตอน parse
  // ทำให้ทั้งหน้าจอขาว → ใช้ exec loop แล้วเช็คอักขระข้างหน้าด้วย JS แทน
  // ฀-๿ = อักษรไทย: ต้องตัดออกจากตัว URL เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ
  // ("สั่งได้ที่ https://lin.ee/abc123นะคะ" เดิมลากคำว่า "นะคะ" เข้าไปในลิงก์ → กดแล้ว 404)
  // ลิงก์ที่มีภาษาไทยในพาธจริงๆ จะถูกตัดสั้น แต่ลิงก์ที่ลูกค้าก๊อปมามักเป็น %E0%B8.. (ASCII) อยู่แล้ว
  const re = /(?:https?:\/\/|www\.)[^\s฀-๿]*[^\s฀-๿.,!?;:)\]}"'…]|0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/g
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(src)) !== null) {
    const val = m[0]
    const start = m.index
    const isUrl = /^(https?:\/\/|www\.)/i.test(val)
    // เบอร์โทร: ต้องไม่มีตัวเลขขนาบหน้า/หลัง (กันตัดเลขบัญชี/เลขพัสดุยาวๆ ผิด)
    if (!isUrl) {
      const before = src[start - 1]
      const after = src[start + val.length]
      if ((before && /\d/.test(before)) || (after && /\d/.test(after))) continue
    }
    if (start > last) nodes.push(<span key={`t${k++}`}>{src.slice(last, start)}</span>)
    if (isUrl) {
      const href = val.startsWith('http') ? val : `https://${val}`
      nodes.push(
        <a key={`l${k++}`} href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>{val}</a>
      )
    } else {
      nodes.push(
        <a key={`p${k++}`} href={`tel:${val.replace(/[-\s]/g, '')}`} onClick={e => e.stopPropagation()} style={linkStyle}>{val}</a>
      )
    }
    last = start + val.length
  }
  if (last < src.length) nodes.push(<span key={`t${k++}`}>{src.slice(last)}</span>)
  return <>{nodes}</>
})

// รูปในแชท — แตะเพื่อดูเต็มจอ (สลิปโอนเงิน/ที่อยู่ ต้องอ่านออก)
// ถ้าโหลดไม่ขึ้น (เช่น URL สติ๊กเกอร์ LINE ไม่ทางการ) → fallback เป็นข้อความ
function MsgImage({ url, name, withText, onReady }: { url: string; name?: string; withText?: boolean; onReady?: () => void }) {
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [zoomed, setZoomed] = useState(false)   // ดูเต็มจอแล้วแตะรูปอีกครั้ง = ขยาย (อ่านเลขสลิปโอนเงิน)
  const isSticker = name === 'sticker'
  // รูปที่เพิ่งอัปจากเครื่องนี้ → ใช้ไฟล์ในเครื่องแสดงเลย ไม่ต้องโหลดกลับมาจากเน็ตอีกรอบ
  // (ถ้า blob ถูกคืนไปแล้ว รูปจะ error → สลับไปใช้ URL จริงให้อัตโนมัติ)
  const [src, setSrc] = useState<string>(() => localPreviews.get(url) || url)
  useEffect(() => { setSrc(localPreviews.get(url) || url); setErr(false); setLoaded(false) }, [url])

  // ปิดด้วยปุ่ม Esc
  useEffect(() => {
    if (!open) return
    setZoomed(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (err) {
    return <div style={{ fontSize: 13, marginTop: withText ? 6 : 0, fontWeight: 600 }}>{isSticker ? '😊 [สติกเกอร์]' : '🖼️ [รูปภาพ]'}</div>
  }
  return (
    <>
      <img
        src={src}
        // lazy + async: แชทที่มีสลิป/รูปเมนู 20-30 รูป เดิมโหลดพร้อมกันหมดตั้งแต่เปิดแชท
        // กินเน็ตมือถือหลาย MB และแย่งคิวกับการส่งข้อความของแอดมินเอง
        loading="lazy"
        decoding="async"
        onLoad={() => { setLoaded(true); onReady?.() }}
        onError={() => {
          if (src !== url) { localPreviews.delete(url); setSrc(url); return }   // blob หมดอายุ → ใช้ URL จริง
          setErr(true)
          onReady?.()
        }}
        onClick={() => { if (!isSticker) setOpen(true) }}
        style={{
          maxWidth: isSticker ? 130 : 240, width: '100%',
          // จองพื้นที่ไว้ก่อนรูปมาถึง — ไม่งั้นทุกฟองสูง 0 แล้วพอรูปโหลดเสร็จจะดันข้อความล่าสุดหลุดจอ
          // (minHeight เผื่อ iOS เก่าที่ยังไม่รองรับ aspect-ratio) · โหลดเสร็จแล้วปล่อยเป็นสัดส่วนจริง
          // ไม่ครอบตัดถาวร เพราะสลิปโอนเงินแนวตั้งต้องอ่านยอด/เลขอ้างอิงได้ครบ
          ...(loaded ? {} : {
            aspectRatio: isSticker ? '1 / 1' : '4 / 3',
            minHeight: isSticker ? 110 : 160,
            objectFit: 'cover' as const,
            background: SURFACE2,
          }),
          marginTop: withText ? 6 : 0, borderRadius: 10, display: 'block',
          cursor: isSticker ? 'default' : 'zoom-in',
        }}
        alt={isSticker ? 'สติกเกอร์' : 'รูปภาพในแชท (แตะเพื่อดูเต็มจอ)'}
      />
      {open && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="ดูรูปภาพเต็มจอ"
          style={{
            position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.93)',
            display: 'flex', padding: 12,
            // ทั้งหน้าถูกตั้งไว้ห้ามซูมด้วยสองนิ้ว (ไม่งั้นคีย์บอร์ดเด้งแล้ว layout เพี้ยน)
            // → ให้ "แตะรูปเพื่อขยาย" แทน แล้วลากดูได้ทั้งแนวตั้ง-แนวนอน
            overflow: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y',
          }}
        >
          <img
            src={src}
            alt="รูปภาพขนาดเต็ม"
            onClick={(e) => { e.stopPropagation(); setZoomed(z => !z) }}
            // margin: auto = จัดกลางแบบที่ยังลากไปดูขอบบน/ซ้ายได้ตอนรูปใหญ่เกินจอ
            style={zoomed
              ? { margin: 'auto', maxWidth: 'none', maxHeight: 'none', width: '250%', cursor: 'zoom-out' }
              : { margin: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }}
          />
          <div style={{
            position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)', left: '50%',
            transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            {zoomed ? 'แตะรูปอีกครั้งเพื่อย่อ · ลากเพื่อเลื่อนดู' : 'แตะรูปเพื่อขยาย'}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            aria-label="ปิด"
            style={{
              position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 14,
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.22)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={22} />
          </button>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)', left: '50%',
              transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 999,
              background: 'rgba(255,255,255,0.94)', color: '#1a1f3c', fontSize: 13, fontWeight: 800,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            เปิดรูปเต็มขนาด
          </a>
        </div>,
        document.body,
      )}
    </>
  )
}

// ลิงก์เปิดแชทนี้ใน Meta Business Suite (ใช้กับข้อความที่ Facebook ไม่ส่งเนื้อหามาให้)
function facebookInboxUrl(conv: any): string | undefined {
  const pageFbId = conv?.fb_page_id || conv?.connected_pages?.page_id
  if (!pageFbId || conv?.connected_pages?.channel === 'line') return undefined
  const qs = new URLSearchParams({ asset_id: String(pageFbId), thread_type: 'FB_MESSAGE' })
  if (conv?.fb_psid) qs.set('selected_item_id', String(conv.fb_psid))
  return `https://business.facebook.com/latest/inbox/all/?${qs.toString()}`
}

// ไฟล์แนบที่ไม่ใช่รูป — ข้อความเสียง / วิดีโอ / ไฟล์ / ลิงก์ที่ลูกค้าแชร์มา
// เดิมขึ้นเป็นข้อความ "📎 ไฟล์แนบ" เฉยๆ กดอะไรไม่ได้เลย ทั้งที่มีลิงก์อยู่แล้ว
// ลูกค้าสั่งของด้วยข้อความเสียง = แอดมินต้องไปเปิดแอป Facebook อ่านเองว่าสั่งอะไร
function FileAttachment({ a, onDark, withText, fbInboxUrl }: { a: any; onDark?: boolean; withText?: boolean; fbInboxUrl?: string }) {
  const [err, setErr] = useState(false)
  const url = String(a?.url || '')
  const safe = /^https?:\/\//i.test(url)   // กัน href แปลกๆ เช่น javascript:
  const name = a?.name || 'ไฟล์แนบ'
  const mime = String(a?.mime_type || '')
  // แถวเก่าในฐานข้อมูลเก็บแค่ type:'file' → เดาชนิดจาก mime/นามสกุล/ชื่อไฟล์ของ Facebook (audioclip.mp4)
  const kind = a?.kind
    || (/^audio\//i.test(mime) || /audioclip|\.(m4a|aac|mp3|ogg|wav|opus)(\?|$)/i.test(name + url) ? 'audio'
      : /^video\//i.test(mime) || /\.(mp4|mov|webm|3gp)(\?|$)/i.test(name + url) ? 'video'
      : 'file')
  const mt = withText ? 6 : 0
  const linkStyle: React.CSSProperties = {
    marginTop: mt, display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 34,
    fontSize: 12.5, fontWeight: 800, textDecoration: 'underline', wordBreak: 'break-all',
    color: onDark ? 'white' : PRIMARY,
  }
  // ลิงก์ของ Facebook หมดอายุได้ → บอกตรงๆ แล้วพาไปเปิดใน Facebook แทน
  if (!safe || err) {
    return fbInboxUrl
      ? <a href={fbInboxUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>📎 {name} — เปิดดูใน Facebook</a>
      : <div style={{ marginTop: mt, fontSize: 12 }}>📎 {name}</div>
  }
  // preload: ไม่ต้องโหลดล่วงหน้าทั้งไฟล์ — แอดมินกดฟังเองเมื่อต้องการ (ประหยัดเน็ตมือถือ)
  if (kind === 'audio') {
    return <audio controls preload="none" src={url} onError={() => setErr(true)} style={{ marginTop: mt, width: 240, maxWidth: '100%', display: 'block' }} />
  }
  if (kind === 'video') {
    return <video controls playsInline preload="metadata" src={url} onError={() => setErr(true)} style={{ marginTop: mt, maxWidth: 240, maxHeight: 320, borderRadius: 10, display: 'block' }} />
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>
      {kind === 'link' ? '🔗' : '📎'} {name}
    </a>
  )
}

const MessageBubble = memo(function MessageBubble({ message: m, customerName, customerPic, onRetry, onDiscard, canRetry, fbInboxUrl, onMediaReady }: { message: any; customerName?: string; customerPic?: string; onRetry?: (m: any) => void; onDiscard?: (m: any) => void; canRetry?: boolean; fbInboxUrl?: string; onMediaReady?: () => void }) {
  const out = m.direction === 'outbound'
  const failed = m.delivery_status === 'failed'
  const sending = m.delivery_status === 'sending'
  const isAuto = m.sent_by === 'page_auto' || m.sent_by === 'page_ai'

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: out ? 'row-reverse' : 'row', maxWidth: '85%', alignSelf: out ? 'flex-end' : 'flex-start' }}>
      {!out && <Avatar name={customerName} src={customerPic} size={28} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: out ? 'flex-end' : 'flex-start' }}>
        {isAuto && out && (
          <div style={{ fontSize: 9, color: PRIMARY, fontWeight: 800, marginBottom: 2 }}>
            🤖 AUTO
          </div>
        )}
        <div style={{
          padding: '9px 13px', borderRadius: 16,
          background: out
            ? (failed ? RED_L : 'linear-gradient(135deg, #1877f2 0%, #2e89ff 100%)')
            : 'white',
          color: out ? (failed ? RED : 'white') : TEXT,
          border: out ? 'none' : `1px solid ${BORDER}`,
          fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
          boxShadow: SHADOW_SM,
          opacity: sending ? 0.6 : 1,
          borderTopRightRadius: out ? 4 : 16,
          borderTopLeftRadius: out ? 16 : 4,
        }}>
          {m.message_text && <div style={{ whiteSpace: 'pre-wrap' }}><Linkify text={m.message_text} onDark={out && !failed} /></div>}
          {(() => {
            // dedupe ตาม url (FB ส่ง sticker ผ่านทั้ง field sticker + attachments url เดียวกัน → ซ้ำ)
            const seen = new Set<string>()
            const atts = ((m.attachments || []) as any[]).filter(a => {
              if (!a?.url) return false
              if (seen.has(a.url)) return false
              seen.add(a.url)
              return true
            })
            // สติ๊กเกอร์: FB ส่ง url 2 ค่า (sticker + attachment) → โชว์อันเดียว
            const stickerAtt = atts.find(a => a.name === 'sticker' && a.type === 'image' && a.url)
            // ถ้ามี image แล้ว → ไม่แสดง file/link อื่น
            const hasImage = atts.some(a => a.type === 'image' && a.url)
            const filtered = stickerAtt ? [stickerAtt] : (hasImage ? atts.filter(a => a.type === 'image' && a.url) : atts)
            return filtered.map((a, i) => (
              a.type === 'image' && a.url ? (
                <MsgImage key={i} url={a.url} name={a.name} withText={!!m.message_text} onReady={onMediaReady} />
              ) : a.url ? (
                <FileAttachment key={i} a={a} onDark={out && !failed} withText={!!m.message_text} fbInboxUrl={fbInboxUrl} />
              ) : null
            ))
          })()}
          {/* ไม่มีข้อความ + ไม่มีไฟล์ที่แสดงได้ = Facebook ไม่ส่งเนื้อหามาให้
              (Facebook เองขึ้นว่า "ไม่สามารถดูข้อความได้" — มักเป็นอีโมจิ/สติกเกอร์บางแบบ หรือข้อความพิเศษ) */}
          {!m.message_text && !(m.attachments || []).some((a: any) => a.url) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: out ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 12.5, fontStyle: 'italic', opacity: 0.9, lineHeight: 1.45 }}>
                ข้อความนี้ Facebook ไม่ส่งมาให้ระบบ<br />(อาจเป็นอีโมจิ สติกเกอร์ หรือข้อความพิเศษ)
              </span>
              {fbInboxUrl && (
                <a
                  href={fbInboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 32,
                    padding: '5px 11px', borderRadius: 9, fontSize: 12, fontWeight: 800,
                    textDecoration: 'none',
                    background: out ? 'rgba(255,255,255,0.18)' : PRIMARY_LIGHT,
                    color: out ? 'white' : PRIMARY,
                    border: out ? '1px solid rgba(255,255,255,0.45)' : `1px solid ${BORDER}`,
                  }}
                >
                  <ExternalLink size={12} /> เปิดดูใน Facebook
                </a>
              )}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: MUTED, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: out ? 'flex-end' : 'flex-start' }}>
          {sending && (m.status_note || '⏳ กำลังส่ง...')}
          {failed && (
            <>
              <span style={{ color: RED, fontWeight: 700 }}>❌ ส่งไม่สำเร็จ {m.error_message ? `(${m.error_message})` : ''}</span>
              {onRetry && canRetry !== false && (
                <button
                  onClick={() => onRetry(m)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', minHeight: 32, borderRadius: 8, border: `1.5px solid ${RED}`,
                    background: 'white', color: RED, fontSize: 11.5, fontWeight: 800,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={11} /> ส่งอีกครั้ง
                </button>
              )}
              {onDiscard && (
                <button
                  onClick={() => onDiscard(m)}
                  title="ลบข้อความนี้ (ลูกค้าไม่ได้รับ)"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', minHeight: 32, borderRadius: 8, border: `1.5px solid ${BORDER}`,
                    background: 'white', color: MUTED, fontSize: 11.5, fontWeight: 800,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <Trash2 size={11} /> ลบ
                </button>
              )}
            </>
          )}
          {!sending && !failed && timeAgo(m.created_at)}
        </div>
      </div>
    </div>
  )
})

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
      <div style={{ marginBottom: 10, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 4 }}>{title}</div>
      {hint && <div style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>{hint}</div>}
    </div>
  )
}

// ─── Settings Modal ───────────────────────────────────────────
const DEFAULT_SETTINGS = {
  ai_assist_enabled: true,
  ai_auto_categorize: true,
  ai_tone: 'friendly',
  auto_reply_enabled: false,
  auto_reply_message: 'ขอบคุณที่ติดต่อเรา ทีมงานจะรีบตอบกลับโดยเร็วที่สุดค่ะ 🙏',
  business_hours_enabled: false,
  off_hours_message: 'ขณะนี้นอกเวลาทำการ ทีมงานจะติดต่อกลับในเวลาทำการนะคะ ⏰',
  knowledge_base: '',
  business_hours: { mon:{start:'09:00',end:'18:00',off:false},tue:{start:'09:00',end:'18:00',off:false},wed:{start:'09:00',end:'18:00',off:false},thu:{start:'09:00',end:'18:00',off:false},fri:{start:'09:00',end:'18:00',off:false},sat:{start:'09:00',end:'18:00',off:true},sun:{start:'09:00',end:'18:00',off:true} },
}

function SettingsModal({ pages, isOwner, initialTab = 'general', onClose, onSaved }: { pages: any[]; isOwner: boolean; initialTab?: 'general'|'auto'|'kb'|'qr'; onClose: () => void; onSaved: () => void }) {
  const [selectedPage, setSelectedPage] = useState<string>(pages[0]?.id || '')
  const [settings, setSettings] = useState<any>({})
  const [quickReplies, setQuickReplies] = useState<any[]>([])
  const [newQR, setNewQR] = useState({ shortcut: '', title: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'general'|'auto'|'kb'|'qr'>(initialTab)
  const [origin, setOrigin] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  // โหลดค่าของเพจที่เลือกยังไม่เสร็จ/ไม่สำเร็จ → ห้ามกดบันทึก ไม่งั้นค่าของเพจเก่า (หรือค่าตั้งต้น)
  // จะถูกเขียนทับลงเพจใหม่ → ลูกค้าเพจ B ได้ข้อความตอบอัตโนมัติของเพจ A / ข้อมูลร้านที่พิมพ์ไว้หายเกลี้ยง
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadTick, setLoadTick] = useState(0)   // ปุ่ม "ลองใหม่อีกครั้ง" → สั่งโหลดซ้ำ
  const loadingSettings = loadState !== 'ok'    // กดบันทึกได้เฉพาะตอนที่โหลดค่าจริงมาแล้วเท่านั้น
  const [dirty, setDirty] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [qrErr, setQrErr] = useState<string | null>(null)
  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin) }, [])
  const inboxLink = `${origin}/dashboard/inbox`

  // แก้ค่าทีละช่อง + จำว่ามีของที่ยังไม่บันทึก
  const edit = (patch: any) => { setSettings((s: any) => ({ ...s, ...patch })); setDirty(true); setSaveMsg(null) }

  useEffect(() => {
    if (!selectedPage) return
    let cancelled = false
    setLoadState('loading'); setSettings({}); setDirty(false); setSaveMsg(null)
    fetch(`/api/inbox/settings?pageId=${encodeURIComponent(selectedPage)}`)
      .then(async r => {
        const d = await r.json().catch(() => ({} as any))
        if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`)
        // 502/504 ของ Vercel ตอบเป็น HTML → d ว่าง ไม่ใช่ array
        // เติมค่าตั้งต้นได้เฉพาะตอน server ตอบ "ไม่มีแถว" จริงๆ เท่านั้น (เพจนี้ยังไม่เคยตั้งค่า)
        if (!Array.isArray(d.settings)) throw new Error('bad response')
        return d
      })
      .then(d => {
        if (cancelled) return   // สลับเพจไปแล้ว — ผลเก่าห้ามขึ้นจอ (ไม่งั้นเห็นค่าเพจ B ทั้งที่เลือกเพจ C)
        setSettings(d.settings[0] || DEFAULT_SETTINGS)
        setLoadState('ok')
      })
      .catch(() => {
        // ไม่ใช่ 'ok' → ปุ่มบันทึกยังกดไม่ได้ ค่าตั้งต้นจะไม่ทับข้อมูลจริงของร้าน
        if (!cancelled) setLoadState('error')
      })
    return () => { cancelled = true }
  }, [selectedPage, loadTick])

  // ข้อความบันทึกใช้ร่วมกันทุกเพจ → โหลดครั้งเดียวพอ ไม่ต้องยิงใหม่ทุกครั้งที่สลับเพจ
  useEffect(() => {
    fetch('/api/inbox/quick-replies')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.replies)) setQuickReplies(d.replies) })
      .catch(() => {})
  }, [])

  async function save() {
    if (!selectedPage || saving || loadingSettings) return
    const pageId = selectedPage          // ผูกไว้ — สลับเพจระหว่างบันทึกจะได้ไม่เขียนผิดเพจ
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/inbox/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, pageId }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`)
      setDirty(false)
      setSaveMsg({ ok: true, text: 'บันทึกแล้ว ✓' })
      onSaved()
    } catch {
      setSaveMsg({ ok: false, text: 'บันทึกไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วกดบันทึกอีกครั้ง' })
    } finally {
      setSaving(false)
    }
  }

  async function addQR() {
    if (qrBusy) return
    if (!newQR.shortcut.trim() || !newQR.title.trim() || !newQR.message.trim()) { setQrErr('กรอกให้ครบทั้ง 3 ช่อง'); return }
    setQrBusy(true); setQrErr(null)
    try {
      const res = await fetch('/api/inbox/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQR),
      })
      const r = await res.json().catch(() => ({} as any))
      // เดิมเงียบสนิทเมื่อ server ตีกลับ (เช่นลูกทีมไม่มีสิทธิ์) แอดมินกรอกครบแล้วกดเพิ่มแล้วไม่มีอะไรเกิดขึ้น
      if (!res.ok || !r.success) { setQrErr(friendlyError(r.error) || 'เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง'); return }
      setQuickReplies(prev => [r.reply, ...prev])
      setNewQR({ shortcut: '', title: '', message: '' })
      onSaved()
    } catch {
      setQrErr('เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    } finally {
      setQrBusy(false)
    }
  }

  async function deleteQR(qr: any) {
    if (!window.confirm(`ลบข้อความบันทึก "${qr.title}" ใช่ไหม?\n\nลบแล้วเอากลับมาไม่ได้`)) return
    setQrErr(null)
    try {
      const res = await fetch(`/api/inbox/quick-replies?id=${encodeURIComponent(qr.id)}`, { method: 'DELETE' })
      const r = await res.json().catch(() => ({} as any))
      // เอาออกจากจอหลังรู้ผลจริงเท่านั้น — เดิมลบบนจอก่อน พอ server ปฏิเสธก็เด้งกลับมาตอนเปิดใหม่
      if (!res.ok || !r.success) { setQrErr(friendlyError(r.error) || 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง'); return }
      setQuickReplies(prev => prev.filter(q => q.id !== qr.id))
      onSaved()
    } catch {
      setQrErr('เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    }
  }

  const updateBH = (day: string, field: string, value: any) => {
    setSettings((s: any) => ({
      ...s,
      business_hours: { ...s.business_hours, [day]: { ...s.business_hours?.[day], [field]: value } }
    }))
    setDirty(true); setSaveMsg(null)
  }

  const days = [
    { k: 'mon', label: 'จันทร์' },{ k: 'tue', label: 'อังคาร' },{ k: 'wed', label: 'พุธ' },
    { k: 'thu', label: 'พฤหัสฯ' },{ k: 'fri', label: 'ศุกร์' },{ k: 'sat', label: 'เสาร์' },{ k: 'sun', label: 'อาทิตย์' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
      {/* maxHeight 100% = เท่ากับกรอบ overlay (หักช่องว่าง 12px รอบด้าน)
          บนมือถือกรอบนี้หดตามคีย์บอร์ดอยู่แล้ว → แก้ไขข้อมูลร้านแล้วยังเห็นปุ่ม "บันทึก" กับปุ่มปิด
          (เดิม 92dvh: iOS ต่ำกว่า 15.4 ไม่รู้จัก dvh เลยไม่จำกัดความสูง และ dvh ก็ไม่หดตามคีย์บอร์ด) */}
      <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, borderRadius: 18, width: '100%', maxWidth: 720, maxHeight: '100%', overflow: 'hidden', boxShadow: SHADOW_LG, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1.5px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>⚙️ ตั้งค่ากล่องข้อความ</div>
          <button onClick={onClose} style={{ ...btnGhost, padding: 8 }}><X size={16} /></button>
        </div>

        {/* Page selector */}
        {pages.length > 0 && (
          <div style={{ padding: '12px 22px', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 5 }}>เลือกเพจที่จะตั้งค่า</div>
            <select
              value={selectedPage}
              disabled={saving}
              // เตือนก่อนทิ้งของที่ยังไม่บันทึก — เดิมสลับเพจแล้วที่แก้ไว้หายเงียบๆ
              onChange={e => {
                if (dirty && !window.confirm('ยังไม่ได้บันทึกการตั้งค่าของเพจนี้ เปลี่ยนเพจเลยไหม?')) return
                setSelectedPage(e.target.value)
              }}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              {pages.map(p => <option key={p.id} value={p.id}>📄 {p.page_name}</option>)}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, padding: '0 22px' }}>
          {/* ชื่อแท็บต้องตรงกับปุ่มในแถบพิมพ์ ("ข้อความบันทึก") ไม่งั้นแอดมินหาไม่เจอ */}
          {([['general','🤖 AI'],['auto','💬 ตอบอัตโนมัติ'],['kb','📚 ความรู้'],['qr','⚡ ข้อความบันทึก']] as const).map(([k,l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: '12px 14px', border: 'none', background: 'transparent',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                color: tab === k ? PRIMARY : MUTED,
                borderBottom: tab === k ? `2px solid ${PRIMARY}` : '2px solid transparent',
              }}
            >{l}</button>
          ))}
        </div>

        <div style={{ padding: 22, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Toggle label="✨ เปิดปุ่ม 'AI ช่วยตอบ'" checked={settings.ai_assist_enabled} onChange={v => edit({ ai_assist_enabled: v })} />
              <Toggle label="🏷️ ให้ AI จัดหมวดหมู่อัตโนมัติ" checked={settings.ai_auto_categorize} onChange={v => edit({ ai_auto_categorize: v })} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>🎭 โทนการตอบ</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['friendly','😊 เป็นกันเอง'],['professional','💼 ทางการ'],['casual','😎 สบายๆ']].map(([v,l]) => (
                    <button key={v} onClick={() => edit({ ai_tone: v })} style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10, border: settings.ai_tone === v ? `2px solid ${PRIMARY}` : `1.5px solid ${BORDER}`,
                      background: settings.ai_tone === v ? PRIMARY_LIGHT : 'white', cursor: 'pointer',
                      fontSize: 12, fontWeight: 800, color: settings.ai_tone === v ? PRIMARY : TEXT, fontFamily: 'inherit',
                    }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'auto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Toggle label="💬 เปิดตอบกลับอัตโนมัติ (เมื่อมีข้อความใหม่)" checked={settings.auto_reply_enabled} onChange={v => edit({ auto_reply_enabled: v })} />
              {settings.auto_reply_enabled && (
                <textarea value={settings.auto_reply_message || ''} onChange={e => edit({ auto_reply_message: e.target.value })} rows={3} placeholder="ข้อความตอบกลับอัตโนมัติ" style={{ width: '100%', padding: 10, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              )}

              <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />

              <Toggle label="⏰ ตั้งเวลาทำการ (นอกเวลาส่งข้อความอัตโนมัติ)" checked={settings.business_hours_enabled} onChange={v => edit({ business_hours_enabled: v })} />
              {settings.business_hours_enabled && (
                <>
                  <textarea value={settings.off_hours_message || ''} onChange={e => edit({ off_hours_message: e.target.value })} rows={2} placeholder="ข้อความนอกเวลาทำการ" style={{ width: '100%', padding: 10, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {days.map(d => {
                      const bh = settings.business_hours?.[d.k] || { start: '09:00', end: '18:00', off: false }
                      return (
                        <div key={d.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: SURFACE2, borderRadius: 8 }}>
                          <div style={{ width: 60, fontSize: 12, fontWeight: 700 }}>{d.label}</div>
                          <input type="checkbox" checked={!bh.off} onChange={e => updateBH(d.k, 'off', !e.target.checked)} />
                          {!bh.off && (
                            <>
                              <input type="time" value={bh.start} onChange={e => updateBH(d.k, 'start', e.target.value)} style={{ padding: 4, borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                              <span>–</span>
                              <input type="time" value={bh.end} onChange={e => updateBH(d.k, 'end', e.target.value)} style={{ padding: 4, borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                            </>
                          )}
                          {bh.off && <span style={{ fontSize: 11, color: MUTED }}>หยุด</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'kb' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>📚 ข้อมูลร้าน/สินค้า/FAQ</div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
                ใส่ข้อมูลที่ AI ใช้อ้างอิงตอนตอบลูกค้า เช่น ราคาสินค้า, เวลาเปิด-ปิด, นโยบายการคืนสินค้า ฯลฯ
              </div>
              <textarea
                value={settings.knowledge_base || ''}
                onChange={e => edit({ knowledge_base: e.target.value })}
                rows={14}
                placeholder={'ตัวอย่าง:\n- เปิดทำการ จ-ศ 9:00-18:00\n- ส่งฟรี EMS เมื่อสั่งครบ 1,000 บาท\n- สินค้ามีรับประกัน 1 ปี\n- คืนสินค้าได้ภายใน 7 วัน...'}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {tab === 'qr' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>⚡ ข้อความบันทึก (ใช้ได้ทุกเพจ)</div>

              {/* เพิ่ม/ลบได้เฉพาะเจ้าของเพจ — API ตีกลับ 403 ให้ลูกทีม ถ้าโชว์ฟอร์มไว้จะกดแล้วงงว่าไม่มีอะไรเกิดขึ้น */}
              {isOwner ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: SURFACE2, borderRadius: 12, marginBottom: 14 }}>
                  <input value={newQR.shortcut} onChange={e => setNewQR({...newQR, shortcut: e.target.value})} placeholder="คำสั่ง เช่น /ราคา" style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 12 }} />
                  <input value={newQR.title} onChange={e => setNewQR({...newQR, title: e.target.value})} placeholder="ชื่อแสดง เช่น ตอบราคา" style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 12 }} />
                  <textarea value={newQR.message} onChange={e => setNewQR({...newQR, message: e.target.value})} placeholder="ข้อความเต็ม" rows={3} style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                  <button onClick={addQR} disabled={qrBusy} style={{ ...btnPrimary, padding: '8px 12px', fontSize: 12, opacity: qrBusy ? 0.6 : 1, cursor: qrBusy ? 'wait' : 'pointer' }}>
                    <Plus size={12} style={{ display: 'inline', marginRight: 4 }} />{qrBusy ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
                  </button>
                </div>
              ) : (
                <div style={{ padding: 12, background: SURFACE2, borderRadius: 12, marginBottom: 14, fontSize: 12, color: MUTED, fontWeight: 700, lineHeight: 1.6 }}>
                  เฉพาะเจ้าของเพจเท่านั้นที่เพิ่ม/ลบข้อความบันทึกได้ — คุณใช้ข้อความด้านล่างตอบลูกค้าได้ตามปกติ
                </div>
              )}

              {qrErr && (
                <div role="alert" style={{ marginBottom: 12, padding: '9px 11px', background: RED_L, border: `1px solid ${RED}44`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: RED, lineHeight: 1.5 }}>
                  {qrErr}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quickReplies.map(qr => (
                  <div key={qr.id} style={{ padding: 10, background: 'white', border: `1px solid ${BORDER}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, marginBottom: 2 }}>⚡ {qr.title} <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{qr.shortcut}</span></div>
                      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{qr.message}</div>
                    </div>
                    {/* can_delete จาก API = ข้อความที่ตัวเองสร้าง (ของ owner เพจอื่นลบไม่ได้) */}
                    {isOwner && qr.can_delete !== false && (
                      // ปุ่มเดิมเล็ก 24px นิ้วโป้งบนมือถือกดโดนโดยไม่ตั้งใจ → ขยายเป็น 40px + ถามยืนยันก่อนลบ
                      <button
                        onClick={() => deleteQR(qr)}
                        aria-label={`ลบข้อความบันทึก ${qr.title}`}
                        style={{ ...btnGhost, minWidth: 40, minHeight: 40, padding: 0, color: RED, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {quickReplies.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: MUTED, fontSize: 12 }}>ยังไม่มีข้อความบันทึก</div>}
              </div>
            </div>
          )}
        </div>

        {/* ── ลิงก์ตอบแชทสำหรับแอดมิน ── */}
        <div style={{ padding: '14px 22px', borderTop: `1.5px solid ${BORDER}`, background: '#f0f6ff' }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: TEXT, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={14} color={PRIMARY} /> ลิงก์ตอบแชทสำหรับแอดมิน
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 9, lineHeight: 1.6 }}>
            ส่งลิงก์นี้ให้แอดมิน → เปิดแล้ว login (อีเมล+รหัสที่คุณตั้งให้จากหน้า "จัดการทีม") เข้าหน้าตอบแชทได้ทันที
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              readOnly
              value={inboxLink}
              onFocus={e => e.target.select()}
              style={{ flex: 1, padding: '10px 12px', fontSize: 12, border: `1.5px solid ${BORDER}`, borderRadius: 10, fontFamily: 'monospace', background: SURFACE, boxSizing: 'border-box', minWidth: 0 }}
            />
            <button
              className="fbtap"
              onClick={async () => { try { await navigator.clipboard.writeText(inboxLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500) } catch {} }}
              style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, background: linkCopied ? GREEN_L : 'linear-gradient(135deg, #1877f2, #2e89ff)', color: linkCopied ? GREEN : 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {linkCopied ? <><Check size={13} /> คัดลอกแล้ว</> : <><Copy size={13} /> คัดลอกลิงก์</>}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1.5px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* โหลดค่าของเพจนี้ไม่สำเร็จ → ปุ่มบันทึกยังปิดอยู่ (กดได้ = ทับข้อมูลร้านด้วยค่าว่าง) ต้องมีปุ่มให้ลองใหม่ */}
          {tab !== 'qr' && loadState === 'error' && (
            <div role="alert" style={{ flex: 1, minWidth: 140, fontSize: 12, fontWeight: 800, lineHeight: 1.5, color: RED, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              โหลดการตั้งค่าไม่สำเร็จ — ลองใหม่อีกครั้ง
              <button
                onClick={() => setLoadTick(t => t + 1)}
                style={{ padding: '7px 14px', minHeight: 36, fontSize: 12, fontWeight: 800, borderRadius: 9, border: `1.5px solid ${BORDER}`, background: SURFACE2, color: PRIMARY, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ลองใหม่
              </button>
            </div>
          )}
          {/* บอกผลการบันทึกตรงนี้ — เดิมสปินเนอร์หยุดแล้วเงียบ แอดมินไม่รู้ว่าบันทึกติดไหม */}
          {tab !== 'qr' && loadState !== 'error' && saveMsg && (
            <div role="alert" style={{ flex: 1, minWidth: 140, fontSize: 12, fontWeight: 800, lineHeight: 1.5, color: saveMsg.ok ? GREEN : RED }}>
              {saveMsg.text}
            </div>
          )}
          <button onClick={onClose} style={{ ...btnGhost, padding: '9px 16px', fontSize: 12, fontWeight: 700 }}>ยกเลิก</button>
          {tab !== 'qr' && (
            <button
              onClick={save}
              disabled={saving || loadingSettings}
              style={{ ...btnPrimary, padding: '9px 18px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: (saving || loadingSettings) ? 0.55 : 1, cursor: (saving || loadingSettings) ? 'not-allowed' : 'pointer' }}
            >
              {(saving || loadState === 'loading') ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />}
              {loadState === 'loading' ? 'กำลังโหลด...' : 'บันทึก'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  // ปุ่มจริง + role="switch" → กดด้วยคีย์บอร์ดได้ และ screen reader บอกว่าเปิด/ปิดอยู่
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{label}</div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          width: 46, height: 28, background: checked ? PRIMARY : '#94a3b8', borderRadius: 999,
          position: 'relative', transition: 'all 0.2s', flexShrink: 0,
          border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        }}
      >
        <span style={{
          display: 'block', width: 22, height: 22, background: 'white', borderRadius: '50%',
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          transition: 'all 0.2s', boxShadow: SHADOW_SM,
        }} />
      </button>
    </div>
  )
}
