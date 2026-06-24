'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Send, Sparkles, RefreshCw, Search, Star, Archive, CheckCircle2,
  MessageSquare, Inbox, Settings, Zap, X, ChevronLeft, MoreVertical, Bot,
  AlertCircle, BarChart3, Bell, Plus, LogOut, ListFilter, MailOpen, MailQuestion,
  Pencil, Check, Copy, Share2, ImagePlus,
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

// สีประจำเพจ — เรียงให้ index ติดกันต่างกันมากที่สุด (เพจ 6 อันแรกจะได้ blue/red/green/amber/violet/teal)
const PAGE_PALETTE = [
  { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8', avatar: 'linear-gradient(135deg, #60a5fa, #2563eb)' }, // blue
  { bg: '#fee2e2', border: '#dc2626', text: '#b91c1c', avatar: 'linear-gradient(135deg, #f87171, #dc2626)' }, // red
  { bg: '#dcfce7', border: '#16a34a', text: '#15803d', avatar: 'linear-gradient(135deg, #4ade80, #16a34a)' }, // green
  { bg: '#fef3c7', border: '#d97706', text: '#b45309', avatar: 'linear-gradient(135deg, #fbbf24, #d97706)' }, // amber
  { bg: '#f3e8ff', border: '#7c3aed', text: '#6d28d9', avatar: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }, // violet
  { bg: '#ccfbf1', border: '#0d9488', text: '#0f766e', avatar: 'linear-gradient(135deg, #2dd4bf, #0d9488)' }, // teal
  { bg: '#fce7f3', border: '#db2777', text: '#be185d', avatar: 'linear-gradient(135deg, #f472b6, #db2777)' }, // pink
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
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [totalUnread, setTotalUnread] = useState(0)
  const [totalNeedsReply, setTotalNeedsReply] = useState(0)
  const [unreadByPage, setUnreadByPage] = useState<Record<string, number>>({})
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<any>(null)
  const openReqRef = useRef<string>('')  // กัน race ตอนเปิดหลายแชทเร็วๆ

  // ── Load conversations ──
  async function loadConversations() {
    setLoadingList(true)
    const params = new URLSearchParams()
    if (pageFilter) params.set('pageId', pageFilter)
    if (statusFilter !== 'all') params.set('filter', statusFilter)
    if (search) params.set('q', search)

    const res = await fetch(`/api/inbox/conversations?${params.toString()}`).then(r => r.json())
    setConversations(res.conversations || [])
    registerPageOrder(res.pages || [])  // กำหนดสีประจำเพจ (ไม่ซ้ำ) ก่อน render
    setPages(res.pages || [])
    setTotalUnread(res.totalUnread || 0)
    setTotalNeedsReply(res.totalNeedsReply || 0)
    setUnreadByPage(res.unreadByPage || {})
    setLoadingList(false)
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
    setLoadingMessages(true)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    try {
      const res = await fetch(`/api/inbox/conversations/${convId}`).then(r => r.json())
      if (openReqRef.current !== convId) return  // เปิดแชทอื่นไปแล้ว — ทิ้งผลเก่า
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
    loadConversations()
    loadQuickReplies()
    // Auto-sync ตอนเปิดแอพ (กัน rate limit ด้วย localStorage throttle 1 นาที)
    try {
      const last = Number(localStorage.getItem('inbox_last_mount_sync') || 0)
      if (Date.now() - last > 60 * 1000) {
        localStorage.setItem('inbox_last_mount_sync', String(Date.now()))
        setSyncing(true)
        backgroundSync()
          .then(() => loadConversations())
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
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Fetch ก่อน เช็ค response ตรงๆ (ไม่พึ่ง state ที่ยังไม่ re-render)
      const params = new URLSearchParams()
      if (pageFilter) params.set('pageId', pageFilter)
      if (statusFilter !== 'all') params.set('filter', statusFilter)
      if (search) params.set('q', search)
      setLoadingList(true)
      const res = await fetch(`/api/inbox/conversations?${params.toString()}`).then(r => r.json())
      if (cancelled) return
      setConversations(res.conversations || [])
      setPages(res.pages || [])
      setTotalUnread(res.totalUnread || 0)
      setUnreadByPage(res.unreadByPage || {})
      setLoadingList(false)

      // Auto-sync ถ้าเลือกเพจที่ยังไม่มี conv ใน DB + ไม่ได้ sync ใน 2 นาทีล่าสุด
      if (pageFilter && (res.conversations || []).length === 0) {
        const now = Date.now()
        const last = lastPageSyncRef.current[pageFilter] || 0
        if (now - last > 2 * 60 * 1000) {
          lastPageSyncRef.current[pageFilter] = now
          setPageSyncing(true)
          await backgroundSync(pageFilter)
          if (!cancelled) await loadConversations()
          if (!cancelled) setPageSyncing(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [pageFilter, statusFilter])

  // Poll DB ทุก 30 วิ (เร็วพอสำหรับ user แต่ไม่กิน rate limit FB
  // เพราะ poll DB ของเรา ไม่ใช่ FB)
  // Background sync FB ทุก 10 นาที (กัน webhook ตก)
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    let tick = 0
    const SYNC_EVERY_TICKS = 20  // 20 × 30s = 10 นาที
    pollRef.current = setInterval(() => {
      tick++
      loadConversations()
      if (activeConv) {
        fetch(`/api/inbox/conversations/${activeConv.id}`)
          .then(r => r.json())
          .then(res => {
            if (res.messages) setMessages(res.messages)
          })
          .catch(() => {})
      }
      if (tick % SYNC_EVERY_TICKS === 0) {
        backgroundSync()
      }
    }, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeConv?.id, pageFilter, statusFilter, search])

  // ── Send message ──
  async function handleSend() {
    if (!activeConv || !draft.trim() || sending) return
    setSending(true)
    setErrorBanner(null)
    const text = draft.trim()
    setDraft('')

    // optimistic
    const optimistic = {
      id: `temp-${Date.now()}`,
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
        body: JSON.stringify({ conversationId: activeConv.id, text }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || 'ส่งไม่สำเร็จ')
        setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, delivery_status: 'failed', error_message: data.error } : m))
        if (data.blockCode) setActiveConv((c: any) => c ? { ...c, send_block_code: data.blockCode } : c)
        loadConversations()
      } else {
        // replace optimistic with real
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data.message : m))
        loadConversations()
      }
    } catch (e: any) {
      setErrorBanner(e.message)
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
    const previewUrl = URL.createObjectURL(file)
    const optimistic = {
      id: `temp-${Date.now()}`,
      direction: 'outbound',
      message_text: null,
      attachments: [{ type: 'image', url: previewUrl }],
      sent_by: 'page_user',
      delivery_status: 'sending',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    let swapped = false
    try {
      // 1) อัปโหลดขึ้น storage
      const fd = new FormData()
      fd.append('file', file)
      fd.append('conversationId', convId)
      const upRes = await fetch('/api/inbox/upload', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upRes.ok || !upData.url) throw new Error(upData.error || 'อัปโหลดไม่สำเร็จ')

      // แทน blob preview ด้วย URL จริงทันที (กันรูปหายถ้า send ช้า/รีเฟรช) + คืน blob
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, attachments: [{ type: 'image', url: upData.url }] } : m))
      URL.revokeObjectURL(previewUrl); swapped = true

      // 2) ส่งให้ลูกค้า
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, imageUrl: upData.url }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || 'ส่งรูปไม่สำเร็จ')
        setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, delivery_status: 'failed', error_message: data.error } : m))
        if (data.blockCode) setActiveConv((c: any) => c ? { ...c, send_block_code: data.blockCode } : c)
        loadConversations()
      } else {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data.message : m))
        loadConversations()
      }
    } catch (e: any) {
      setErrorBanner(e.message)
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, delivery_status: 'failed', error_message: e.message } : m))
    } finally {
      if (!swapped) setTimeout(() => URL.revokeObjectURL(previewUrl), 30000)
      setUploading(false)
    }
  }

  // ── AI Suggest ──
  async function handleAiSuggest(instruction?: string) {
    if (!activeConv || aiLoading) return
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const res = await fetch('/api/inbox/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConv.id, instruction }),
      })
      const data = await res.json()
      if (data.suggestions?.length) {
        setAiSuggestions(data.suggestions)
        setActiveConv((c: any) => c ? { ...c, ai_category: data.category, ai_sentiment: data.sentiment, ai_summary: data.summary } : c)
      } else {
        setErrorBanner(data.error || 'AI ไม่สามารถสร้างคำแนะนำได้')
      }
    } catch (e: any) {
      setErrorBanner(e.message)
    }
    setAiLoading(false)
  }

  // ── Conversation actions ──
  async function patchConv(patch: any) {
    if (!activeConv) return
    await fetch(`/api/inbox/conversations/${activeConv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setActiveConv((c: any) => c ? { ...c, ...patch } : c)
    loadConversations()
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
  const fbPages = pages.filter(p => channelOf(p) === 'facebook')
  const linePages = pages.filter(p => channelOf(p) === 'line')

  const pickChannel = (ch: 'facebook' | 'line') => {
    setChannelFilter(ch); setPageFilter(''); setActiveConv(null); setMessages([])
  }

  // ถ้ามีช่องทางเดียว → เลือกให้อัตโนมัติ (ไม่ต้องโชว์หน้าเลือก)
  useEffect(() => {
    if (pages.length === 0 || channelFilter) return
    const chans = Array.from(new Set(pages.map(channelOf)))
    if (chans.length === 1) setChannelFilter(chans[0] as 'facebook' | 'line')
  }, [pages, channelFilter])

  const filteredConvs = conversations.filter(c => {
    if (channelFilter && (c.connected_pages?.channel || 'facebook') !== channelFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
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
        <NavItem icon={<MessageSquare size={15} />} label="กล่องข้อความ" active badge={totalUnread} />
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
        <Link href={isOwner ? '/dashboard' : '/dashboard/inbox'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #1877f2, #5fa3ff)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
          <div style={{ fontWeight: 900, fontSize: 12.5, color: TEXT }}>FACEBOOK CHAT NAIWANSOOK</div>
        </Link>
        <div style={{ flex: 1 }} />
        {isOwner && (
          <Link href="/dashboard" style={{ ...btnGhost, padding: '7px 11px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: MUTED } as any}>
            <BarChart3 size={13} /> ยิงแอดเพจ
          </Link>
        )}
      </div>

      {/* Main 3-column layout */}
      <main data-active={activeConv ? '1' : '0'} style={{ marginLeft: 244, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }} className="ib-main">
        {/* เลือกช่องทางก่อน (Facebook / LINE) — โชว์เมื่อมีทั้งสองช่องทางและยังไม่เลือก */}
        {showChannelGate && (
          <div className="ib-channel-gate" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 244, zIndex: 120, background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20, overflowY: 'auto' }}>
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
                  <button
                    key={p.id}
                    className="fbtap"
                    onClick={() => setPageFilter(p.id)}
                    title={p.nickname ? `${p.nickname} · ${p.page_name}` : p.page_name}
                    style={{
                      position: 'relative', padding: '9px 9px 9px 12px', borderRadius: 12,
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
                        color: 'white', fontSize: 10, fontWeight: 800,
                        padding: '2px 7px', borderRadius: 999, minWidth: 20, textAlign: 'center',
                        flexShrink: 0,
                      }}>{unread > 99 ? '99+' : unread}</span>
                    )}
                    <span
                      onClick={(e) => { e.stopPropagation(); openRename(p) }}
                      title="ตั้งชื่อเล่นเพจ"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: 'pointer',
                        background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
                        color: active ? 'white' : pc.text,
                      }}
                    >
                      <Pencil size={12} />
                    </span>
                  </button>
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
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาลูกค้า..."
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
                ['unread', 'ใหม่', null, totalUnread > 0 ? totalUnread : null],
                ['needs_reply', 'ยังไม่ตอบ', null, totalNeedsReply > 0 ? totalNeedsReply : null],
                ['starred', null, Star, null],
                ['archived', null, Archive, null],
              ] as const).map(([key, label, Icon, count]) => {
                const active = statusFilter === key
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key as any)}
                    title={key === 'starred' ? 'ติดดาว' : key === 'archived' ? 'จัดเก็บ' : undefined}
                    style={{
                      flex: 1, padding: '7px 4px', border: 'none',
                      borderRadius: 8,
                      // ACTIVE = filled gradient purple → ชัดเจนเด่นมาก
                      background: active
                        ? 'linear-gradient(135deg, #1877f2, #2e89ff)'
                        : 'transparent',
                      boxShadow: active
                        ? '0 3px 10px rgba(11,95,204,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'none',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      fontFamily: 'inherit',
                      // ACTIVE = white text, INACTIVE = muted
                      color: active ? 'white' : MUTED,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      transition: 'all 0.18s',
                    }}
                  >
                    {Icon ? <Icon size={13} /> : label}
                    {count !== null && count !== undefined && (
                      <span style={{
                        background: active ? 'rgba(255,255,255,0.25)' : RED,
                        color: 'white',
                        fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999,
                        minWidth: 14, textAlign: 'center', lineHeight: 1.4,
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
              <EmptyState
                icon={<Inbox size={36} />}
                title={pages.length === 0 ? 'ยังไม่มีเพจที่เชื่อมต่อ' : 'ยังไม่มีข้อความ'}
                hint={pages.length === 0
                  ? 'กลับไปหน้ายิงแอดเพจเพื่อเชื่อมต่อเพจก่อน'
                  : 'เพจนี้ยังไม่มีบทสนทนา หรือลูกค้ายังไม่ได้ทักเข้ามา'}
              />
            ) : (
              filteredConvs.map(c => (
                <ConvItem
                  key={c.id}
                  conv={c}
                  active={activeConv?.id === c.id}
                  onClick={() => loadMessages(c)}
                />
              ))
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
                padding: '14px 18px', background: SURFACE,
                borderBottom: `1.5px solid ${BORDER}`,
                borderTop: `4px solid ${pageColor(activeConv.page_id).border}`,
                display: 'flex', alignItems: 'center', gap: 12, boxShadow: SHADOW_SM,
              }}>
                <button
                  onClick={() => { openReqRef.current = ''; setActiveConv(null); setMessages([]); setDraft(''); setAiSuggestions([]); setErrorBanner(null) }}
                  className="ib-back"
                  title="กลับไปเลือกแชทอื่น"
                  style={{
                    display: 'none', alignItems: 'center', justifyContent: 'center',
                    width: 38, height: 38, flexShrink: 0, borderRadius: 11,
                    background: pageColor(activeConv.page_id).bg,
                    color: pageColor(activeConv.page_id).text,
                    border: `1.5px solid ${pageColor(activeConv.page_id).border}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <ChevronLeft size={22} strokeWidth={2.6} />
                </button>
                <Avatar name={activeConv.customer_name} src={activeConv.customer_picture} size={42} ringColor={pageColor(activeConv.page_id).border} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: TEXT, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeConv.customer_name || 'ลูกค้า'}
                    {activeConv.is_starred && <Star size={13} fill={YELLOW} color={YELLOW} style={{ flexShrink: 0 }} />}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 999,
                      background: pageColor(activeConv.page_id).bg,
                      color: pageColor(activeConv.page_id).text,
                      fontSize: 11.5, fontWeight: 900,
                      border: `1.5px solid ${pageColor(activeConv.page_id).border}`,
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: pageColor(activeConv.page_id).border, flexShrink: 0 }} />
                      {activeConv.connected_pages?.nickname || activeConv.connected_pages?.page_name || 'เพจ'}
                    </span>
                  </div>
                </div>
                <div className="ib-chat-actions" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => patchConv({ is_starred: !activeConv.is_starred })}
                    title={activeConv.is_starred ? 'เลิก star' : 'Star'}
                    style={{ ...btnGhost, padding: 8 }}
                  >
                    <Star size={14} fill={activeConv.is_starred ? YELLOW : 'transparent'} color={activeConv.is_starred ? YELLOW : MUTED} />
                  </button>
                  <button
                    onClick={() => patchConv({ is_resolved: !activeConv.is_resolved })}
                    title={activeConv.is_resolved ? 'เปิดใหม่' : 'จบบทสนทนา'}
                    style={{ ...btnGhost, padding: 8, color: activeConv.is_resolved ? GREEN : MUTED }}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={() => patchConv({ is_archived: !activeConv.is_archived })}
                    title="Archive"
                    style={{ ...btnGhost, padding: 8 }}
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    title="ข้อมูลลูกค้า"
                    className="ib-toggle-right ib-hide-mobile"
                    style={{ ...btnGhost, padding: 8 }}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {errorBanner && (
                <div style={{
                  padding: '10px 18px', background: RED_L, borderBottom: `1px solid ${RED}33`,
                  fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700,
                }}>
                  <AlertCircle size={14} />
                  <div style={{ flex: 1 }}>{errorBanner}</div>
                  <button onClick={() => setErrorBanner(null)} style={{ all: 'unset', cursor: 'pointer' }}><X size={14} /></button>
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
                  <div style={{ fontSize: 11, fontWeight: 800, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={12} /> AI แนะนำคำตอบ — กดเพื่อใช้
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {aiSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { setDraft(s); setAiSuggestions([]) }}
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
              <div style={{ padding: '12px 18px 16px', background: SURFACE, borderTop: `1.5px solid ${BORDER}` }}>
                {/* Quick reply chips */}
                {quickReplies.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, marginBottom: 8, overflowX: 'auto', paddingBottom: 4, width: '100%', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
                    {quickReplies.slice(0, 6).map(qr => (
                      <button
                        key={qr.id}
                        onClick={() => setDraft(qr.message)}
                        style={{
                          padding: '5px 10px', borderRadius: 999, border: `1px solid ${BORDER}`,
                          background: SURFACE2, fontSize: 11, fontWeight: 700, color: PRIMARY,
                          cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                        }}
                        title={qr.message}
                      >⚡ {qr.title}</button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleSendImage(f); e.target.value = '' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending}
                    title="แนบรูปภาพ"
                    style={{
                      padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
                      background: SURFACE2, color: PRIMARY, flexShrink: 0,
                      cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center',
                    }}
                  >
                    {uploading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={16} />}
                  </button>
                  <button
                    onClick={() => handleAiSuggest()}
                    disabled={aiLoading}
                    title="ให้ AI ช่วยร่างคำตอบ"
                    style={{
                      padding: '11px 14px', borderRadius: 12, border: 'none',
                      background: aiLoading ? '#dcebff' : 'linear-gradient(135deg, #8b5cf6, #2e89ff)',
                      color: 'white', cursor: aiLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800,
                      fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
                    }}
                  >
                    {aiLoading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                    AI ช่วยตอบ
                  </button>

                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    onFocus={() => { setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: 'end' }), 350) }}
                    placeholder="พิมพ์ข้อความ..."
                    rows={1}
                    className="ib-chat-input"
                    style={{
                      flex: 1, padding: '11px 14px', borderRadius: 12,
                      border: `1.5px solid ${BORDER}`, background: SURFACE2,
                      fontSize: 16, fontFamily: 'inherit', resize: 'none', outline: 'none',
                      maxHeight: 140, color: TEXT,
                    }}
                  />

                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    style={{
                      ...btnPrimary, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, opacity: !draft.trim() || sending ? 0.5 : 1,
                      cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {sending ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                    ส่ง
                  </button>
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
          onClose={() => setShowSettings(false)}
          onSaved={() => { loadConversations(); loadQuickReplies() }}
        />
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

        /* Tablet — hide right panel */
        @media (max-width: 1280px) {
          .ib-col3 { display: none !important; }
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
          /* หน้าเลือกช่องทาง — เต็มจอบนมือถือ (ครอบ sidebar/mobile bar) */
          .ib-channel-gate { left: 0 !important; }
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
          .ib-pagebar > div > button {
            scroll-snap-align: start;
            flex-shrink: 0 !important;
            max-width: 200px;
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

        /* iOS safe area — กัน input ทับ home bar */
        @supports (padding: env(safe-area-inset-bottom)) {
          @media (max-width: 820px) {
            .ib-main { padding-bottom: env(safe-area-inset-bottom) !important; }
          }
        }

        /* iOS zoom prevention — input fontSize ≥ 16 */
        @media (max-width: 820px) {
          input[type="text"], input[type="search"], textarea, select {
            font-size: 16px !important;
          }
          /* ซ่อนปุ่มที่ไม่จำเป็นบนมือถือ (right panel ใช้ไม่ได้อยู่แล้ว) */
          .ib-hide-mobile { display: none !important; }
        }
        /* จอแคบมาก — ย่อปุ่ม action ในหัวแชท กันล้น/โดนตัด */
        @media (max-width: 430px) {
          .ib-chat-actions { gap: 3px !important; }
          .ib-chat-actions button { padding: 6px !important; }
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
  if (src) {
    return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: ring, boxShadow: SHADOW_SM }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #5fa3ff, #2e89ff)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, boxShadow: SHADOW_SM,
      border: ring,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function ConvItem({ conv, active, onClick }: { conv: any; active: boolean; onClick: () => void }) {
  const unread = conv.unread_count > 0
  const pc = pageColor(conv.page_id)
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: 10, padding: '12px 14px', cursor: 'pointer',
        borderBottom: `1px solid ${BORDER}`,
        background: active
          ? PRIMARY_LIGHT
          : (unread ? `linear-gradient(90deg, ${pc.bg} 0%, ${pc.bg}55 40%, white 100%)` : 'white'),
        borderLeft: `4px solid ${active ? PRIMARY : pc.border}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = SURFACE2 }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = unread
          ? `linear-gradient(90deg, ${pc.bg} 0%, ${pc.bg}55 40%, white 100%)`
          : 'white'
      }}
    >
      <Avatar name={conv.customer_name} src={conv.customer_picture} size={40} ringColor={pc.border} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
          <div style={{
            fontSize: 13, fontWeight: unread ? 800 : 700, color: TEXT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {conv.customer_name || 'ลูกค้า'}
            {conv.is_starred && <Star size={11} fill={YELLOW} color={YELLOW} style={{ marginLeft: 4, display: 'inline' }} />}
          </div>
          <div style={{ fontSize: 10, color: unread ? PRIMARY : MUTED, flexShrink: 0, fontWeight: unread ? 800 : 600 }}>
            {timeAgo(conv.last_message_at)}
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999,
            background: pc.bg, color: pc.text,
            fontSize: 10, fontWeight: 800,
            border: `1px solid ${pc.border}33`,
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {conv.connected_pages?.channel === 'line' ? (
              <span style={{ fontSize: 8, fontWeight: 900, color: 'white', background: '#06c755', borderRadius: 3, padding: '1px 3px', flexShrink: 0, letterSpacing: 0.3 }}>LINE</span>
            ) : (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: pc.border, flexShrink: 0 }} />
            )}
            {conv.connected_pages?.nickname || conv.connected_pages?.page_name}
          </span>
        </div>
        {conv.send_block_code && (
          <div style={{ marginBottom: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 8px', borderRadius: 999,
              background: '#fff4e5', color: '#b45309',
              fontSize: 10, fontWeight: 800, border: '1px solid rgba(245,158,11,0.3)',
            }}>
              ⚠️ {conv.send_block_code === 551 ? 'ลูกค้ายังไม่เปิดแชท' : 'เกิน 24 ชม.'} — รอลูกค้าทัก
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{
            fontSize: 12, color: unread ? TEXT : MUTED, fontWeight: unread ? 700 : 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {conv.last_sender === 'page' && <span style={{ color: MUTED }}>คุณ: </span>}
            {conv.last_message || '(ไม่มีข้อความ)'}
          </div>
          {unread && (
            <span style={{ background: PRIMARY, color: 'white', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center', flexShrink: 0 }}>
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </div>
        {conv.ai_category && (
          <div style={{ marginTop: 5 }}>
            <span style={{
              display: 'inline-block', padding: '2px 7px', borderRadius: 999,
              background: categoryConfig[conv.ai_category]?.bg || '#f1f5f9',
              color: categoryConfig[conv.ai_category]?.color || MUTED,
              fontSize: 9, fontWeight: 800,
            }}>
              {categoryConfig[conv.ai_category]?.label || conv.ai_category}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message: m, customerName, customerPic }: { message: any; customerName?: string; customerPic?: string }) {
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
          {m.message_text}
          {(() => {
            // dedupe ตาม url (FB ส่ง sticker ผ่านทั้ง field sticker + attachments url เดียวกัน → ซ้ำ)
            const seen = new Set<string>()
            const atts = ((m.attachments || []) as any[]).filter(a => {
              if (!a?.url) return false
              if (seen.has(a.url)) return false
              seen.add(a.url)
              return true
            })
            // ถ้ามี image แล้ว → ไม่แสดง file/link อื่น
            const hasImage = atts.some(a => a.type === 'image' && a.url)
            const filtered = hasImage ? atts.filter(a => a.type === 'image' && a.url) : atts
            return filtered.map((a, i) => (
              a.type === 'image' && a.url ? (
                <img key={i} src={a.url} style={{ maxWidth: 200, marginTop: m.message_text ? 6 : 0, borderRadius: 8, display: 'block' }} alt="" />
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
        <div style={{ fontSize: 10, color: MUTED, padding: '0 4px' }}>
          {sending && '⏳ กำลังส่ง...'}
          {failed && <span style={{ color: RED, fontWeight: 700 }}>❌ ส่งไม่สำเร็จ {m.error_message ? `(${m.error_message})` : ''}</span>}
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
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', padding: '8px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{label}</div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, background: checked ? PRIMARY : '#cbd5e1', borderRadius: 999,
          position: 'relative', transition: 'all 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, background: 'white', borderRadius: '50%',
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          transition: 'all 0.2s', boxShadow: SHADOW_SM,
        }} />
      </div>
    </label>
  )
}
