'use client'
import { useEffect, useState, useRef, ReactNode } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, Plus, ChevronRight, TrendingUp, Activity, Target, LogOut, X, ArrowLeft, Zap } from 'lucide-react'

// ─── Design Tokens (Light Hi-Tech) ─────────────────────────────
const BG       = '#eef2ff'
const BG2      = '#f0f5ff'
const SURFACE  = '#ffffff'
const SURFACE2 = '#f5f7ff'
const BORDER   = 'rgba(99,102,241,0.13)'
const BORDER2  = 'rgba(99,102,241,0.22)'
const TEXT     = '#1a1f3c'
const MUTED    = '#6b7280'
const PRIMARY  = '#4338ca'
const PRIMARY2 = '#6366f1'
const PRIMARY_LIGHT = '#eef2ff'
const GREEN    = '#059669'
const GREEN_L  = '#d1fae5'
const RED      = '#dc2626'
const RED_L    = '#fee2e2'
const YELLOW   = '#d97706'
const YELLOW_L = '#fef3c7'
const CYAN     = '#0891b2'
const CYAN_L   = '#cffafe'

// Shadows
const SHADOW_SM  = '0 2px 8px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.04)'
const SHADOW_MD  = '0 4px 20px rgba(99,102,241,0.12), 0 2px 6px rgba(0,0,0,0.05)'
const SHADOW_LG  = '0 8px 36px rgba(99,102,241,0.16), 0 3px 10px rgba(0,0,0,0.07)'
const SHADOW_RAISED = '4px 4px 14px rgba(99,102,241,0.13), -3px -3px 10px rgba(255,255,255,0.95)'

// ─── Button Styles ──────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)',
  color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer',
  boxShadow: '0 6px 22px rgba(67,56,202,0.42), 0 2px 6px rgba(67,56,202,0.25), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
  fontFamily: 'inherit', fontWeight: 700, transition: 'all 0.18s',
  letterSpacing: '0.01em',
}
const btnGhost: React.CSSProperties = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f0f4ff 100%)',
  color: MUTED, borderRadius: 10, cursor: 'pointer',
  border: `1.5px solid ${BORDER}`,
  boxShadow: '3px 3px 10px rgba(99,102,241,0.1), -2px -2px 8px rgba(255,255,255,0.9)',
  fontFamily: 'inherit', transition: 'all 0.18s',
  display: 'flex', alignItems: 'center',
}

const recConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  keep_running:     { label: 'ปล่อยต่อไปเลย',      color: GREEN,    bg: GREEN_L,  border: 'rgba(5,150,105,0.25)',  icon: '✅' },
  increase_budget:  { label: 'เพิ่มงบได้เลย',       color: '#2563eb', bg: '#dbeafe', border: 'rgba(37,99,235,0.25)',  icon: '💰' },
  extend_duration:  { label: 'ต่อระยะเวลา',         color: CYAN,     bg: CYAN_L,   border: 'rgba(8,145,178,0.25)',  icon: '⏱️' },
  decrease_budget:  { label: 'ลดงบก่อน',            color: YELLOW,   bg: YELLOW_L, border: 'rgba(217,119,6,0.25)',  icon: '⚠️' },
  change_targeting: { label: 'เปลี่ยน Targeting',   color: '#ea580c', bg: '#ffedd5', border: 'rgba(234,88,12,0.25)', icon: '🎯' },
  pause_ad:         { label: 'หยุดโฆษณา',           color: RED,      bg: RED_L,    border: 'rgba(220,38,38,0.25)',  icon: '🛑' },
}

function fmt(n: number | string | undefined, d = 0) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: d })
}
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [pages, setPages] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAll()
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadAll() {
    setLoading(true)
    const [pagesRes, campaignsRes, notifsRes] = await Promise.all([
      fetch('/api/pages').then(r => r.json()),
      fetch('/api/ads').then(r => r.json()),
      fetch('/api/notifications').then(r => r.json()),
    ])
    setPages(pagesRes.pages || [])
    setCampaigns(campaignsRes.campaigns || [])
    setNotifications(notifsRes.notifications || [])
    setUnreadCount(notifsRes.unreadCount || 0)
    setLoading(false)
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: 'all' }) })
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const pausedCampaigns = campaigns.filter(c => c.status === 'paused').length

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Sarabun', sans-serif", position: 'relative' }}>

      {/* Tech grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.045) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />
      {/* Glow accents */}
      <div style={{ position: 'fixed', top: '-8%', right: '-4%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '-6%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1.5px solid ${BORDER}`,
        padding: '11px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 16px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {/* Logo */}
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%)',
            borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
            boxShadow: '0 4px 14px rgba(67,56,202,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: TEXT, letterSpacing: '-0.3px', lineHeight: 1.2 }}>FB Ads AI</div>
            {session?.user?.name && <div style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{session.user.name}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bell */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => { setShowNotif(!showNotif); if (!showNotif && unreadCount > 0) markAllRead() }}
              style={{ ...btnGhost, padding: '8px 11px', position: 'relative' }}>
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 5, right: 5, width: 8, height: 8,
                  background: RED, borderRadius: '50%',
                  boxShadow: '0 0 6px rgba(220,38,38,0.6)',
                }} />
              )}
            </button>

            {showNotif && (
              <div style={{
                position: 'absolute', right: 0, top: 50, width: 328,
                background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 18, zIndex: 100,
                boxShadow: SHADOW_LG, overflow: 'hidden',
              }}>
                <div style={{ padding: '13px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: TEXT }}>🔔 การแจ้งเตือน</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: 11, color: PRIMARY, cursor: 'pointer', fontWeight: 700 }} onClick={markAllRead}>
                      อ่านทั้งหมด
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: MUTED, fontSize: 13 }}>ยังไม่มีการแจ้งเตือน</div>
                ) : notifications.slice(0, 8).map((n: any) => (
                  <div key={n.id} style={{
                    padding: '11px 18px', borderBottom: `1px solid ${BORDER}`,
                    background: n.is_read ? SURFACE : PRIMARY_LIGHT,
                    transition: 'background 0.2s',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.55 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{fmtDate(n.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Button */}
          <button onClick={() => setShowModal(true)} style={{
            ...btnPrimary, padding: '9px 18px', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Plus size={15} /> ยิงแอดใหม่
          </button>

          {/* Logout */}
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
            ...btnGhost, padding: '8px 11px',
          }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 920, margin: '0 auto', padding: '26px 20px' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
          <StatCard icon={<Activity size={17} />} label="แอดทั้งหมด" value={String(campaigns.length)} color={PRIMARY} bg="#ede9fe" accent="#c4b5fd" />
          <StatCard icon={<TrendingUp size={17} />} label="กำลังวิ่ง" value={String(activeCampaigns)} color={GREEN} bg={GREEN_L} accent="#6ee7b7" />
          <StatCard icon={<Target size={17} />} label="หยุดชั่วคราว" value={String(pausedCampaigns)} color={YELLOW} bg={YELLOW_L} accent="#fcd34d" />
        </div>

        {/* Pages Bar */}
        {pages.length > 0 && (
          <div style={{
            background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 14,
            padding: '11px 18px', marginBottom: 20,
            boxShadow: SHADOW_SM,
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>📄 Pages:</span>
            {pages.map((p: any) => (
              <span key={p.id} style={{
                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                color: PRIMARY, padding: '3px 14px',
                borderRadius: 999, fontSize: 12, fontWeight: 700,
                border: `1px solid rgba(67,56,202,0.2)`,
                boxShadow: '2px 2px 6px rgba(99,102,241,0.1), -1px -1px 4px rgba(255,255,255,0.9)',
              }}>{p.name}</span>
            ))}
          </div>
        )}

        {/* Campaign List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 72, color: MUTED }}>
            <div style={{ fontSize: 38, marginBottom: 14, opacity: 0.5 }}>⏳</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>กำลังโหลด...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 64,
            background: SURFACE, border: `1.5px solid ${BORDER}`,
            borderRadius: 22, boxShadow: SHADOW_MD,
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📢</div>
            <p style={{ color: MUTED, marginBottom: 24, fontSize: 15, fontWeight: 600 }}>ยังไม่มีแอดใดๆ</p>
            <button onClick={() => setShowModal(true)} style={{ ...btnPrimary, padding: '13px 32px', fontSize: 14 }}>
              + สร้างแอดแรกเลย
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map((c: any) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}
      </div>

      {showModal && <BoostModal pages={pages} onClose={() => setShowModal(false)} onSuccess={loadAll} />}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.22s ease-out both; }
      `}</style>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color, bg, accent }: { icon: ReactNode; label: string; value: string; color: string; bg: string; accent: string }) {
  return (
    <div style={{
      background: SURFACE,
      border: `1.5px solid ${BORDER}`,
      borderRadius: 18,
      padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: SHADOW_RAISED,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Accent top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${accent})`, borderRadius: '18px 18px 0 0' }} />
      <div style={{
        background: bg, borderRadius: 13, padding: 11, color, flexShrink: 0,
        boxShadow: `2px 2px 8px ${color}22, -1px -1px 5px rgba(255,255,255,0.9)`,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Campaign Card ──────────────────────────────────────────────
function CampaignCard({ campaign: c }: { campaign: any }) {
  const isActive = c.status === 'active'
  const isPaused = c.status === 'paused'
  const statusColor = isActive ? GREEN : isPaused ? YELLOW : MUTED
  const statusBg    = isActive ? GREEN_L : isPaused ? YELLOW_L : '#f1f5f9'
  const statusLabel = isActive ? '● กำลังวิ่ง' : isPaused ? '⏸ หยุด' : c.status

  return (
    <a href={`/dashboard/campaign/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{
        background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 18,
        padding: '17px 22px', cursor: 'pointer',
        boxShadow: SHADOW_RAISED,
        transition: 'all 0.2s',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = `0 10px 36px rgba(67,56,202,0.18), 0 3px 10px rgba(0,0,0,0.08)`
          e.currentTarget.style.borderColor = BORDER2
          e.currentTarget.style.transform = 'translateY(-3px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = SHADOW_RAISED
          e.currentTarget.style.borderColor = BORDER
          e.currentTarget.style.transform = 'translateY(0)'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📌 {c.campaign_name}
            </div>
            <div style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontWeight: 700, color: GREEN, background: GREEN_L, padding: '2px 10px', borderRadius: 999, fontSize: 11 }}>
                ฿{fmt(c.daily_budget)}/วัน
              </span>
              <span>{fmtDate(c.start_time)} — {fmtDate(c.end_time)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 14 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: statusColor, background: statusBg,
              padding: '4px 13px', borderRadius: 999,
              border: `1px solid ${statusColor}35`,
              boxShadow: `1px 1px 4px ${statusColor}20`,
            }}>{statusLabel}</span>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(145deg, #ffffff, #e8eeff)',
              borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: PRIMARY,
              boxShadow: '2px 2px 8px rgba(99,102,241,0.15), -1px -1px 5px rgba(255,255,255,0.9)',
              border: `1px solid ${BORDER}`,
            }}>
              <ChevronRight size={15} />
            </div>
          </div>
        </div>
        {c.fb_campaign_id && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
            ID: {c.fb_campaign_id}
          </div>
        )}
      </div>
    </a>
  )
}

// ─── Boost Modal ────────────────────────────────────────────────
function BoostModal({ pages, onClose, onSuccess }: { pages: any[]; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1)
  const [selectedPage, setSelectedPage] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [budget, setBudget] = useState(100)
  const [days, setDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [error, setError] = useState('')

  async function fetchPosts(page: any) {
    setLoadingPosts(true); setError('')
    try {
      const r = await fetch(`/api/posts?pageId=${page.id}&pageToken=${encodeURIComponent(page.access_token)}`)
      const d = await r.json()
      if (d.error) setError(d.error)
      setPosts(d.posts || [])
    } catch { setError('ดึงโพสต์ไม่ได้ กรุณาลองใหม่') }
    finally { setLoadingPosts(false) }
  }

  async function handleSubmit() {
    if (!selectedPage || !selectedPost) return
    setSubmitting(true); setError('')
    const endDate = new Date(); endDate.setDate(endDate.getDate() + days)
    const res = await fetch('/api/ads/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: selectedPost.id, pageId: selectedPage.id,
        pageToken: selectedPage.access_token, pageName: selectedPage.name,
        postMessage: selectedPost.message,
        campaignName: `Boost - ${(selectedPost.message || selectedPost.id).slice(0, 40)}`,
        dailyBudget: budget, startDate: new Date().toISOString(), endDate: endDate.toISOString(),
      }),
    })
    const d = await res.json(); setSubmitting(false)
    if (!res.ok || d.error) { setError(d.error || 'เกิดข้อผิดพลาด'); return }
    onClose(); onSuccess()
  }

  const steps = ['เลือก Page', 'เลือกโพสต์', 'ตั้งค่างบ']

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: SURFACE,
        border: `1.5px solid ${BORDER}`,
        borderRadius: 26,
        width: '100%', maxWidth: 500, maxHeight: '88vh', overflow: 'auto',
        boxShadow: '0 24px 64px rgba(67,56,202,0.22), 0 8px 24px rgba(0,0,0,0.12)',
      }}>
        {/* Modal Header */}
        <div style={{ padding: '24px 26px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 14px', color: TEXT, letterSpacing: '-0.3px' }}>🚀 ยิงแอดใหม่</h2>
            {/* Progress */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: s <= step
                    ? `linear-gradient(90deg, #4338ca, #818cf8)`
                    : '#e2e8f0',
                  transition: 'all 0.3s',
                  boxShadow: s <= step ? '0 2px 8px rgba(67,56,202,0.3)' : 'none',
                }} />
              ))}
            </div>
            <p style={{ fontSize: 12, color: MUTED, margin: 0, fontWeight: 600 }}>
              ขั้นที่ {step}/3 — {steps[step - 1]}
            </p>
          </div>
          <button onClick={onClose} style={{
            ...btnGhost, padding: '7px', borderRadius: 10, marginLeft: 14,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 26px 28px' }}>
          {error && (
            <div style={{
              background: RED_L, border: `1.5px solid rgba(220,38,38,0.25)`,
              borderRadius: 11, padding: '10px 15px', marginBottom: 15,
              fontSize: 13, color: RED, fontWeight: 600,
              boxShadow: '0 2px 8px rgba(220,38,38,0.1)',
            }}>
              ❌ {error}
            </div>
          )}

          {/* Step 1 — เลือก Page */}
          {step === 1 && (
            <div>
              {pages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: MUTED, fontSize: 13, fontWeight: 600 }}>
                  ไม่พบ Page — กรุณา Login ใหม่
                </div>
              ) : pages.map((p: any) => (
                <button key={p.id}
                  onClick={() => { setSelectedPage(p); fetchPosts(p); setStep(2) }}
                  style={{
                    width: '100%', padding: '15px 18px', marginBottom: 9,
                    background: 'linear-gradient(145deg, #ffffff, #f5f7ff)',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 14,
                    color: TEXT, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 700,
                    fontFamily: 'inherit',
                    boxShadow: '3px 3px 10px rgba(99,102,241,0.1), -2px -2px 7px rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = BORDER2
                    e.currentTarget.style.background = PRIMARY_LIGHT
                    e.currentTarget.style.color = PRIMARY
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = BORDER
                    e.currentTarget.style.background = 'linear-gradient(145deg, #ffffff, #f5f7ff)'
                    e.currentTarget.style.color = TEXT
                  }}>
                  <span>📄 {p.name}</span>
                  <ChevronRight size={16} color={MUTED} />
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — เลือกโพสต์ */}
          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} style={{
                background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
                marginBottom: 13, fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
              }}>
                <ArrowLeft size={13} /> กลับ
              </button>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 13, fontWeight: 600 }}>
                โพสต์จาก <strong style={{ color: TEXT }}>{selectedPage?.name}</strong>
              </p>
              {loadingPosts ? (
                <div style={{ textAlign: 'center', padding: 36, color: MUTED, fontSize: 13 }}>⏳ กำลังโหลด...</div>
              ) : posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 36, color: MUTED, fontSize: 13, fontWeight: 600 }}>ไม่พบโพสต์</div>
              ) : posts.map((p: any) => (
                <button key={p.id}
                  onClick={() => { setSelectedPost(p); setStep(3) }}
                  style={{
                    width: '100%', padding: '13px 15px', marginBottom: 8,
                    background: 'linear-gradient(145deg, #ffffff, #f5f7ff)',
                    border: `1.5px solid ${BORDER}`, borderRadius: 13,
                    color: TEXT, cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    display: 'flex', gap: 11, alignItems: 'flex-start',
                    fontFamily: 'inherit',
                    boxShadow: '3px 3px 10px rgba(99,102,241,0.09), -2px -2px 7px rgba(255,255,255,0.9)',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.background = PRIMARY_LIGHT }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = 'linear-gradient(145deg, #ffffff, #f5f7ff)' }}>
                  {p.full_picture && (
                    <img src={p.full_picture} alt="" style={{
                      width: 48, height: 48, borderRadius: 9, objectFit: 'cover', flexShrink: 0,
                      border: `1px solid ${BORDER}`, boxShadow: SHADOW_SM,
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                      lineHeight: 1.55, color: TEXT, fontWeight: 600,
                    }}>
                      {p.message || p.story || 'ไม่มีข้อความ'}
                    </div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 5, fontWeight: 600 }}>{fmtDate(p.created_time)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — ตั้งค่างบ */}
          {step === 3 && (
            <div>
              <button onClick={() => setStep(2)} style={{
                background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
                marginBottom: 13, fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
              }}>
                <ArrowLeft size={13} /> กลับ
              </button>

              {/* Selected post preview */}
              <div style={{
                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                border: `1.5px solid rgba(67,56,202,0.2)`,
                borderRadius: 13, padding: '11px 15px', marginBottom: 18,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
              }}>
                <p style={{ fontSize: 11, color: PRIMARY, fontWeight: 800, margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>โพสต์ที่เลือก</p>
                <p style={{ fontSize: 13, margin: 0, color: TEXT, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {selectedPost?.message || selectedPost?.story || selectedPost?.id}
                </p>
              </div>

              {/* Budget input */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: MUTED, fontWeight: 700, display: 'block', marginBottom: 7, letterSpacing: '0.03em' }}>
                  งบต่อวัน (บาท)
                </label>
                <input
                  type="number" value={budget} min={20}
                  onChange={e => setBudget(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: SURFACE2,
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 11, color: TEXT, fontSize: 17, fontWeight: 800,
                    boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
                    boxShadow: 'inset 2px 2px 6px rgba(99,102,241,0.08), inset -1px -1px 4px rgba(255,255,255,0.8)',
                    transition: 'border-color 0.18s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = BORDER2}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER}
                />
              </div>

              {/* Days selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: MUTED, fontWeight: 700, display: 'block', marginBottom: 10, letterSpacing: '0.03em' }}>ระยะเวลา</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
                  {[3, 7, 14, 30].map(d => (
                    <button key={d} onClick={() => setDays(d)} style={{
                      padding: '10px 0',
                      border: days === d ? `1.5px solid rgba(67,56,202,0.4)` : `1.5px solid ${BORDER}`,
                      borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                      fontFamily: 'inherit',
                      background: days === d
                        ? 'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)'
                        : 'linear-gradient(145deg, #ffffff, #f0f4ff)',
                      color: days === d ? 'white' : MUTED,
                      boxShadow: days === d
                        ? '0 5px 18px rgba(67,56,202,0.4), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.12)'
                        : '3px 3px 10px rgba(99,102,241,0.1), -2px -2px 7px rgba(255,255,255,0.9)',
                      transition: 'all 0.18s',
                    }}>
                      {d} วัน
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary box */}
              <div style={{
                background: 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)',
                border: `1.5px solid rgba(99,102,241,0.2)`,
                borderRadius: 16, padding: '16px 20px', marginBottom: 22,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 7 }}>
                  <span style={{ fontWeight: 600 }}>งบต่อวัน</span>
                  <span style={{ fontWeight: 700, color: TEXT }}>฿{budget.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>ระยะเวลา</span>
                  <span style={{ fontWeight: 700, color: TEXT }}>{days} วัน</span>
                </div>
                <div style={{ height: 1, background: BORDER, marginBottom: 12 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900 }}>
                  <span style={{ color: TEXT }}>งบรวม</span>
                  <span style={{ color: PRIMARY }}>฿{(budget * days).toLocaleString()}</span>
                </div>
              </div>

              {/* Submit */}
              <button onClick={handleSubmit} disabled={submitting} style={{
                width: '100%', padding: '15px',
                background: submitting
                  ? '#a5b4fc'
                  : 'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)',
                color: 'white', border: 'none', borderRadius: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 16, fontWeight: 900, fontFamily: 'inherit',
                boxShadow: submitting
                  ? 'none'
                  : '0 7px 24px rgba(67,56,202,0.45), 0 2px 8px rgba(67,56,202,0.25), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                transition: 'all 0.2s', letterSpacing: '0.02em',
              }}>
                <Zap size={18} />
                {submitting ? 'กำลังสร้างแอดใน Facebook...' : '⚡ ยิงแอดเลย!'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
