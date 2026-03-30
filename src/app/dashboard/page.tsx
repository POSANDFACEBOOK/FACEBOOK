// src/app/dashboard/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  Zap, TrendingUp, TrendingDown, Eye, MousePointer,
  DollarSign, Users, Plus, RefreshCw, Bell, ChevronRight,
  Play, Pause, Brain, Target, AlertCircle, CheckCircle,
  Clock, BarChart2, Settings, LogOut, ChevronDown, X
} from 'lucide-react'

// ============================================================
// Types
// ============================================================
interface Page { id: string; page_id: string; page_name: string; page_picture?: string; ad_account_id?: string; currency: string }
interface Post { id: string; message?: string; story?: string; full_picture?: string; permalink_url?: string; created_time: string; reactions?: { summary?: { total_count: number } } }
interface Campaign {
  id: string; campaign_name: string; status: string; daily_budget: number
  post_message?: string; post_image?: string; start_time: string; end_time: string
  fb_campaign_id?: string; created_at: string
  latest_perf?: { spend: number; impressions: number; clicks: number; ctr: number; reach: number; cpm: number }
  latest_ai?: { recommendation: string; summary: string; confidence_score: number }
}

const REC_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  keep_running:    { label: 'ปล่อยต่อ',         color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  icon: '✅' },
  increase_budget: { label: 'เพิ่มงบ',           color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', icon: '💰' },
  extend_duration: { label: 'ต่อเวลา',           color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', icon: '⏱️' },
  decrease_budget: { label: 'ลดงบก่อน',          color: '#facc15', bg: 'rgba(250,204,21,0.1)', icon: '⚠️' },
  change_targeting:{ label: 'เปลี่ยน Targeting', color: '#fb923c', bg: 'rgba(251,146,60,0.1)', icon: '🎯' },
  pause_ad:        { label: 'หยุดโฆษณา',         color: '#f87171', bg: 'rgba(248,113,113,0.1)',icon: '🛑' },
}

// ============================================================
// Dashboard Page
// ============================================================
export default function Dashboard() {
  const [pages, setPages] = useState<Page[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [showBoostModal, setShowBoostModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotif, setShowNotif] = useState(false)

  const fetchPages = useCallback(async () => {
    const res = await fetch('/api/pages')
    const data = await res.json()
    if (data.pages) setPages(data.pages)
  }, [])

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/ads')
    const data = await res.json()
    if (data.campaigns) setCampaigns(data.campaigns)
    setLoading(false)
  }, [])

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    const data = await res.json()
    if (data.notifications) setNotifications(data.notifications)
  }, [])

  useEffect(() => {
    fetchPages()
    fetchCampaigns()
    fetchNotifications()
    const interval = setInterval(fetchCampaigns, 5 * 60 * 1000) // refresh ทุก 5 นาที
    return () => clearInterval(interval)
  }, [fetchPages, fetchCampaigns, fetchNotifications])

  const analyzeAd = async (campaignId: string) => {
    setAnalyzing(campaignId)
    await fetch('/api/ai-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    })
    await fetchCampaigns()
    await fetchNotifications()
    setAnalyzing(null)
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + (c.latest_perf?.spend || 0), 0)
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.latest_perf?.impressions || 0), 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.latest_perf?.clicks || 0), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const unreadNotif = notifications.filter(n => !n.is_read).length

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: "'Sarabun', 'Prompt', sans-serif" }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; transition: all 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(99,102,241,0.4); }
        .btn-ghost { background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        .stat-card { padding: 20px; display: flex; flex-direction: column; gap: 6px; }
        .campaign-row:hover { background: rgba(255,255,255,0.03); }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 10px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 20px rgba(99,102,241,0.6); } }
        .live-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse-glow 2s infinite; }
        input, select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e2e8f0; padding: 8px 12px; font-family: inherit; font-size: 13px; width: 100%; outline: none; }
        input:focus, select:focus { border-color: #6366f1; }
        select option { background: #1a1a2e; }
      `}</style>

      {/* Navbar */}
      <nav style={{ padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FB Ads AI</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Notification Bell */}
          <button onClick={() => setShowNotif(!showNotif)} className="btn btn-ghost" style={{ position: 'relative', padding: '8px' }}>
            <Bell size={18} />
            {unreadNotif > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, background: '#ef4444', borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{unreadNotif}</span>
            )}
          </button>

          <button onClick={() => setShowBoostModal(true)} className="btn btn-primary">
            <Plus size={15} /> ยิงแอดใหม่
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'ใช้ไปทั้งหมด', value: `฿${totalSpend.toLocaleString('th',{minimumFractionDigits:2})}`, icon: <DollarSign size={18}/>, color: '#4ade80' },
            { label: 'Impressions', value: totalImpressions.toLocaleString(), icon: <Eye size={18}/>, color: '#60a5fa' },
            { label: 'Clicks', value: totalClicks.toLocaleString(), icon: <MousePointer size={18}/>, color: '#a78bfa' },
            { label: 'แอดที่กำลังวิ่ง', value: activeCampaigns, icon: <BarChart2 size={18}/>, color: '#fb923c' },
          ].map((s, i) => (
            <div key={i} className="card stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Space Mono',monospace" }}>{s.value}</p>
                </div>
                <div style={{ color: s.color, opacity: 0.7 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pages Bar */}
        {pages.length > 0 && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Pages ที่เชื่อมต่อ:</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pages.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPage(selectedPage?.id === p.id ? null : p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                    borderRadius: 999, border: `1px solid ${selectedPage?.id === p.id ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                    background: selectedPage?.id === p.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: selectedPage?.id === p.id ? '#a78bfa' : '#94a3b8',
                    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                  }}
                >
                  {p.page_picture && <img src={p.page_picture} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />}
                  {p.page_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Campaigns Table */}
        <div className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16 }}>Campaigns ทั้งหมด</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="live-dot" />
                <span style={{ fontSize: 11, color: '#4ade80' }}>Live</span>
              </div>
            </div>
            <button onClick={fetchCampaigns} className="btn btn-ghost" style={{ padding: '6px 12px' }}>
              <RefreshCw size={14} /> รีเฟรช
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>กำลังโหลด...</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: 64, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
              <p style={{ color: '#64748b', marginBottom: 16 }}>ยังไม่มีแอดใดๆ</p>
              <button onClick={() => setShowBoostModal(true)} className="btn btn-primary">
                <Plus size={15} /> สร้างแอดแรกเลย
              </button>
            </div>
          ) : (
            <div>
              {campaigns.map(camp => {
                const rec = camp.latest_ai?.recommendation ? REC_CONFIG[camp.latest_ai.recommendation] : null
                const statusColor = { active: '#4ade80', paused: '#facc15', error: '#f87171', draft: '#94a3b8', completed: '#64748b' }[camp.status] || '#94a3b8'

                return (
                  <div
                    key={camp.id}
                    className="campaign-row"
                    style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => setSelectedCampaign(selectedCampaign?.id === camp.id ? null : camp)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Post thumbnail */}
                      <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                        {camp.post_image ? (
                          <img src={camp.post_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📣</div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{camp.campaign_name}</span>
                          <span className="badge" style={{ background: `${statusColor}15`, color: statusColor }}>
                            {camp.status === 'active' ? '🟢' : camp.status === 'paused' ? '⏸️' : camp.status === 'error' ? '❌' : '⚪'} {camp.status}
                          </span>
                          {rec && (
                            <span className="badge" style={{ background: rec.bg, color: rec.color }}>
                              {rec.icon} {rec.label}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                          {camp.post_message || 'ไม่มีข้อความ'}
                        </p>
                      </div>

                      {/* Metrics */}
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        {[
                          { label: 'Spend', value: `฿${(camp.latest_perf?.spend || 0).toFixed(0)}` },
                          { label: 'Reach', value: (camp.latest_perf?.reach || 0).toLocaleString() },
                          { label: 'CTR', value: `${(camp.latest_perf?.ctr || 0).toFixed(2)}%` },
                          { label: 'Budget/Day', value: `฿${camp.daily_budget}` },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, color: '#64748b' }}>{m.label}</p>
                            <p style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Space Mono',monospace" }}>{m.value}</p>
                          </div>
                        ))}

                        {/* AI Analyze button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); analyzeAd(camp.id) }}
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '6px 12px' }}
                          disabled={analyzing === camp.id}
                        >
                          {analyzing === camp.id ? (
                            <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> กำลังวิเคราะห์</>
                          ) : (
                            <><Brain size={13} /> AI วิเคราะห์</>
                          )}
                        </button>

                        <ChevronDown size={16} color="#64748b" style={{ transform: selectedCampaign?.id === camp.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </div>
                    </div>

                    {/* Expanded AI Analysis */}
                    {selectedCampaign?.id === camp.id && camp.latest_ai && (
                      <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <Brain size={16} color="#a78bfa" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>
                              🤖 AI Analysis — ความมั่นใจ {Math.round((camp.latest_ai.confidence_score || 0) * 100)}%
                            </p>
                            <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>{camp.latest_ai.summary}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Boost Modal */}
      {showBoostModal && (
        <BoostModal pages={pages} onClose={() => setShowBoostModal(false)} onSuccess={() => { setShowBoostModal(false); fetchCampaigns() }} />
      )}

      {/* Notifications Panel */}
      {showNotif && (
        <div style={{ position: 'fixed', top: 68, right: 32, width: 360, maxHeight: 480, overflowY: 'auto', background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 100 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>การแจ้งเตือน</span>
            <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>ยังไม่มีการแจ้งเตือน</div>
          ) : notifications.map((n, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: n.is_read ? 0.5 : 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{n.title}</p>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{n.message}</p>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ============================================================
// Boost Modal
// ============================================================
function BoostModal({ pages, onClose, onSuccess }: { pages: Page[]; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'page' | 'post' | 'settings'>('page')
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    campaignName: '',
    dailyBudget: 100,
    days: 7,
    ageMin: 18,
    ageMax: 65,
    genders: [1, 2],
  })

  const fetchPosts = async (page: Page) => {
    setLoadingPosts(true)
    const res = await fetch(`/api/posts?pageId=${page.id}`)
    const data = await res.json()
    setPosts(data.posts || [])
    setLoadingPosts(false)
  }

  const handlePageSelect = (page: Page) => {
    setSelectedPage(page)
    fetchPosts(page)
    setStep('post')
  }

  const handlePostSelect = (post: Post) => {
    setSelectedPost(post)
    setForm(f => ({ ...f, campaignName: `Boost - ${post.message?.slice(0, 40) || post.id}` }))
    setStep('settings')
  }

  const handleSubmit = async () => {
    if (!selectedPage || !selectedPost) return
    setSubmitting(true)

    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + form.days)

    await fetch('/api/ads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageDbId: selectedPage.id,
        postId: selectedPost.id.split('_')[1] || selectedPost.id,
        postMessage: selectedPost.message || selectedPost.story,
        postImage: selectedPost.full_picture,
        campaignName: form.campaignName,
        dailyBudget: form.dailyBudget,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        targeting: {
          ageMin: form.ageMin,
          ageMax: form.ageMax,
          genders: form.genders,
          geoLocations: { countries: ['TH'] },
        },
      }),
    })

    setSubmitting(false)
    onSuccess()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 18 }}>🚀 ยิงแอดใหม่</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {(['page', 'post', 'settings'] as const).map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === s ? '#6366f1' : ((['page','post','settings'].indexOf(step) > i) ? '#4ade80' : 'rgba(255,255,255,0.1)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{i+1}</div>
                  <span style={{ fontSize: 11, color: step === s ? '#a78bfa' : '#64748b' }}>{{ page:'เลือก Page', post:'เลือกโพสต์', settings:'ตั้งค่า' }[s]}</span>
                  {i < 2 && <ChevronRight size={12} color="#334155" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b', cursor: 'pointer', padding: 8, borderRadius: 8 }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* Step 1: เลือก Page */}
          {step === 'page' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>เลือก Page ที่ต้องการยิงแอด</p>
              {pages.map(p => (
                <button key={p.id} onClick={() => handlePageSelect(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', color: '#e2e8f0', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.page_picture ? <img src={p.page_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📄'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{p.page_name}</p>
                    <p style={{ fontSize: 11, color: '#64748b' }}>
                      {p.ad_account_id ? `✅ Ad Account: ${p.ad_account_id}` : '⚠️ ไม่มี Ad Account'}
                    </p>
                  </div>
                  <ChevronRight size={16} color="#64748b" style={{ marginLeft: 'auto' }} />
                </button>
              ))}
            </div>
          )}

          {/* Step 2: เลือกโพสต์ */}
          {step === 'post' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <button onClick={() => setStep('page')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>← กลับ</button>
                <span style={{ fontSize: 13, color: '#64748b' }}>เลือกโพสต์จาก {selectedPage?.page_name}</span>
              </div>
              {loadingPosts ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>กำลังโหลดโพสต์...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {posts.map(post => (
                    <button key={post.id} onClick={() => handlePostSelect(post)}
                      style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', color: '#e2e8f0', fontFamily: 'inherit' }}
                    >
                      {post.full_picture && (
                        <img src={post.full_picture} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {post.message || post.story || 'ไม่มีข้อความ'}
                        </p>
                        <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          ❤️ {post.reactions?.summary?.total_count || 0} · {new Date(post.created_time).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Settings */}
          {step === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setStep('post')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>← กลับ</button>
                <span style={{ fontSize: 13, color: '#64748b' }}>ตั้งค่า Campaign</span>
              </div>

              {/* โพสต์ที่เลือก */}
              {selectedPost && (
                <div style={{ display: 'flex', gap: 10, padding: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                  {selectedPost.full_picture && <img src={selectedPost.full_picture} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />}
                  <p style={{ fontSize: 12, color: '#a78bfa', lineHeight: 1.5 }}>{selectedPost.message?.slice(0, 100) || 'โพสต์ที่เลือก'}...</p>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>ชื่อ Campaign</label>
                <input value={form.campaignName} onChange={e => setForm(f => ({ ...f, campaignName: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>งบต่อวัน (บาท)</label>
                  <input type="number" min={50} value={form.dailyBudget} onChange={e => setForm(f => ({ ...f, dailyBudget: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>ระยะเวลา (วัน)</label>
                  <input type="number" min={1} max={30} value={form.days} onChange={e => setForm(f => ({ ...f, days: Number(e.target.value) }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>อายุต่ำสุด</label>
                  <input type="number" min={18} max={65} value={form.ageMin} onChange={e => setForm(f => ({ ...f, ageMin: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>อายุสูงสุด</label>
                  <input type="number" min={18} max={65} value={form.ageMax} onChange={e => setForm(f => ({ ...f, ageMax: Number(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, display: 'block' }}>เพศ</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ value: 1, label: '👨 ชาย' }, { value: 2, label: '👩 หญิง' }].map(g => (
                    <button key={g.value}
                      onClick={() => setForm(f => ({ ...f, genders: f.genders.includes(g.value) ? f.genders.filter(x => x !== g.value) : [...f.genders, g.value] }))}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${form.genders.includes(g.value) ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, background: form.genders.includes(g.value) ? 'rgba(99,102,241,0.15)' : 'transparent', color: form.genders.includes(g.value) ? '#a78bfa' : '#64748b', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                    >{g.label}</button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>สรุปการตั้งค่า</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>งบรวม</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', fontFamily: "'Space Mono',monospace" }}>฿{(form.dailyBudget * form.days).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>ระยะเวลา</span>
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{form.days} วัน</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'settings' && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-ghost">ยกเลิก</button>
            <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting} style={{ minWidth: 140 }}>
              {submitting ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> กำลังสร้าง...</> : <><Zap size={14} /> ยิงแอดเลย!</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
