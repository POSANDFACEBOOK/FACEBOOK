'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Send, Sparkles, RefreshCw, Search, Star, Archive, CheckCircle2,
  MessageSquare, Inbox, Settings, Zap, X, ChevronLeft, MoreVertical, Bot,
  AlertCircle, BarChart3, Bell, Plus, LogOut, ListFilter, MailOpen, MailQuestion,
  Pencil, Check, Copy, Share2, ImagePlus, Menu,
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
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
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
  return e
}

export default function InboxPage() {
  const { data: session } = useSession()

  // Data
  const [isOwner, setIsOwner] = useState<boolean | null>(null)  // null = ยังไม่รู้ → ซ่อนเมนู owner ไว้ก่อน
  const [pages, setPages] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [quickReplies, setQuickReplies] = useState<any[]>([])

  // Filters
  const [channelFilter, setChannelFilter] = useState<'facebook' | 'line' | null>(null)
  const [pageFilter, setPageFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all'|'unread'|'needs_reply'|'starred'|'unresolved'|'archived'>('all')
  const [search, setSearch] = useState('')

  // Rename page nickname
  const [renamePage, setRenamePage] = useState<any | null>(null)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [savingNickname, setSavingNickname] = useState(false)

  // UI state
  const [loadingList, setLoadingList] = useState(true)
  const [pageSyncing, setPageSyncing] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [draft, setDraft] = useState('')
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
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null)
  // เก็บ "ลายเซ็นข้อความที่กดส่งซ้ำไปแล้ว" — ใช้ ref ไม่ให้หายตอนสลับแชทกลับมา
  // (ถ้าเก็บใน state แล้วรีเซ็ต ผู้ใช้จะกดส่งซ้ำได้อีก ลูกค้าได้ข้อความเดิมหลายรอบ)
  const retriedRef = useRef<Set<string>>(new Set())
  // id ของแถวใน DB ที่ถูกกดส่งซ้ำไปแล้ว → ซ่อนไม่ให้ฟองแดงเดิมเด้งกลับมาตอน poll
  const retriedServerIdsRef = useRef<Set<string>>(new Set())
  const [retriedTick, setRetriedTick] = useState(0)  // บังคับ re-render หลัง mark
  // ค่าตั้งค่าต่อเพจ (ตอนนี้ใช้เช็คว่าเจ้าของปิดปุ่ม "AI ช่วยตอบ" ไว้ไหม)
  const [aiEnabledByPage, setAiEnabledByPage] = useState<Record<string, boolean>>({})
  const [settingsVer, setSettingsVer] = useState(0)  // ++ เมื่อปิดหน้าตั้งค่า → ดึงค่า ai_assist_enabled ใหม่
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<any>(null)
  const lastFbSyncRef = useRef(Date.now())  // เวลาที่ sync FB ล่าสุด (ไม่รีเซ็ตตอนสลับแชท)
  const openReqRef = useRef<string>('')  // กัน race ตอนเปิดหลายแชทเร็วๆ
  const draftRef = useRef<HTMLTextAreaElement>(null)
  // เก็บไฟล์รูปที่อัปโหลดไม่สำเร็จไว้ เพื่อให้ "ส่งอีกครั้ง" อัปโหลดใหม่ได้จริง
  // (ถ้าส่ง blob: URL ไป server จะตีกลับ 400 ทุกครั้ง)
  const pendingFilesRef = useRef<Map<string, { file: File; url: string }>>(new Map())
  // ล้างไฟล์+blob ที่ค้าง (เปลี่ยนแชท/ออกจากหน้า) — ไม่งั้นสะสมกินหน่วยความจำ
  const clearPendingFiles = () => {
    pendingFilesRef.current.forEach(v => { try { URL.revokeObjectURL(v.url) } catch {} })
    pendingFilesRef.current.clear()
  }
  useEffect(() => () => clearPendingFiles(), [])

  // คอม = Enter ส่ง / มือถือ = Enter ขึ้นบรรทัดใหม่
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px) and (pointer: fine)')
    const on = () => setIsDesktop(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // ช่องพิมพ์ขยายตามจำนวนบรรทัด (สูงสุด 140px) — เดิม rows=1 ตายตัว พิมพ์ยาวแล้วอ่านไม่ออก
  useEffect(() => {
    const el = draftRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [draft])

  // ── Load conversations ──
  // silent = โหลดเบื้องหลัง (poll/realtime) → ไม่โชว์สปินเนอร์ กันจอกระพริบทุก 7 วิ
  async function loadConversations(opts?: { silent?: boolean }) {
    const silent = opts?.silent
    if (!silent) setLoadingList(true)
    const params = new URLSearchParams()
    if (pageFilter) params.set('pageId', pageFilter)
    if (statusFilter !== 'all') params.set('filter', statusFilter)
    if (debouncedSearch) params.set('q', debouncedSearch)
    params.set('limit', String(listLimitRef.current))

    try {
      const r = await fetch(`/api/inbox/conversations?${params.toString()}`)
      if (r.status === 401 || r.status === 403) { setSessionExpired(true); return }
      const res = await r.json()
      if (res.error) { if (!silent) setErrorBanner(friendlyError(res.error)); return }
      setSessionExpired(false)
      setConversations(res.conversations || [])
      registerPageOrder(res.pages || [])  // กำหนดสีประจำเพจ (ไม่ซ้ำ) ก่อน render
      setPages(res.pages || [])
      setTotalUnread(res.totalUnread || 0)
      setTotalNeedsReply(res.totalNeedsReply || 0)
      setUnreadByPage(res.unreadByPage || {})
      setNeedsReplyByPage(res.needsReplyByPage || {})
    } catch {
      // เน็ตหลุด — ไม่ล้างของเดิมบนจอ รอบถัดไปค่อยลองใหม่
      if (!silent) setErrorBanner('เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    } finally {
      if (!silent) setLoadingList(false)
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
  function mergeServerMessages(serverMsgs: any[]) {
    setMessages(prev => {
      const isTemp = (m: any) => typeof m.id === 'string' && m.id.startsWith('temp-')
      const hidden = retriedServerIdsRef.current           // แถวที่กด "ส่งอีกครั้ง" ไปแล้ว → ไม่เอากลับมา
      const server = serverMsgs.filter(s => !hidden.has(String(s.id)))
      const temps = prev.filter(isTemp)

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
      // → ห้ามทิ้ง ไม่งั้นข้อความที่เพิ่งส่งสำเร็จหายไปนานถึง 7 วิ
      const serverIds = new Set(server.map(s => String(s.id)))
      const missing = prev.filter(m => !isTemp(m) && !serverIds.has(String(m.id)) && !hidden.has(String(m.id)))

      const seen = new Set<string>()
      const real = [...server, ...missing]
        .filter(m => { const k = String(m.id); if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      // ฟองที่ยังส่งไม่จบต่อท้ายเสมอ (เพิ่งกดส่ง = ใหม่สุด) — ไม่ต้องพึ่งนาฬิกาเครื่อง
      return [...real, ...keep]
    })
  }

  async function loadMessages(conv: any) {
    const convId = conv?.id
    if (!convId) return
    // เปิดหน้าแชททันที (optimistic) จากข้อมูลใน list → จอสลับไว ไม่ต้องรอ API
    openReqRef.current = convId
    setActiveConv(conv)
    setMessages([])
    setDraft('')
    setAiSuggestions([])
    setErrorBanner(null)
    setShowChatMenu(false)
    clearPendingFiles()   // ไฟล์รูปที่ค้างจากแชทก่อนหน้า ใช้กับแชทนี้ไม่ได้อยู่แล้ว
    setLoadingMessages(true)
    // optimistic: เคลียร์ทั้ง badge ของ row + ตัวเลขรวม (page tile / ชิป "ใหม่" / sidebar) ทันที
    const hadUnread = (conv.unread_count || 0) > 0
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    if (hadUnread && conv.page_id) {
      setUnreadByPage(prev => ({ ...prev, [conv.page_id]: Math.max(0, (prev[conv.page_id] || 0) - 1) }))
      setTotalUnread(t => Math.max(0, t - 1))
    }
    try {
      const r = await fetch(`/api/inbox/conversations/${convId}`)
      if (openReqRef.current !== convId) return  // เปิดแชทอื่นไปแล้ว — ทิ้งผลเก่า
      if (r.status === 401 || r.status === 403) { setSessionExpired(true); return }
      if (!r.ok) {
        // ไม่งั้นจะขึ้น "ยังไม่มีข้อความในบทสนทนานี้" เงียบๆ เหมือนประวัติแชทหายไป
        setErrorBanner('โหลดข้อความไม่สำเร็จ — ลองกดเข้าแชทใหม่อีกครั้ง')
        return
      }
      const res = await r.json()
      if (openReqRef.current !== convId) return
      if (res.conversation) {
        setActiveConv(res.conversation)
        setMessages(res.messages || [])
      }
    } catch {
      if (openReqRef.current === convId) setErrorBanner('โหลดข้อความไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      if (openReqRef.current === convId) setLoadingMessages(false)
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function loadQuickReplies() {
    const r = await fetch('/api/inbox/quick-replies').then(r => r.json())
    setQuickReplies(r.replies || [])
  }

  function openRename(p: any) {
    setRenamePage(p)
    setNicknameDraft(p.nickname || '')
  }

  async function saveNickname() {
    if (!renamePage || savingNickname) return
    setSavingNickname(true)
    try {
      const res = await fetch('/api/inbox/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: renamePage.id, nickname: nicknameDraft.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert('บันทึกไม่สำเร็จ: ' + (data.error || 'unknown'))
        return
      }
      setRenamePage(null)
      await loadConversations()
    } finally {
      setSavingNickname(false)
    }
  }

  // ── Background sync (silent — no spinner) ──
  async function backgroundSync(pageId?: string) {
    try {
      const res = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageId ? { pageId } : {}),
      })
      const data = await res.json()
      // หลัง sync เสร็จ → trigger repair ถ้ามี empty messages ค้างอยู่
      // (ทำเงียบๆ ไม่รอผล ไม่ block UI)
      fetch('/api/inbox/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageId ? { pageId } : {}),
      }).then(() => loadConversations()).catch(() => {})
      // ถ้า sync มี error → แสดงให้ user เห็น (ไม่งั้น user งง ว่าทำไมแชทไม่มี)
      if (data?.summary?.length) {
        const errs: string[] = []
        for (const p of data.summary) {
          if (p.errors?.length) {
            errs.push(`${p.page_name}: ${p.errors.join('; ')}`)
          }
        }
        if (errs.length) setErrorBanner(`Sync error → ${errs.join(' | ')}`)
      }
    } catch {
      // ignore — next interval will retry
    }
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
        const h = Math.max(Math.round(raw), 240)  // clamp กันค่า transient เล็กผิดปกติ
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

  // ── Initial load + auto-sync on mount (with throttle) ──
  useEffect(() => {
    // รู้ว่าเป็น owner หรือ agent → ซ่อนเมนู "ยิงแอดเพจ" สำหรับ agent
    fetch('/api/me').then(r => r.json()).then(d => setIsOwner(!!d?.role?.isOwner)).catch(() => setIsOwner(false))
    // ไม่เรียก loadConversations ที่นี่ — effect [pageFilter, statusFilter, debouncedSearch]
    // ยิงให้อยู่แล้วตอน mount (เดิมยิงซ้ำ 2 ครั้งพร้อมกัน ทำให้ลิสต์กระตุก/สีเพจเปลี่ยนเอง)
    loadQuickReplies()
    // Auto-sync ตอนเปิดแอพ (กัน rate limit ด้วย localStorage throttle 1 นาที)
    try {
      const last = Number(localStorage.getItem('inbox_last_mount_sync') || 0)
      if (Date.now() - last > 60 * 1000) {
        localStorage.setItem('inbox_last_mount_sync', String(Date.now()))
        setSyncing(true)
        backgroundSync()
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
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Fetch ก่อน เช็ค response ตรงๆ (ไม่พึ่ง state ที่ยังไม่ re-render)
      const params = new URLSearchParams()
      if (pageFilter) params.set('pageId', pageFilter)
      if (statusFilter !== 'all') params.set('filter', statusFilter)
      if (debouncedSearch) params.set('q', debouncedSearch)
      params.set('limit', String(listLimit))
      setLoadingList(true)
      let res: any = {}
      try {
        const r = await fetch(`/api/inbox/conversations?${params.toString()}`)
        if (r.status === 401 || r.status === 403) { if (!cancelled) { setSessionExpired(true); setLoadingList(false) } ; return }
        // 500 ฯลฯ — ห้ามล้างลิสต์เป็นค่าว่าง ไม่งั้นจอขึ้น "ยังไม่มีเพจที่เชื่อมต่อ" ให้เข้าใจผิด
        if (!r.ok) {
          if (!cancelled) { setErrorBanner('โหลดรายการแชทไม่สำเร็จ — ลองใหม่อีกครั้ง'); setLoadingList(false) }
          return
        }
        res = await r.json()
        if (res.error) {
          if (!cancelled) { setErrorBanner(friendlyError(res.error)); setLoadingList(false) }
          return
        }
      } catch {
        if (!cancelled) { setErrorBanner('เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); setLoadingList(false) }
        return
      }
      if (cancelled) return
      setConversations(res.conversations || [])
      registerPageOrder(res.pages || [])
      setPages(res.pages || [])
      setTotalUnread(res.totalUnread || 0)
      setTotalNeedsReply(res.totalNeedsReply || 0)
      setUnreadByPage(res.unreadByPage || {})
      setNeedsReplyByPage(res.needsReplyByPage || {})
      setLoadingList(false)

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

  // เปลี่ยนเพจ/ตัวกรอง/คำค้น → กลับไปโหลด 50 รายการแรกใหม่
  useEffect(() => { setListLimit(50) }, [pageFilter, statusFilter, debouncedSearch])

  // Poll DB ทุก 7 วิ (poll DB ของเราเอง ไม่กิน rate limit FB) → จออัปเดตเองไม่ต้องรีเฟรช
  // Background sync FB ทุก ~5 นาที (กัน webhook ตก)
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      loadConversations({ silent: true })
      if (activeConv) {
        const convId = activeConv.id
        fetch(`/api/inbox/conversations/${convId}`)
          .then(r => r.json())
          .then(res => {
            // ต้องยังเปิดแชทเดิมอยู่ ไม่งั้นข้อความลูกค้าคนอื่นจะโผล่ผิดแชท
            if (openReqRef.current !== convId) return
            if (res.messages) mergeServerMessages(res.messages)
          })
          .catch(() => {})
      }
      // sync สำรอง (กัน webhook ตก) — ใช้เวลาจริงจาก ref ไม่ใช่ tick ของ interval
      // เพราะ interval ถูกสร้างใหม่ทุกครั้งที่สลับแชท/เปลี่ยนฟิลเตอร์ → tick รีเซ็ต ไม่เคยถึงรอบ
      if (Date.now() - lastFbSyncRef.current > 5 * 60 * 1000) {
        lastFbSyncRef.current = Date.now()
        backgroundSync()
      }
    }, 7000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeConv?.id, pageFilter, statusFilter, debouncedSearch])

  // ── Realtime: เด้งทันทีเมื่อมีข้อความ/แชทใหม่ (Supabase Realtime) ──
  // ถ้ายังไม่ได้ตั้ง SUPABASE_JWT_SECRET → endpoint คืน token=null → ใช้ polling 30 วิ แทน
  const rtTimerRef = useRef<any>(null)
  const rtRefreshRef = useRef<() => void>(() => {})
  rtRefreshRef.current = () => {
    if (rtTimerRef.current) return  // coalesce burst ของข้อความ
    rtTimerRef.current = setTimeout(() => {
      rtTimerRef.current = null
      loadConversations({ silent: true })
      const ac = activeConv
      if (ac) {
        const convId = ac.id
        fetch(`/api/inbox/conversations/${convId}`)
          .then(r => r.json())
          .then(res => {
            if (openReqRef.current !== convId) return  // สลับแชทไปแล้ว — ทิ้งผลเก่า
            if (res.messages) mergeServerMessages(res.messages)
          })
          .catch(() => {})
      }
    }, 250)
  }
  useEffect(() => {
    let channel: any = null, client: any = null, cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/realtime/token').then(r => r.json())
        if (cancelled || !res?.token) return
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!url || !anon) return
        const { createClient } = await import('@supabase/supabase-js')
        client = createClient(url, anon, { realtime: { params: { eventsPerSecond: 10 } } })
        await client.realtime.setAuth(res.token)
        channel = client.channel('inbox-rt')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox_messages' }, () => rtRefreshRef.current())
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => rtRefreshRef.current())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => rtRefreshRef.current())
          .subscribe()
      } catch {}
    })()
    return () => { cancelled = true; try { channel?.unsubscribe(); client?.removeAllChannels?.() } catch {} }
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
      if (renamePage) { setRenamePage(null); return }
      if (showSavedReplies) { setShowSavedReplies(false); return }
      if (showSettings) { setShowSettings(false); return }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showMobileMenu, showChatMenu, renamePage, showSavedReplies, showSettings])

  // toast หายเองใน 5 วิ
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // รีเฟรชทันทีเมื่อกลับมาที่แอป/แท็บ (สลับแอปแล้วกลับมา → เห็นล่าสุดเลย ไม่ต้องรอ poll)
  useEffect(() => {
    const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') rtRefreshRef.current() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible) }
  }, [])

  // ── Send message ──
  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? draft).trim()
    if (!activeConv || !text || sending) return
    const convId = activeConv.id          // ผูกกับแชทนี้ — สลับแชทระหว่างส่งจะไม่เด้งผิดที่
    const isThis = () => openReqRef.current === convId
    setSending(true)
    setErrorBanner(null)
    if (!overrideText) setDraft('')

    // optimistic
    const optimistic = {
      id: `temp-${Date.now()}`,
      conversation_id: convId,
      direction: 'outbound',
      message_text: text,
      sent_by: 'page_user',
      delivery_status: 'sending',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        const msg = friendlyError(data.error) || 'ส่งไม่สำเร็จ'
        if (isThis()) {
          setErrorBanner(msg)
          setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, delivery_status: 'failed', error_message: msg } : m))
          if (data.blockCode) setActiveConv((c: any) => c ? { ...c, send_block_code: data.blockCode } : c)
        }
        loadConversations({ silent: true })
      } else {
        // data.message อาจเป็น null ได้ (insert สำเร็จแต่ select กลับไม่ได้) → ห้ามยัด null ลง array
        if (isThis()) setMessages(prev => prev.map(m => m.id === optimistic.id
          ? (data.message || { ...m, delivery_status: 'sent' }) : m))
        loadConversations({ silent: true })
      }
    } catch (e: any) {
      // เน็ตหลุด — server ไม่มีแถวนี้ → ต้องคง local ไว้ให้กด "ส่งอีกครั้ง" ได้ (local_only)
      const msg = friendlyError(e?.message)
      if (isThis()) {
        setErrorBanner(msg)
        setMessages(prev => prev.map(m => m.id === optimistic.id
          ? { ...m, delivery_status: 'failed', error_message: msg, local_only: true } : m))
      }
    }
    setSending(false)
  }

  // จำว่า "ฟองนี้" ถูกกดส่งซ้ำแล้ว — ผูกกับ id ของฟอง ไม่ใช่เนื้อหา
  // (ถ้าผูกเนื้อหา ข้อความสั้นที่ใช้ซ้ำทั้งวันอย่าง "ค่ะ" จะไม่มีปุ่มให้กดอีกเลยตลอดเซสชัน)
  function retryKeyOf(convId: string, m: any) { return `${convId}::${String(m?.id ?? '')}` }
  function markRetried(convId: string, m: any) {
    retriedRef.current.add(retryKeyOf(convId, m))
    setRetriedTick(t => t + 1)
  }

  // แทรกข้อความสำเร็จรูป/คำแนะนำ AI — ต่อท้ายของที่พิมพ์ค้างไว้ ไม่ทับทิ้ง
  function insertIntoDraft(text: string) {
    setDraft(prev => {
      const cur = prev.trim()
      return cur ? `${cur}\n${text}` : text
    })
    setTimeout(() => { const el = draftRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, 30)
  }

  // ส่งอีกครั้งจากฟองข้อความที่ส่งไม่สำเร็จ (ทั้งข้อความและรูป)
  async function retryMessage(m: any) {
    if (sending || uploading || !activeConv) return
    const convId = activeConv.id
    const id = String(m.id)
    const imgUrl = (m.attachments || []).find((a: any) => a?.type === 'image' && a.url)?.url

    // รูปที่อัปโหลดไม่สำเร็จ (ยังเป็น blob:) → ต้องอัปโหลดใหม่จากไฟล์เดิม ส่ง URL ไปตรงๆ ไม่ได้
    if (imgUrl && String(imgUrl).startsWith('blob:')) {
      const entry = pendingFilesRef.current.get(id)
      if (!entry) { setErrorBanner('ส่งรูปซ้ำไม่ได้ — กรุณาเลือกรูปใหม่อีกครั้ง'); return }
      markRetried(convId, m)
      setMessages(prev => prev.filter(x => x.id !== m.id))
      pendingFilesRef.current.delete(id)
      try { URL.revokeObjectURL(entry.url) } catch {}
      await handleSendImage(entry.file)
      return
    }

    markRetried(convId, m)
    // แถวที่มาจาก DB จะถูกดึงกลับมาตอน poll → จำ id ไว้เพื่อซ่อนถาวร
    if (!String(m.id).startsWith('temp-')) retriedServerIdsRef.current.add(String(m.id))
    setMessages(prev => prev.filter(x => x.id !== m.id))
    if (imgUrl) await sendImageUrl(imgUrl)
    else if (m.message_text) await handleSend(m.message_text)
  }

  // ── ส่งรูปที่อัปโหลดแล้ว (ใช้ทั้งตอนส่งครั้งแรกและตอนกด "ส่งอีกครั้ง") ──
  async function sendImageUrl(imageUrl: string) {
    if (!activeConv || sending) return
    const convId = activeConv.id
    const isThis = () => openReqRef.current === convId
    setSending(true)
    setErrorBanner(null)
    const optimistic = {
      id: `temp-${Date.now()}`,
      conversation_id: convId,
      direction: 'outbound',
      message_text: null,
      attachments: [{ type: 'image', url: imageUrl }],
      sent_by: 'page_user',
      delivery_status: 'sending',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, imageUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        const msg = friendlyError(data.error) || 'ส่งรูปไม่สำเร็จ'
        if (isThis()) {
          setErrorBanner(msg)
          setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, delivery_status: 'failed', error_message: msg } : m))
          if (data.blockCode) setActiveConv((c: any) => c ? { ...c, send_block_code: data.blockCode } : c)
        }
        loadConversations({ silent: true })
      } else {
        if (isThis()) setMessages(prev => prev.map(m => m.id === optimistic.id
          ? (data.message || { ...m, delivery_status: 'sent' }) : m))
        loadConversations({ silent: true })
      }
    } catch (e: any) {
      const msg = friendlyError(e?.message)
      if (isThis()) {
        setErrorBanner(msg)
        setMessages(prev => prev.map(m => m.id === optimistic.id
          ? { ...m, delivery_status: 'failed', error_message: msg, local_only: true } : m))
      }
    }
    setSending(false)
  }

  // ── ส่งรูปภาพ: อัปโหลด → ส่งผ่าน FB/LINE ──
  async function handleSendImage(file: File) {
    if (!activeConv || uploading || sending) return
    const okTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!okTypes.includes(file.type)) { setErrorBanner('รองรับเฉพาะรูปภาพ (jpg, png, gif, webp)'); return }
    if (file.size > 5 * 1024 * 1024) { setErrorBanner('รูปต้องไม่เกิน 5 MB'); return }

    setUploading(true)
    setErrorBanner(null)
    const convId = activeConv.id
    const isThis = () => openReqRef.current === convId
    const previewUrl = URL.createObjectURL(file)
    const tempId = `temp-${Date.now()}`
    // โชว์ตัวอย่างรูปทันทีระหว่างอัปโหลด
    setMessages(prev => [...prev, {
      id: tempId, conversation_id: convId, direction: 'outbound', message_text: null,
      attachments: [{ type: 'image', url: previewUrl }],
      sent_by: 'page_user', delivery_status: 'sending', created_at: new Date().toISOString(),
    }])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('conversationId', convId)
      const upRes = await fetch('/api/inbox/upload', { method: 'POST', body: fd })
      const upData = await upRes.json().catch(() => ({}))
      if (!upRes.ok || !upData.url) throw new Error(upData.error || 'อัปโหลดรูปไม่สำเร็จ')

      // อัปโหลดเสร็จ → เอาฟองตัวอย่างออก แล้วส่งจริงด้วย URL ถาวร
      setMessages(prev => prev.filter(m => m.id !== tempId))
      URL.revokeObjectURL(previewUrl)
      setUploading(false)
      await sendImageUrl(upData.url)
      return
    } catch (e: any) {
      const msg = friendlyError(e?.message)
      if (isThis()) {
        setErrorBanner(msg)
        // เก็บไฟล์ไว้ให้ "ส่งอีกครั้ง" อัปโหลดใหม่ได้ (blob: URL ส่งตรงไป server ไม่ได้)
        pendingFilesRef.current.set(tempId, { file, url: previewUrl })
        setMessages(prev => prev.map(m => m.id === tempId
          ? { ...m, delivery_status: 'failed', error_message: msg, local_only: true } : m))
      }
      // ไม่ revoke ทันที — ต้องให้ preview ยังแสดงได้ตอนรอผู้ใช้กดส่งอีกครั้ง
    }
    setUploading(false)
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
      const data = await res.json()
      if (!isThis()) return                            // เปิดแชทอื่นไปแล้ว — ทิ้งผล
      if (data.suggestions?.length) {
        setAiSuggestions(data.suggestions)
        setActiveConv((c: any) => c && c.id === convId
          ? { ...c, ai_category: data.category, ai_sentiment: data.sentiment, ai_summary: data.summary } : c)
      } else {
        setErrorBanner(friendlyError(data.error) || 'AI ยังสร้างคำแนะนำไม่ได้ ลองใหม่อีกครั้ง')
      }
    } catch (e: any) {
      if (isThis()) setErrorBanner(friendlyError(e?.message))
    }
    setAiLoading(false)
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

  // ล้างสถานะแชทที่เปิดอยู่ทั้งหมด (รวม openReqRef กันผลโหลดเก่าเด้งเปิดเองทีหลัง)
  const clearOpenChat = () => {
    openReqRef.current = ''
    setActiveConv(null); setMessages([]); setDraft('')
    setAiSuggestions([]); setErrorBanner(null); setShowChatMenu(false)
  }
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
  const filteredConvs = conversations.filter(c => {
    if (channelFilter && (c.connected_pages?.channel || 'facebook') !== channelFilter) return false
    if (!searchPending || !search.trim()) return true
    const s = search.trim().toLowerCase()
    return (c.customer_name || '').toLowerCase().includes(s)
      || (c.last_message || '').toLowerCase().includes(s)
  })

  return (
    <div className="ib-root" data-active={activeConv ? '1' : '0'} style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', background: BG, color: TEXT, fontFamily: 'Inter, "Sarabun", system-ui, sans-serif', position: 'relative', overflow: 'hidden', overscrollBehavior: 'none' }}>
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
            {session.user.image ? (
              <img src={session.user.image} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid white' }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 900 }}>
                {(session.user.name || 'U')[0]}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name || 'ผู้ใช้'}</div>
              <div style={{ fontSize: 9, color: GREEN, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN }} />เชื่อมต่อแล้ว
              </div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: MUTED, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, padding: '6px 10px 4px' }}>เมนูหลัก</div>

        {isOwner && (
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <NavItem icon={<BarChart3 size={15} />} label="ยิงแอดเพจ" />
          </Link>
        )}
        <NavItem icon={<MessageSquare size={15} />} label="กล่องข้อความ" active badge={channelUnread} />
        <button onClick={() => setShowSettings(true)} style={{ all: 'unset', display: 'block', cursor: 'pointer' }}>
          <NavItem icon={<Settings size={15} />} label="ตั้งค่าแชท" />
        </button>
        {isOwner && (
          <Link href="/dashboard/channels" style={{ textDecoration: 'none' }}>
            <NavItem icon={<Share2 size={15} />} label="ช่องทางแชท" />
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
        <Link href={isOwner ? '/dashboard' : '/dashboard/inbox'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
          <div style={{ width: 32, height: 32, flexShrink: 0, background: 'linear-gradient(135deg, #1877f2, #5fa3ff)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
          <div className="ib-hide-narrow" style={{ fontWeight: 900, fontSize: 12.5, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>FACEBOOK CHAT</div>
        </Link>
        <div style={{ flex: 1 }} />
        {/* ตัวสลับช่องทางอยู่ที่แท็บใน page bar ที่เดียว (เดิมมี pill ตรงนี้ซ้ำ ดูเป็นคนละฟีเจอร์) */}
        {isOwner && (
          <Link href="/dashboard" style={{ ...btnGhost, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: MUTED, whiteSpace: 'nowrap', flexShrink: 0, minHeight: 36 } as any}>
            <BarChart3 size={14} /> ยิงแอดเพจ
          </Link>
        )}
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
            <div style={{
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
              {(syncing || pageSyncing) && (
                <div title="กำลัง sync จาก Facebook" style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 10, color: MUTED, fontWeight: 700, flexShrink: 0,
                }}>
                  <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                  ซิงค์...
                </div>
              )}
              {scopedUnread > 0 && (
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

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(loadingList || pageSyncing) && conversations.length === 0 ? (
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
              ) : (
                <EmptyState
                  icon={<Inbox size={36} />}
                  title={pages.length === 0 ? 'ยังไม่มีเพจที่เชื่อมต่อ' : 'ยังไม่มีข้อความ'}
                  hint={pages.length === 0
                    ? (isOwner ? 'ไปที่เมนู "ช่องทางแชท" เพื่อเชื่อมต่อเพจหรือ LINE OA' : 'ให้เจ้าของเพจมอบสิทธิ์เพจให้คุณก่อน')
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
                    onClick={() => loadMessages(c)}
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
                position: 'relative',
              }}>
                <button
                  onClick={clearOpenChat}
                  className="ib-back"
                  title="กลับไปเลือกแชทอื่น"
                  aria-label="กลับไปเลือกแชทอื่น"
                  style={{
                    display: 'none', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, flexShrink: 0, borderRadius: 11,
                    background: pageColor(activeConv.page_id).bg,
                    color: pageColor(activeConv.page_id).text,
                    border: `1.5px solid ${pageColor(activeConv.page_id).border}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <ChevronLeft size={22} strokeWidth={2.6} />
                </button>
                <Avatar name={activeConv.customer_name} src={activeConv.customer_picture} size={40} ringColor={pageColor(activeConv.page_id).border} />
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
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loadingMessages ? (
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
                    customerPic={activeConv.customer_picture}
                    onRetry={(retriedTick >= 0 && retriedRef.current.has(retryKeyOf(activeConv.id, m))) ? undefined : retryMessage}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Suggestions */}
              {aiSuggestions.length > 0 && (
                <div style={{
                  padding: '12px 18px', background: 'linear-gradient(135deg, #eaf2fd, #dcebff)',
                  borderTop: `1px solid ${BORDER2}`,
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
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    {activeConv.send_block_code === 551
                      ? 'ลูกค้ายังไม่เปิด Messenger คุยกับเพจ (หรือปิดรับ/บล็อกเพจ) — พิมพ์ตอบได้ แต่จะส่งไม่ออกจนกว่าลูกค้าจะทักกลับมาก่อน'
                      : 'เกิน 24 ชม. นับจากข้อความล่าสุดของลูกค้า — Facebook ห้ามตอบจนกว่าลูกค้าจะทักกลับมาใหม่'}
                  </div>
                </div>
              )}

              {/* Composer */}
              <div style={{ padding: '10px 14px 14px', background: SURFACE, borderTop: `1.5px solid ${BORDER}` }}>
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
                      onClick={() => setShowSavedReplies(true)}
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

                  <div className="ib-composer-input">
                    <textarea
                      ref={draftRef}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => {
                        // Enter = ส่ง เฉพาะบนคอม (มีเมาส์/คีย์บอร์ดจริง)
                        // บนมือถือ Enter = ขึ้นบรรทัดใหม่ (ไม่งั้นพิมพ์หลายบรรทัดไม่ได้)
                        if (e.key === 'Enter' && !e.shiftKey && isDesktop) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      onFocus={() => { setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: 'end' }), 350) }}
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
                      onClick={() => handleSend()}
                      disabled={!draft.trim() || sending}
                      style={{
                        ...btnPrimary, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 13.5, flexShrink: 0, minHeight: 44,
                        opacity: !draft.trim() || sending ? 0.5 : 1,
                        cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {sending ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                      ส่ง
                    </button>
                  </div>
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
              <Avatar name={activeConv.customer_name} src={activeConv.customer_picture} size={64} />
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
          onClose={() => {
            setShowSettings(false)
            // บังคับดึงค่าใหม่ → สวิตช์ "เปิดปุ่ม AI ช่วยตอบ" มีผลทันที แม้ยังเปิดแชทเดิมค้างอยู่
            setSettingsVer(v => v + 1)
          }}
          onSaved={() => { loadConversations(); loadQuickReplies() }}
        />
      )}

      {/* ข้อความตอบกลับที่บันทึกไว้ (saved replies) — เปิดจากปุ่ม + ในแถบพิมพ์ */}
      {showSavedReplies && (
        <div onClick={() => setShowSavedReplies(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 210, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, width: '100%', maxWidth: 520, maxHeight: '72dvh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(15,23,42,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
              <div style={{ width: 44, height: 5, borderRadius: 3, background: '#cbd5e1' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 12px', borderBottom: `1px solid ${BORDER}` }}>
              <button onClick={() => setShowSavedReplies(false)} style={{ background: 'transparent', border: 'none', color: MUTED, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: TEXT }}>ข้อความตอบกลับที่บันทึกไว้</div>
              <button onClick={() => { setShowSavedReplies(false); setShowSettings(true) }} style={{ background: 'transparent', border: 'none', color: PRIMARY, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ สร้าง</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 0 calc(16px + env(safe-area-inset-bottom))' }}>
              {quickReplies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: MUTED, fontSize: 13, lineHeight: 1.8 }}>
                  ยังไม่มีข้อความบันทึกไว้<br />
                  <span style={{ fontSize: 12 }}>กด "+ สร้าง" เพื่อเพิ่มข้อความตอบกลับที่ใช้บ่อย</span>
                </div>
              ) : quickReplies.map(qr => (
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
          onClick={() => setRenamePage(null)}
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
              onKeyDown={(e) => { if (e.key === 'Enter') saveNickname() }}
              placeholder={renamePage.page_name}
              maxLength={60}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14, fontWeight: 700,
                border: `2px solid ${pageColor(renamePage.id).border}`, borderRadius: 12,
                fontFamily: 'inherit', background: SURFACE2, boxSizing: 'border-box', marginBottom: 14, color: TEXT,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setNicknameDraft(''); }}
                title="ล้างชื่อเล่น (กลับไปใช้ชื่อเต็ม)"
                style={{ padding: '11px 14px', fontSize: 12, fontWeight: 800, background: SURFACE2, color: MUTED, border: `1.5px solid ${BORDER}`, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ล้าง
              </button>
              <button
                onClick={() => setRenamePage(null)}
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
                <Avatar name={session.user.name || 'U'} src={session.user.image || undefined} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name || 'ผู้ใช้'}</div>
                  <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>● เชื่อมต่อแล้ว</div>
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowMobileMenu(false); setShowSettings(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: TEXT, textAlign: 'left' }}
            >
              <Settings size={17} color={PRIMARY} /> ตั้งค่าแชท
            </button>
            {isOwner && (
              <Link href="/dashboard/channels" onClick={() => setShowMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', borderBottom: `1px solid ${BORDER}`, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: TEXT }}>
                <Share2 size={17} color={PRIMARY} /> ช่องทางแชท
              </Link>
            )}
            {isOwner && (
              <Link href="/dashboard" onClick={() => setShowMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 12px', borderBottom: `1px solid ${BORDER}`, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: TEXT }}>
                <BarChart3 size={17} color={PRIMARY} /> ยิงแอดเพจ
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
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.msg}</span>
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
          <button onClick={() => setToast(null)} aria-label="ปิด" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Responsive CSS — เหมือน Messenger บนมือถือ */}
      <style jsx global>{`
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

        /* Mobile/tablet — hide sidebar + ล็อก viewport (กันเลื่อน/เด้ง) */
        @media (max-width: 820px) {
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
        }

        /* Mobile/tablet — Messenger-like UX (≤820 ครอบทุกมือถือ + แท็บเล็ตเล็ก/in-app browser) */
        @media (max-width: 820px) {
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
          @media (max-width: 820px) {
            .ib-main { padding-bottom: calc(env(safe-area-inset-bottom) * var(--kb-open, 1)) !important; }
          }
        }

        /* iOS zoom prevention — input fontSize ≥ 16 */
        @media (max-width: 820px) {
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
        @media (max-width: 820px) {
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
        @media (max-width: 820px) {
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
      `}</style>
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

function Avatar({ name, src, size = 40, ringColor }: { name?: string; src?: string; size?: number; ringColor?: string }) {
  const ring = ringColor ? `2px solid ${ringColor}` : '1.5px solid white'
  // URL รูปโปรไฟล์ FB หมดอายุบ่อย → ถ้าโหลดไม่ขึ้นต้องตกไปใช้ตัวอักษรย่อ ไม่ใช่ปล่อยว่าง
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  if (src && !broken) {
    return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: ring, boxShadow: SHADOW_SM }} onError={() => setBroken(true)} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #5fa3ff, #2e89ff)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, boxShadow: SHADOW_SM,
      border: ring,
    }}>
      {/* ตัดตาม code point — ชื่อที่ขึ้นต้นด้วย emoji (เช่น "🌸น้องมิว") จะไม่กลายเป็น "�" */}
      {(Array.from(name || '?')[0] || '?').toUpperCase()}
    </div>
  )
}

function ConvItem({ conv, active, onClick }: { conv: any; active: boolean; onClick: () => void }) {
  const unread = conv.unread_count > 0
  const pc = pageColor(conv.page_id)
  const isLine = conv.connected_pages?.channel === 'line'
  const pageName = conv.connected_pages?.nickname || conv.connected_pages?.page_name
  const bgFor = () => active ? PRIMARY_LIGHT : (unread ? `linear-gradient(90deg, ${pc.bg} 0%, ${pc.bg}55 40%, white 100%)` : 'white')
  return (
    <button
      onClick={onClick}
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
      <Avatar name={conv.customer_name} src={conv.customer_picture} size={44} ringColor={pc.border} />
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
}

// ทำลิงก์/เบอร์โทรในข้อความลูกค้าให้กดได้ (เดิมเป็น text ต้องกดค้าง copy เอง)
function Linkify({ text, onDark }: { text: string; onDark?: boolean }) {
  const linkStyle: any = {
    color: onDark ? '#d6e9ff' : PRIMARY,
    textDecoration: 'underline',
    wordBreak: 'break-all',
  }
  const src = String(text ?? '')
  // ห้ามใช้ lookbehind ((?<!...)) — iOS Safari ต่ำกว่า 16.4 โยน SyntaxError ตอน parse
  // ทำให้ทั้งหน้าจอขาว → ใช้ exec loop แล้วเช็คอักขระข้างหน้าด้วย JS แทน
  const re = /(?:https?:\/\/|www\.)[^\s]*[^\s.,!?;:)\]}"'…]|0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/g
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
}

// รูปในแชท — แตะเพื่อดูเต็มจอ (สลิปโอนเงิน/ที่อยู่ ต้องอ่านออก)
// ถ้าโหลดไม่ขึ้น (เช่น URL สติ๊กเกอร์ LINE ไม่ทางการ) → fallback เป็นข้อความ
function MsgImage({ url, name, withText }: { url: string; name?: string; withText?: boolean }) {
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState(false)
  const isSticker = name === 'sticker'

  // ปิดด้วยปุ่ม Esc
  useEffect(() => {
    if (!open) return
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
        src={url}
        onError={() => setErr(true)}
        onClick={() => { if (!isSticker) setOpen(true) }}
        style={{
          maxWidth: isSticker ? 130 : 240, width: '100%',
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
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
            overflow: 'auto', touchAction: 'pinch-zoom',
          }}
        >
          <img src={url} alt="รูปภาพขนาดเต็ม" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
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

function MessageBubble({ message: m, customerName, customerPic, onRetry }: { message: any; customerName?: string; customerPic?: string; onRetry?: (m: any) => void }) {
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
                <MsgImage key={i} url={a.url} name={a.name} withText={!!m.message_text} />
              ) : a.url ? (
                <div key={i} style={{ marginTop: m.message_text ? 6 : 0, fontSize: 11 }}>📎 {a.name || 'ไฟล์แนบ'}</div>
              ) : null
            ))
          })()}
          {/* Fallback: ไม่มี text + ไม่มี attachment ที่ render ได้
              (เช่น sticker / reaction / ข้อความที่ FB API ไม่ส่ง content มา) */}
          {!m.message_text && !(m.attachments || []).some((a: any) => a.url) && (
            <span style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85 }}>
              💬 ข้อความ (ภาพ/สติกเกอร์/ไม่มี content)
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: MUTED, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: out ? 'flex-end' : 'flex-start' }}>
          {sending && '⏳ กำลังส่ง...'}
          {failed && (
            <>
              <span style={{ color: RED, fontWeight: 700 }}>❌ ส่งไม่สำเร็จ {m.error_message ? `(${m.error_message})` : ''}</span>
              {onRetry && (
                <button
                  onClick={() => onRetry(m)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${RED}`,
                    background: 'white', color: RED, fontSize: 11.5, fontWeight: 800,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={11} /> ส่งอีกครั้ง
                </button>
              )}
            </>
          )}
          {!sending && !failed && timeAgo(m.created_at)}
        </div>
      </div>
    </div>
  )
}

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
function SettingsModal({ pages, onClose, onSaved }: { pages: any[]; onClose: () => void; onSaved: () => void }) {
  const [selectedPage, setSelectedPage] = useState<string>(pages[0]?.id || '')
  const [settings, setSettings] = useState<any>({})
  const [quickReplies, setQuickReplies] = useState<any[]>([])
  const [newQR, setNewQR] = useState({ shortcut: '', title: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'general'|'auto'|'kb'|'qr'>('general')
  const [origin, setOrigin] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin) }, [])
  const inboxLink = `${origin}/dashboard/inbox`

  useEffect(() => {
    if (!selectedPage) return
    fetch(`/api/inbox/settings?pageId=${selectedPage}`)
      .then(r => r.json())
      .then(d => {
        const s = d.settings?.[0] || {
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
        setSettings(s)
      })
    fetch('/api/inbox/quick-replies').then(r => r.json()).then(d => setQuickReplies(d.replies || []))
  }, [selectedPage])

  async function save() {
    if (!selectedPage) return
    setSaving(true)
    await fetch('/api/inbox/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: selectedPage, ...settings }),
    })
    setSaving(false)
    onSaved()
  }

  async function addQR() {
    if (!newQR.shortcut || !newQR.title || !newQR.message) return
    const r = await fetch('/api/inbox/quick-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQR),
    }).then(r => r.json())
    if (r.success) {
      setQuickReplies([r.reply, ...quickReplies])
      setNewQR({ shortcut: '', title: '', message: '' })
      onSaved()
    }
  }

  async function deleteQR(id: string) {
    await fetch(`/api/inbox/quick-replies?id=${id}`, { method: 'DELETE' })
    setQuickReplies(quickReplies.filter(q => q.id !== id))
    onSaved()
  }

  const updateBH = (day: string, field: string, value: any) => {
    setSettings((s: any) => ({
      ...s,
      business_hours: { ...s.business_hours, [day]: { ...s.business_hours?.[day], [field]: value } }
    }))
  }

  const days = [
    { k: 'mon', label: 'จันทร์' },{ k: 'tue', label: 'อังคาร' },{ k: 'wed', label: 'พุธ' },
    { k: 'thu', label: 'พฤหัสฯ' },{ k: 'fri', label: 'ศุกร์' },{ k: 'sat', label: 'เสาร์' },{ k: 'sun', label: 'อาทิตย์' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, borderRadius: 18, width: '100%', maxWidth: 720, maxHeight: '92dvh', overflow: 'hidden', boxShadow: SHADOW_LG, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1.5px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>⚙️ ตั้งค่ากล่องข้อความ</div>
          <button onClick={onClose} style={{ ...btnGhost, padding: 8 }}><X size={16} /></button>
        </div>

        {/* Page selector */}
        {pages.length > 0 && (
          <div style={{ padding: '12px 22px', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 5 }}>เลือกเพจที่จะตั้งค่า</div>
            <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              {pages.map(p => <option key={p.id} value={p.id}>📄 {p.page_name}</option>)}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, padding: '0 22px' }}>
          {([['general','🤖 AI'],['auto','💬 ตอบอัตโนมัติ'],['kb','📚 ความรู้'],['qr','⚡ Quick Reply']] as const).map(([k,l]) => (
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

        <div style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Toggle label="✨ เปิดปุ่ม 'AI ช่วยตอบ'" checked={settings.ai_assist_enabled} onChange={v => setSettings({...settings, ai_assist_enabled: v})} />
              <Toggle label="🏷️ ให้ AI จัดหมวดหมู่อัตโนมัติ" checked={settings.ai_auto_categorize} onChange={v => setSettings({...settings, ai_auto_categorize: v})} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>🎭 โทนการตอบ</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['friendly','😊 เป็นกันเอง'],['professional','💼 ทางการ'],['casual','😎 สบายๆ']].map(([v,l]) => (
                    <button key={v} onClick={() => setSettings({...settings, ai_tone: v})} style={{
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
              <Toggle label="💬 เปิดตอบกลับอัตโนมัติ (เมื่อมีข้อความใหม่)" checked={settings.auto_reply_enabled} onChange={v => setSettings({...settings, auto_reply_enabled: v})} />
              {settings.auto_reply_enabled && (
                <textarea value={settings.auto_reply_message || ''} onChange={e => setSettings({...settings, auto_reply_message: e.target.value})} rows={3} placeholder="ข้อความตอบกลับอัตโนมัติ" style={{ width: '100%', padding: 10, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              )}

              <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />

              <Toggle label="⏰ ตั้งเวลาทำการ (นอกเวลาส่งข้อความอัตโนมัติ)" checked={settings.business_hours_enabled} onChange={v => setSettings({...settings, business_hours_enabled: v})} />
              {settings.business_hours_enabled && (
                <>
                  <textarea value={settings.off_hours_message || ''} onChange={e => setSettings({...settings, off_hours_message: e.target.value})} rows={2} placeholder="ข้อความนอกเวลาทำการ" style={{ width: '100%', padding: 10, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
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
                onChange={e => setSettings({...settings, knowledge_base: e.target.value})}
                rows={14}
                placeholder={'ตัวอย่าง:\n- เปิดทำการ จ-ศ 9:00-18:00\n- ส่งฟรี EMS เมื่อสั่งครบ 1,000 บาท\n- สินค้ามีรับประกัน 1 ปี\n- คืนสินค้าได้ภายใน 7 วัน...'}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {tab === 'qr' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>⚡ ข้อความสำเร็จรูป (ใช้ได้ทุกเพจ)</div>

              {/* Add new */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: SURFACE2, borderRadius: 12, marginBottom: 14 }}>
                <input value={newQR.shortcut} onChange={e => setNewQR({...newQR, shortcut: e.target.value})} placeholder="คำสั่ง เช่น /ราคา" style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 12 }} />
                <input value={newQR.title} onChange={e => setNewQR({...newQR, title: e.target.value})} placeholder="ชื่อแสดง เช่น ตอบราคา" style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 12 }} />
                <textarea value={newQR.message} onChange={e => setNewQR({...newQR, message: e.target.value})} placeholder="ข้อความเต็ม" rows={3} style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                <button onClick={addQR} style={{ ...btnPrimary, padding: '8px 12px', fontSize: 12 }}><Plus size={12} style={{ display: 'inline', marginRight: 4 }} />เพิ่ม</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quickReplies.map(qr => (
                  <div key={qr.id} style={{ padding: 10, background: 'white', border: `1px solid ${BORDER}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, marginBottom: 2 }}>⚡ {qr.title} <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{qr.shortcut}</span></div>
                      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{qr.message}</div>
                    </div>
                    <button onClick={() => deleteQR(qr.id)} style={{ ...btnGhost, padding: 6, color: RED, alignSelf: 'flex-start' }}><X size={12} /></button>
                  </div>
                ))}
                {quickReplies.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: MUTED, fontSize: 12 }}>ยังไม่มี Quick Reply</div>}
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
        <div style={{ padding: '14px 22px', borderTop: `1.5px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, padding: '9px 16px', fontSize: 12, fontWeight: 700 }}>ยกเลิก</button>
          {tab !== 'qr' && (
            <button onClick={save} disabled={saving} style={{ ...btnPrimary, padding: '9px 18px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />}
              บันทึก
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
