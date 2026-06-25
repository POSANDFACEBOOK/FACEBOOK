'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Copy, Check, X, Link2, MessageSquare } from 'lucide-react'

const BG = '#eaf2fd', SURFACE = '#ffffff', SURFACE2 = '#f0f6ff'
const BORDER = 'rgba(24,119,242,0.13)'
const TEXT = '#1a1f3c', MUTED = '#6b7280'
const PRIMARY = '#1877f2', PRIMARY_LIGHT = '#eaf2fd'
const GREEN = '#059669', GREEN_L = '#d1fae5'
const RED = '#dc2626', RED_L = '#fee2e2'
const LINE_GREEN = '#06c755'

type Channel = { id: string; page_id: string; page_name: string; page_picture: string | null; channel: 'facebook' | 'line' }

export default function ChannelsPage() {
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [origin, setOrigin] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [checking, setChecking] = useState(false)
  const [health, setHealth] = useState<any[] | null>(null)

  async function runHealthCheck() {
    setChecking(true)
    try {
      const res = await fetch('/api/line/health').then(r => r.json())
      setHealth(res.results || [])
    } catch {
      setHealth([])
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const me = await fetch('/api/me').then(r => r.json())
      if (!me?.role?.isOwner) { setForbidden(true); return }
      const res = await fetch('/api/team/pages').then(r => r.json())
      setChannels(res.pages || [])
    } finally {
      setLoading(false)
    }
  }

  async function disconnectLine(id: string, name: string) {
    if (!confirm(`ยกเลิกการเชื่อม LINE "${name}"?`)) return
    const res = await fetch(`/api/line/connect?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert('ยกเลิกไม่สำเร็จ: ' + (d.error || '')); return }
    load()
  }

  const fbPages = channels.filter(c => c.channel !== 'line')
  const lineChannels = channels.filter(c => c.channel === 'line')

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Sarabun', sans-serif", padding: 40 }}>
        <div style={{ maxWidth: 460, margin: '60px auto', background: SURFACE, borderRadius: 22, padding: 36, textAlign: 'center', border: `1.5px solid ${BORDER}` }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: TEXT, margin: '0 0 8px' }}>เฉพาะเจ้าของเพจ</h1>
          <Link href="/dashboard" style={{ color: PRIMARY, fontWeight: 800, textDecoration: 'none' }}>← กลับ Dashboard</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Sarabun', sans-serif", color: MUTED, fontWeight: 700 }}>กำลังโหลด...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Sarabun', sans-serif", padding: '24px 20px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <button
            className="fbtap"
            onClick={() => setShowAdd(true)}
            style={{ padding: '12px 22px', fontSize: 13.5, fontWeight: 900, background: LINE_GREEN, color: 'white', border: 'none', borderRadius: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 18px rgba(6,199,85,0.4)' }}
          >
            <Plus size={16} /> เชื่อม LINE OA
          </button>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={26} color={PRIMARY} /> ช่องทางแชท
        </h1>
        <p style={{ color: MUTED, fontSize: 13, fontWeight: 600, margin: '0 0 22px' }}>
          รวมทุกช่องทางมาตอบในระบบเดียว — Facebook + LINE
        </p>

        {/* LINE */}
        <section style={{ background: SURFACE, borderRadius: 18, padding: 22, border: `1.5px solid ${BORDER}`, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: LINE_GREEN, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>L</span>
              LINE Official Account ({lineChannels.length})
            </h2>
            {lineChannels.length > 0 && (
              <button
                className="fbtap"
                onClick={runHealthCheck}
                disabled={checking}
                style={{ padding: '9px 16px', fontSize: 12.5, fontWeight: 800, background: checking ? '#94a3b8' : PRIMARY, color: 'white', border: 'none', borderRadius: 11, cursor: checking ? 'wait' : 'pointer', fontFamily: 'inherit' }}
              >
                {checking ? 'กำลังตรวจ...' : '🔍 ตรวจสอบการเชื่อมต่อทั้งหมด'}
              </button>
            )}
          </div>

          {/* ผลตรวจสุขภาพ LINE */}
          {health && (
            <div style={{ marginBottom: 16 }}>
              {health.length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED }}>ไม่พบ LINE OA ให้ตรวจ</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: TEXT, marginBottom: 8 }}>
                    ผลตรวจ: ✅ พร้อมใช้ {health.filter(h => h.ok).length}/{health.length} · ⚠️ ต้องแก้ {health.filter(h => !h.ok).length}
                  </div>
                  {health.map((h: any) => {
                    const fix = !h.tokenOk ? 'Token ใช้ไม่ได้ — เชื่อม LINE ใหม่ (token อาจหมดอายุ)'
                      : !h.urlOk ? `ยังไม่ตั้ง Webhook URL ใน LINE Developers (ต้องลงท้าย /api/webhooks/line)${h.webhookUrl ? ` — ตอนนี้เป็น: ${h.webhookUrl}` : ''}`
                      : !h.useWebhook ? "เปิด 'Use webhook' ใน LINE Developers → Messaging API"
                      : h.testPass === false ? `ทดสอบส่งไม่ผ่าน (${h.testDetail || ''}) — เช็ค URL/Use webhook อีกครั้ง`
                      : ''
                    return (
                      <div key={h.id} style={{ border: `1.5px solid ${h.ok ? 'rgba(5,150,105,0.3)' : 'rgba(217,119,6,0.35)'}`, background: h.ok ? '#f0fdf4' : '#fff7ed', borderRadius: 12, padding: '10px 13px', marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, color: TEXT }}>
                          {h.ok ? '✅' : '⚠️'} {h.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11.5, marginTop: 6, color: TEXT, fontWeight: 600 }}>
                          <span>{h.tokenOk ? '✅' : '❌'} Token</span>
                          <span>{h.urlOk ? '✅' : '❌'} Webhook URL</span>
                          <span>{h.useWebhook ? '✅' : '❌'} Use webhook</span>
                          <span>{h.testPass === true ? '✅' : h.testPass === false ? '❌' : '—'} ทดสอบส่งถึงระบบ</span>
                        </div>
                        {fix && <div style={{ fontSize: 11.5, color: '#9a3412', marginTop: 6, lineHeight: 1.5, wordBreak: 'break-word' }}>👉 {fix}</div>}
                      </div>
                    )
                  })}
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
                    หมายเหตุ: ถ้าทุกข้อ ✅ แล้วลูกค้ายังทักไม่เข้า ให้เช็คใน <strong>LINE OA Manager → Response settings</strong> ว่าเปิด <strong>Webhooks</strong> + ปิด <strong>ตอบกลับอัตโนมัติ</strong> (จุดนี้ API เช็คแทนไม่ได้)
                  </div>
                </>
              )}
            </div>
          )}

          {lineChannels.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>
              ยังไม่ได้เชื่อม LINE — กด "เชื่อม LINE OA" เพื่อเริ่ม
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lineChannels.map(c => (
                <div key={c.id} className="fbpop" style={{ display: 'flex', alignItems: 'center', gap: 12, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 14px' }}>
                  {c.page_picture ? (
                    <img src={c.page_picture} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${LINE_GREEN}` }} />
                  ) : (
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: LINE_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16 }}>L</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.page_name}</div>
                    <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>● เชื่อมต่อแล้ว</div>
                  </div>
                  <button onClick={() => disconnectLine(c.id, c.page_name)} title="ยกเลิกการเชื่อม" style={{ padding: '7px 9px', background: RED_L, color: RED, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Facebook (read-only) */}
        <section style={{ background: SURFACE, borderRadius: 18, padding: 22, border: `1.5px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: '#1877f2', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>f</span>
            Facebook Pages ({fbPages.length})
          </h2>
          {fbPages.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: MUTED, fontSize: 12 }}>เชื่อมเพจ Facebook ผ่านการ login ด้วย Facebook</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {fbPages.map(p => (
                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: SURFACE2, border: `1px solid ${BORDER}`, padding: '6px 11px', borderRadius: 999, color: TEXT, fontWeight: 700 }}>
                  {p.page_picture ? <img src={p.page_picture} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} /> : '📄'}
                  {p.page_name}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {showAdd && <AddLineModal origin={origin} onClose={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddLineModal({ origin, onClose }: { origin: string; onClose: () => void }) {
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ name: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const webhookUrl = `${origin}/api/webhooks/line`

  function addAnother() {
    setToken(''); setSecret(''); setDone(null); setCopied(false)
  }

  async function connect() {
    if (!token.trim() || !secret.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/line/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token.trim(), channelSecret: secret.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { alert('เชื่อมไม่สำเร็จ: ' + (data.error || '')); return }
      setAddedCount(c => c + 1)
      setDone({ name: data.channel?.page_name || 'LINE OA' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, borderRadius: 20, padding: 26, width: '100%', maxWidth: 480, maxHeight: '92dvh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(15,23,42,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: LINE_GREEN, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>L</span>
            เชื่อม LINE OA{addedCount > 0 ? ` · เพิ่มแล้ว ${addedCount}` : ''}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={20} /></button>
        </div>

        {!done ? (
          <>
            <div style={{ background: PRIMARY_LIGHT, borderRadius: 10, padding: '11px 13px', marginBottom: 14, fontSize: 11.5, color: '#0b5fcc', lineHeight: 1.7 }}>
              <strong>หาค่าได้ที่:</strong> developers.line.biz → เลือก Provider → Channel (Messaging API)<br />
              • <strong>Channel access token</strong>: แท็บ "Messaging API" → Issue/Long-lived token<br />
              • <strong>Channel secret</strong>: แท็บ "Basic settings"<br />
              <span style={{ color: LINE_GREEN, fontWeight: 800 }}>มีหลาย LINE? เชื่อมทีละอันได้เลย — กรอกของ LINE แรก กด "เชื่อมต่อ" แล้วกด "เพิ่ม LINE อีกอัน"</span>
            </div>

            <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 6 }}>Channel access token <span style={{ color: RED }}>*</span></label>
            <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="วาง long-lived channel access token" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ width: '100%', padding: '11px 13px', fontSize: 13, border: `1.5px solid ${BORDER}`, borderRadius: 11, fontFamily: 'monospace', background: SURFACE2, boxSizing: 'border-box', marginBottom: 12 }} />

            <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 6 }}>Channel secret <span style={{ color: RED }}>*</span></label>
            <input type="text" value={secret} onChange={e => setSecret(e.target.value)} placeholder="วาง channel secret" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ width: '100%', padding: '11px 13px', fontSize: 13, border: `1.5px solid ${BORDER}`, borderRadius: 11, fontFamily: 'monospace', background: SURFACE2, boxSizing: 'border-box', marginBottom: 18 }} />

            <button
              className="fbtap"
              onClick={connect}
              disabled={!token.trim() || !secret.trim() || saving}
              style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 900, background: (!token.trim() || !secret.trim() || saving) ? '#94a3b8' : LINE_GREEN, color: 'white', border: 'none', borderRadius: 12, cursor: (!token.trim() || !secret.trim() || saving) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <Link2 size={16} /> {saving ? 'กำลังเชื่อม...' : 'เชื่อมต่อ'}
            </button>
          </>
        ) : (
          <>
            <div style={{ background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.25)', borderRadius: 14, padding: 14, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 26 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#065f46' }}>เชื่อม "{done.name}" สำเร็จ</div>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 10, padding: '11px 13px', marginBottom: 12, fontSize: 12, color: '#92400e', lineHeight: 1.7 }}>
              <strong>⚠️ อีก 1 ขั้นตอน:</strong> เอา Webhook URL นี้ไปวางใน LINE Developers Console → Messaging API → <strong>Webhook URL</strong> แล้วกด <strong>Verify</strong> + เปิด <strong>Use webhook</strong><br />
              <span style={{ fontWeight: 800 }}>ใช้ URL เดียวกันนี้กับทุก LINE OA ได้เลย</span> (ระบบแยกแต่ละ OA ให้อัตโนมัติ)
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <input type="text" readOnly value={webhookUrl} onFocus={e => e.target.select()}
                style={{ flex: 1, padding: '10px 12px', fontSize: 12, border: `1.5px solid ${BORDER}`, borderRadius: 10, fontFamily: 'monospace', background: SURFACE2, boxSizing: 'border-box', minWidth: 0 }} />
              <button onClick={async () => { try { await navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }}
                style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, background: copied ? GREEN_L : PRIMARY_LIGHT, color: copied ? GREEN : PRIMARY, border: `1.5px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                {copied ? <><Check size={13} /> คัดลอก</> : <><Copy size={13} /> คัดลอก</>}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addAnother} className="fbtap"
                style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 900, background: LINE_GREEN, color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={15} /> เพิ่ม LINE อีกอัน
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 800, background: SURFACE2, color: TEXT, border: `1.5px solid ${BORDER}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>เสร็จสิ้น</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
