'use client'
import { useEffect, useState, ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Pause, Play, Zap, TrendingUp, Users, MousePointer, DollarSign, Activity } from 'lucide-react'

// ─── Design Tokens (Light Hi-Tech) ─────────────────────────────
const BG       = '#eef2ff'
const SURFACE  = '#ffffff'
const SURFACE2 = '#f5f7ff'
const BORDER   = 'rgba(99,102,241,0.13)'
const BORDER2  = 'rgba(99,102,241,0.25)'
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
const BLUE     = '#2563eb'
const BLUE_L   = '#dbeafe'
const CYAN     = '#0891b2'
const CYAN_L   = '#cffafe'

const SHADOW_SM     = '0 2px 8px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.04)'
const SHADOW_MD     = '0 4px 20px rgba(99,102,241,0.12), 0 2px 6px rgba(0,0,0,0.05)'
const SHADOW_LG     = '0 8px 36px rgba(99,102,241,0.16), 0 3px 10px rgba(0,0,0,0.07)'
const SHADOW_RAISED = '4px 4px 14px rgba(99,102,241,0.12), -3px -3px 10px rgba(255,255,255,0.95)'

// Buttons
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)',
  color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer',
  boxShadow: '0 6px 22px rgba(67,56,202,0.42), 0 2px 6px rgba(67,56,202,0.22), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
  fontFamily: 'inherit', fontWeight: 700, transition: 'all 0.18s', letterSpacing: '0.01em',
  display: 'flex', alignItems: 'center', gap: 7,
}
const btnGhost: React.CSSProperties = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f0f4ff 100%)',
  color: MUTED, borderRadius: 10, cursor: 'pointer',
  border: `1.5px solid ${BORDER}`,
  boxShadow: '3px 3px 10px rgba(99,102,241,0.1), -2px -2px 8px rgba(255,255,255,0.9)',
  fontFamily: 'inherit', transition: 'all 0.18s',
  display: 'flex', alignItems: 'center', gap: 6,
}

const recConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  keep_running:     { label: 'ปล่อยต่อไปเลย',      color: GREEN,    bg: GREEN_L,    border: 'rgba(5,150,105,0.25)',   icon: '✅' },
  increase_budget:  { label: 'เพิ่มงบได้เลย',       color: BLUE,     bg: BLUE_L,     border: 'rgba(37,99,235,0.25)',   icon: '💰' },
  extend_duration:  { label: 'ต่อระยะเวลา',         color: CYAN,     bg: CYAN_L,     border: 'rgba(8,145,178,0.25)',   icon: '⏱️' },
  decrease_budget:  { label: 'ลดงบก่อน',            color: YELLOW,   bg: YELLOW_L,   border: 'rgba(217,119,6,0.25)',   icon: '⚠️' },
  change_targeting: { label: 'เปลี่ยน Targeting',   color: '#ea580c', bg: '#ffedd5', border: 'rgba(234,88,12,0.25)',  icon: '🎯' },
  pause_ad:         { label: 'หยุดโฆษณา',           color: RED,      bg: RED_L,      border: 'rgba(220,38,38,0.25)',   icon: '🛑' },
}

function fmt(n: number | string | undefined, decimals = 0) {
  if (n === undefined || n === null || n === '') return '—'
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: decimals })
}
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [campaign, setCampaign] = useState<any>(null)
  const [perf, setPerf] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/ads/${id}`)
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'โหลดข้อมูลไม่ได้'); return }
      setCampaign(data.campaign)
      setPerf(data.latestPerf)
      setAnalysis(data.latestAnalysis)
    } catch {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true); setError('')
    try {
      const res = await fetch(`/api/ads/${id}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setPerf(data.performance)
      showToast('✅ ซิงค์ข้อมูลสำเร็จ')
    } catch (err: any) { setError(err.message) }
    finally { setSyncing(false) }
  }

  async function handleAnalyze() {
    setAnalyzing(true); setError('')
    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setAnalysis(data.analysis)
      showToast('🤖 AI วิเคราะห์เสร็จแล้ว')
    } catch (err: any) { setError(err.message) }
    finally { setAnalyzing(false) }
  }

  async function handleToggle() {
    if (!campaign) return
    setToggling(true); setError('')
    const action = campaign.status === 'active' ? 'pause' : 'resume'
    try {
      const res = await fetch(`/api/ads/${id}/pause`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setCampaign((prev: any) => ({ ...prev, status: data.status }))
      showToast(action === 'pause' ? '⏸ หยุดแอดแล้ว' : '▶️ เปิดแอดแล้ว')
    } catch (err: any) { setError(err.message) }
    finally { setToggling(false) }
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  // ── Loading / Error states ──
  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: MUTED }}>
        <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.5 }}>⏳</div>
        <p style={{ fontWeight: 600, fontSize: 14 }}>กำลังโหลด...</p>
      </div>
    </div>
  )

  if (error && !campaign) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>⚠️</div>
        <p style={{ color: RED, marginBottom: 18, fontSize: 14, fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.push('/dashboard')} style={{ ...btnPrimary, padding: '11px 24px', fontSize: 14 }}>
          กลับ Dashboard
        </button>
      </div>
    </div>
  )

  const c = campaign
  const isActive = c?.status === 'active'
  const statusColor = isActive ? GREEN : c?.status === 'paused' ? YELLOW : MUTED
  const statusBg    = isActive ? GREEN_L : c?.status === 'paused' ? YELLOW_L : '#f1f5f9'
  const statusLabel = isActive ? '● กำลังวิ่ง' : c?.status === 'paused' ? '⏸ หยุดชั่วคราว' : c?.status

  const rec        = analysis?.recommendation ? recConfig[analysis.recommendation] : null
  const confidence = analysis?.confidence_score ? Math.round(analysis.confidence_score * 100) : null

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Sarabun', sans-serif", position: 'relative' }}>

      {/* Tech grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.045) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />
      <div style={{ position: 'fixed', top: '-6%', right: '-4%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 22, left: '50%', transform: 'translateX(-50%)',
          background: SURFACE, border: `1.5px solid ${BORDER2}`,
          borderRadius: 12, padding: '10px 22px',
          fontSize: 13, fontWeight: 700, color: TEXT,
          zIndex: 300, boxShadow: SHADOW_LG,
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        borderBottom: `1.5px solid ${BORDER}`,
        padding: '13px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        zIndex: 50,
        boxShadow: '0 2px 16px rgba(99,102,241,0.08)',
      }}>
        <button onClick={() => router.push('/dashboard')} style={{
          ...btnGhost, padding: '7px 14px', fontSize: 13, fontWeight: 700,
        }}>
          <ArrowLeft size={14} /> กลับ
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT, letterSpacing: '-0.2px' }}>
            📌 {c?.campaign_name}
          </h1>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, color: statusColor, background: statusBg,
          padding: '4px 13px', borderRadius: 999, flexShrink: 0,
          border: `1px solid ${statusColor}30`,
          boxShadow: `1px 1px 4px ${statusColor}20`,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 820, margin: '0 auto', padding: '26px 20px' }}>

        {error && (
          <div style={{
            background: RED_L, border: `1.5px solid rgba(220,38,38,0.25)`,
            borderRadius: 10, padding: '10px 15px', marginBottom: 18,
            fontSize: 13, color: RED, fontWeight: 600,
          }}>
            ❌ {error}
          </div>
        )}

        {/* Campaign Info Card */}
        <div style={{
          background: SURFACE, border: `1.5px solid ${BORDER}`,
          borderRadius: 18, padding: '18px 22px', marginBottom: 18,
          boxShadow: SHADOW_RAISED,
        }}>
          {/* Accent top bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${PRIMARY}, #818cf8)`, borderRadius: '18px 18px 0 0', pointerEvents: 'none' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13, marginBottom: 16 }}>
            <InfoRow label="Page" value={c?.connected_pages?.page_name} />
            <InfoRow label="งบ/วัน" value={`฿${fmt(c?.daily_budget)}`} bold />
            <InfoRow label="เริ่ม" value={fmtDate(c?.start_time)} />
            <InfoRow label="สิ้นสุด" value={fmtDate(c?.end_time)} />
            {c?.fb_campaign_id && (
              <div style={{ gridColumn: '1/-1' }}>
                <span style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>FB Campaign ID: </span>
                <span style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{c.fb_campaign_id}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={handleSync} disabled={syncing} style={{
              ...btnGhost, padding: '9px 16px', fontSize: 12, fontWeight: 700,
              opacity: syncing ? 0.6 : 1, cursor: syncing ? 'not-allowed' : 'pointer',
            }}>
              <RefreshCw size={13} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
              {syncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูล'}
            </button>

            <button onClick={handleAnalyze} disabled={analyzing} style={{
              ...btnGhost, padding: '9px 16px', fontSize: 12, fontWeight: 700,
              border: `1.5px solid rgba(99,102,241,0.25)`,
              color: PRIMARY,
              background: analyzing ? SURFACE2 : 'linear-gradient(145deg, #f0eeff, #e0e7ff)',
              opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
            }}>
              <Zap size={13} color={PRIMARY} />
              {analyzing ? 'AI กำลังวิเคราะห์...' : 'วิเคราะห์ด้วย AI'}
            </button>

            {c?.fb_campaign_id && (
              <button onClick={handleToggle} disabled={toggling} style={{
                ...btnGhost,
                padding: '9px 16px', fontSize: 12, fontWeight: 700,
                marginLeft: 'auto',
                border: `1.5px solid ${isActive ? 'rgba(217,119,6,0.3)' : 'rgba(5,150,105,0.3)'}`,
                color: isActive ? YELLOW : GREEN,
                background: isActive ? 'linear-gradient(145deg, #fffbeb, #fef3c7)' : 'linear-gradient(145deg, #f0fdf4, #d1fae5)',
                opacity: toggling ? 0.7 : 1, cursor: toggling ? 'not-allowed' : 'pointer',
              }}>
                {isActive ? <Pause size={13} /> : <Play size={13} />}
                {toggling ? 'กำลังดำเนินการ...' : isActive ? 'หยุดแอด' : 'เปิดแอดอีกครั้ง'}
              </button>
            )}
          </div>
        </div>

        {/* ── Performance ── */}
        <SectionLabel icon="📊" text="Performance" />
        {perf ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 11, marginBottom: 11 }}>
              <MetricCard label="Impressions" value={fmt(perf.impressions)} icon={<Activity size={14} />} color={PRIMARY} bg="#ede9fe" />
              <MetricCard label="Reach"       value={fmt(perf.reach)}       icon={<Users size={14} />}       color={BLUE}    bg={BLUE_L} />
              <MetricCard label="Clicks"      value={fmt(perf.clicks)}      icon={<MousePointer size={14} />} color={CYAN}   bg={CYAN_L} />
              <MetricCard label="CTR"         value={`${fmt(perf.ctr, 2)}%`} icon={<TrendingUp size={14} />}
                color={perf.ctr >= 1.5 ? GREEN : perf.ctr >= 0.8 ? YELLOW : RED}
                bg={perf.ctr >= 1.5 ? GREEN_L : perf.ctr >= 0.8 ? YELLOW_L : RED_L} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 11, marginBottom: 18 }}>
              <MetricCard label="ยอดใช้จ่าย" value={`฿${fmt(perf.spend, 2)}`}    icon={<DollarSign size={14} />} color={GREEN}  bg={GREEN_L} />
              <MetricCard label="CPM"         value={`฿${fmt(perf.cpm, 2)}`}      icon={<DollarSign size={14} />}
                color={perf.cpm <= 80 ? GREEN : perf.cpm <= 150 ? YELLOW : RED}
                bg={perf.cpm <= 80 ? GREEN_L : perf.cpm <= 150 ? YELLOW_L : RED_L} />
              <MetricCard label="CPC"         value={`฿${fmt(perf.cpc, 2)}`}      icon={<DollarSign size={14} />}
                color={perf.cpc <= 5 ? GREEN : perf.cpc <= 15 ? YELLOW : RED}
                bg={perf.cpc <= 5 ? GREEN_L : perf.cpc <= 15 ? YELLOW_L : RED_L} />
              <MetricCard label="Frequency"   value={fmt(perf.frequency, 2)} icon={<Activity size={14} />}
                color={perf.frequency <= 3 ? GREEN : perf.frequency <= 5 ? YELLOW : RED}
                bg={perf.frequency <= 3 ? GREEN_L : perf.frequency <= 5 ? YELLOW_L : RED_L} />
            </div>

            {/* Engagement */}
            <div style={{
              background: SURFACE, border: `1.5px solid ${BORDER}`,
              borderRadius: 16, padding: '16px 20px', marginBottom: 16,
              boxShadow: SHADOW_RAISED,
            }}>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>❤️ Engagement</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                {[
                  { label: 'Likes',    value: perf.likes,    emoji: '👍' },
                  { label: 'Comments', value: perf.comments, emoji: '💬' },
                  { label: 'Shares',   value: perf.shares,   emoji: '↗️' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: SURFACE2, borderRadius: 12, padding: '12px 8px',
                    border: `1px solid ${BORDER}`,
                    boxShadow: '2px 2px 8px rgba(99,102,241,0.07), -1px -1px 5px rgba(255,255,255,0.9)',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{item.emoji}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>{fmt(item.value)}</div>
                    <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 11, color: MUTED, marginBottom: 18, fontWeight: 500 }}>
              🕐 อัปเดตล่าสุด: {perf.fetched_at ? new Date(perf.fetched_at).toLocaleString('th-TH') : '—'}
            </p>
          </>
        ) : (
          <div style={{
            background: SURFACE, border: `1.5px solid ${BORDER}`,
            borderRadius: 16, padding: '36px 24px', textAlign: 'center', marginBottom: 18,
            boxShadow: SHADOW_MD,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📈</div>
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 16, fontWeight: 600 }}>ยังไม่มีข้อมูล performance</p>
            <button onClick={handleSync} disabled={syncing} style={{ ...btnPrimary, padding: '10px 22px', fontSize: 13 }}>
              <RefreshCw size={14} />
              {syncing ? 'กำลังโหลด...' : 'ซิงค์จาก Facebook'}
            </button>
          </div>
        )}

        {/* ── AI Analysis ── */}
        <SectionLabel icon="🤖" text="AI Analysis" />
        {analysis ? (
          <div style={{
            background: rec ? rec.bg : SURFACE2,
            border: `1.5px solid ${rec ? rec.border : BORDER}`,
            borderRadius: 18, padding: '20px 22px',
            boxShadow: rec ? `0 4px 20px ${rec.color}18, 0 1px 4px rgba(0,0,0,0.04)` : SHADOW_MD,
          }}>
            {/* Rec badge + re-analyze btn */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>{rec?.icon}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: rec?.color || TEXT, letterSpacing: '-0.2px' }}>{rec?.label}</div>
                  {confidence !== null && (
                    <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 2 }}>ความมั่นใจ {confidence}%</div>
                  )}
                </div>
              </div>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...btnGhost, padding: '7px 13px', fontSize: 11, fontWeight: 700,
                opacity: analyzing ? 0.6 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
              }}>
                <RefreshCw size={11} />
                {analyzing ? 'กำลังวิเคราะห์' : 'วิเคราะห์ใหม่'}
              </button>
            </div>

            {/* Summary */}
            {analysis.summary && (
              <div style={{
                fontSize: 14, fontWeight: 600, marginBottom: 14, lineHeight: 1.7,
                color: TEXT, background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '10px 14px',
                border: `1px solid rgba(255,255,255,0.8)`,
              }}>
                {analysis.summary}
              </div>
            )}

            {/* Confidence bar */}
            {confidence !== null && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginBottom: 5, fontWeight: 700 }}>
                  <span>Confidence Score</span><span>{confidence}%</span>
                </div>
                <div style={{
                  height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden',
                  boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.08)',
                }}>
                  <div style={{
                    height: '100%', width: `${confidence}%`,
                    background: `linear-gradient(90deg, ${rec?.color || PRIMARY}, ${PRIMARY2})`,
                    borderRadius: 3,
                    boxShadow: `0 0 8px ${rec?.color || PRIMARY}50`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Reasoning */}
            {analysis.reasoning && (
              <details style={{ marginBottom: 14 }}>
                <summary style={{
                  fontSize: 12, color: MUTED, cursor: 'pointer', fontWeight: 700,
                  padding: '6px 0', userSelect: 'none',
                }}>▸ เหตุผลเพิ่มเติม</summary>
                <div style={{
                  fontSize: 13, color: TEXT, lineHeight: 1.75, marginTop: 10,
                  padding: '10px 14px', background: 'rgba(255,255,255,0.6)',
                  borderRadius: 10, border: `1px solid rgba(255,255,255,0.8)`,
                }}>{analysis.reasoning}</div>
              </details>
            )}

            {/* Action Items */}
            {analysis.action_items?.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: MUTED, marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 สิ่งที่ต้องทำ</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {analysis.action_items.map((item: string, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13,
                      background: 'rgba(255,255,255,0.6)', borderRadius: 9, padding: '8px 12px',
                      border: `1px solid rgba(255,255,255,0.8)`,
                    }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: rec?.color || PRIMARY, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 900, marginTop: 1,
                      }}>{i + 1}</span>
                      <span style={{ color: TEXT, lineHeight: 1.6, fontWeight: 500 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.created_at && (
              <p style={{ fontSize: 11, color: MUTED, marginTop: 14, marginBottom: 0, fontWeight: 500 }}>
                🕐 วิเคราะห์เมื่อ: {new Date(analysis.created_at).toLocaleString('th-TH')}
              </p>
            )}
          </div>
        ) : (
          <div style={{
            background: SURFACE, border: `1.5px solid ${BORDER}`,
            borderRadius: 18, padding: '40px 24px', textAlign: 'center',
            boxShadow: SHADOW_MD,
          }}>
            <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.5 }}>🤖</div>
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 18, fontWeight: 600 }}>ยังไม่มีการวิเคราะห์</p>
            <button onClick={handleAnalyze} disabled={analyzing} style={{
              ...btnPrimary, padding: '11px 26px', fontSize: 14,
              opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
            }}>
              <Zap size={16} />
              {analyzing ? '⏳ กำลังวิเคราะห์...' : 'วิเคราะห์ด้วย AI เลย'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────
function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  )
}

function InfoRow({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  return (
    <div style={{ fontSize: 13 }}>
      <span style={{ color: MUTED, fontWeight: 600 }}>{label}: </span>
      <span style={{ color: TEXT, fontWeight: bold ? 800 : 600 }}>{value || '—'}</span>
    </div>
  )
}

function MetricCard({ label, value, icon, color, bg }: { label: string; value: string; icon: ReactNode; color: string; bg: string }) {
  return (
    <div style={{
      background: SURFACE, border: `1.5px solid ${BORDER}`,
      borderRadius: 14, padding: '13px 15px',
      boxShadow: SHADOW_RAISED,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: color, borderRadius: '14px 14px 0 0', opacity: 0.7,
      }} />
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: bg, borderRadius: 8, padding: '5px 6px', color, marginBottom: 7,
        boxShadow: `1px 1px 5px ${color}20`,
      }}>{icon}</div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 3, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}
