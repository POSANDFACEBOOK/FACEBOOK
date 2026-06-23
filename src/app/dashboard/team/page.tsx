'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Trash2, Copy, Check, Users, X, ExternalLink, Link2, Clock, Mail, Key, RefreshCw } from 'lucide-react'

const BG = '#eaf2fd', SURFACE = '#ffffff', SURFACE2 = '#f0f6ff'
const BORDER = 'rgba(24,119,242,0.13)'
const TEXT = '#1a1f3c', MUTED = '#6b7280'
const PRIMARY = '#1877f2', PRIMARY_LIGHT = '#eaf2fd'
const GREEN = '#059669', GREEN_L = '#d1fae5'
const RED = '#dc2626', RED_L = '#fee2e2'
const YELLOW = '#d97706', YELLOW_L = '#fef3c7'

type Page = { id: string; page_name: string; page_picture: string | null }
type Member = {
  userId: string; name: string; image: string | null; email: string | null
  role: string; joinedAt: string
  pages: { pageId: string; pageName: string; pagePicture: string | null }[]
}
type Invitation = {
  id: string; token: string; role: string
  page_ids: string[]; note: string | null
  expires_at: string
  accepted_at: string | null; revoked_at: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  pages: { page_name: string; page_picture: string | null }[]
  acceptedUser: { name: string; image: string | null } | null
  created_at: string
  auth_method: 'facebook' | 'credentials'
  invitee_email: string | null
  invitee_name: string | null
}

export default function TeamPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const meRes = await fetch('/api/me').then(r => r.json())
      if (!meRes?.role?.isOwner) {
        setForbidden(true)
        setLoading(false)
        return
      }
      const [pagesRes, membersRes, invitesRes] = await Promise.all([
        fetch('/api/team/pages').then(r => r.json()),
        fetch('/api/team/members').then(r => r.json()),
        fetch('/api/team/invitations').then(r => r.json()),
      ])
      setPages(pagesRes.pages || [])
      setMembers(membersRes.members || [])
      setInvitations(invitesRes.invitations || [])
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(member: Member, pageId?: string) {
    const msg = pageId
      ? `ถอนสิทธิ์ ${member.name} จากเพจนี้?`
      : `ถอน ${member.name} ออกจากทีม (ทุกเพจ)?`
    if (!confirm(msg)) return
    const url = `/api/team/members?userId=${member.userId}${pageId ? '&pageId=' + pageId : ''}`
    const res = await fetch(url, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || !data.success) {
      alert('ลบไม่สำเร็จ: ' + (data.error || 'unknown'))
      return
    }
    loadAll()
  }

  async function handleRevokeInvite(invId: string) {
    if (!confirm('ยกเลิกคำเชิญนี้?')) return
    const res = await fetch(`/api/team/invitations?id=${invId}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert('ยกเลิกไม่สำเร็จ: ' + (d.error || 'unknown'))
      return
    }
    loadAll()
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Sarabun', sans-serif", padding: 40 }}>
        <div style={{ maxWidth: 460, margin: '60px auto', background: SURFACE, borderRadius: 22, padding: 36, textAlign: 'center', border: `1.5px solid ${BORDER}` }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: TEXT, margin: '0 0 8px' }}>ไม่มีสิทธิ์เข้าหน้านี้</h1>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 22 }}>เฉพาะเจ้าของเพจเท่านั้น</p>
          <Link href="/dashboard" style={{ color: PRIMARY, fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>← กลับ Dashboard</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Sarabun', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: MUTED, fontWeight: 700 }}>กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Sarabun', sans-serif", padding: '24px 20px 60px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <button
            className="fbtap"
            onClick={() => setShowInvite(true)}
            style={{
              padding: '12px 24px', fontSize: 13.5, fontWeight: 900,
              background: 'linear-gradient(135deg, #1877f2 0%, #2e89ff 55%, #5fa3ff 100%)',
              color: 'white', border: 'none', borderRadius: 13, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 6px 22px rgba(11,95,204,0.42), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <UserPlus size={16} /> เชิญแอดมินใหม่
          </button>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={26} color={PRIMARY} /> จัดการทีม
        </h1>
        <p style={{ color: MUTED, fontSize: 13, fontWeight: 600, margin: '0 0 22px' }}>
          เพิ่มแอดมินตอบแชท และกำหนดสิทธิ์ดูแลเพจที่ต้องการ
        </p>

        {/* Members */}
        <section style={{
          background: SURFACE, borderRadius: 18, padding: 22, border: `1.5px solid ${BORDER}`,
          marginBottom: 18, boxShadow: '4px 4px 14px rgba(24,119,242,0.08), -3px -3px 10px rgba(255,255,255,0.95)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>สมาชิกในทีม ({members.length})</h2>
          </div>

          {members.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: MUTED, fontSize: 13 }}>
              <Users size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontWeight: 700 }}>ยังไม่มีแอดมินในทีม</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>กดปุ่ม "เชิญแอดมินใหม่" เพื่อเริ่ม</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map(m => (
                <div key={m.userId} className="fbpop" style={{
                  background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: m.pages.length > 0 ? 10 : 0 }}>
                    {m.image ? (
                      <img src={m.image} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16 }}>
                        {m.name[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: TEXT }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
                        {m.email || '—'} · เข้าร่วมเมื่อ {new Date(m.joinedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', background: PRIMARY_LIGHT, color: PRIMARY, fontWeight: 800, borderRadius: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {m.role}
                    </span>
                    <button
                      onClick={() => handleRemove(m)}
                      title="ลบจากทีมทั้งหมด"
                      style={{
                        padding: '7px 9px', background: RED_L, color: RED,
                        border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {m.pages.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 56 }}>
                      {m.pages.map(p => (
                        <span key={p.pageId} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, background: 'white', border: `1px solid ${BORDER}`,
                          padding: '4px 9px', borderRadius: 7, color: TEXT, fontWeight: 700,
                        }}>
                          {p.pagePicture ? (
                            <img src={p.pagePicture} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                          ) : '📄'}
                          {p.pageName}
                          <button onClick={() => handleRemove(m, p.pageId)} title="ถอนสิทธิ์เพจนี้" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, marginLeft: 2, display: 'flex' }}>
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Invitations */}
        <section style={{
          background: SURFACE, borderRadius: 18, padding: 22, border: `1.5px solid ${BORDER}`,
          boxShadow: '4px 4px 14px rgba(24,119,242,0.08), -3px -3px 10px rgba(255,255,255,0.95)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 14px' }}>คำเชิญทั้งหมด ({invitations.length})</h2>

          {invitations.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: MUTED, fontSize: 13, fontWeight: 600 }}>
              ยังไม่มีคำเชิญ
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invitations.map(inv => (
                <InviteRow
                  key={inv.id}
                  inv={inv}
                  origin={origin}
                  onRevoke={() => handleRevokeInvite(inv.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showInvite && (
        <InviteModal
          pages={pages}
          origin={origin}
          onClose={() => { setShowInvite(false); loadAll() }}
        />
      )}
    </div>
  )
}

function InviteRow({ inv, origin, onRevoke }: { inv: Invitation; origin: string; onRevoke: () => void }) {
  const [copied, setCopied] = useState(false)
  const isCredentials = inv.auth_method === 'credentials'
  const copyTarget = isCredentials ? (inv.invitee_email || '') : `${origin}/invite/${inv.token}`

  const statusColor =
    inv.status === 'pending' ? YELLOW
      : inv.status === 'accepted' ? GREEN
        : inv.status === 'expired' ? MUTED
          : RED
  const statusBg =
    inv.status === 'pending' ? YELLOW_L
      : inv.status === 'accepted' ? GREEN_L
        : inv.status === 'expired' ? '#f1f5f9'
          : RED_L
  const statusText: Record<typeof inv.status, string> = {
    pending: 'รอตอบรับ',
    accepted: 'ยอมรับแล้ว',
    expired: 'หมดอายุ',
    revoked: 'ยกเลิกแล้ว',
  }

  async function copyAction() {
    try {
      await navigator.clipboard.writeText(copyTarget)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert('คัดลอกไม่สำเร็จ')
    }
  }

  return (
    <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 9px', background: statusBg, color: statusColor, fontWeight: 800, borderRadius: 7, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {statusText[inv.status]}
            </span>
            <span style={{
              padding: '3px 9px',
              background: isCredentials ? '#dbeafe' : '#fce7f3',
              color: isCredentials ? '#1d4ed8' : '#be185d',
              fontWeight: 800, borderRadius: 7, fontSize: 10,
              textTransform: 'uppercase', letterSpacing: 0.5,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {isCredentials ? <><Mail size={10} /> Email</> : <><Link2 size={10} /> FB Link</>}
            </span>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
              {inv.status === 'pending' ? `หมดอายุ ${new Date(inv.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}
              {inv.status === 'accepted' && inv.acceptedUser ? `รับโดย ${inv.acceptedUser.name}` : ''}
            </span>
          </div>
          {isCredentials && (inv.invitee_name || inv.invitee_email) && (
            <div style={{ fontSize: 12, color: TEXT, fontWeight: 700, marginBottom: 4 }}>
              👤 {inv.invitee_name || '—'} <span style={{ color: MUTED, fontWeight: 500 }}>· {inv.invitee_email}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {inv.pages.map((p, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, background: 'white', border: `1px solid ${BORDER}`,
                padding: '3px 8px', borderRadius: 6, color: TEXT, fontWeight: 700,
              }}>
                {p.page_picture ? (
                  <img src={p.page_picture} alt="" style={{ width: 12, height: 12, borderRadius: '50%' }} />
                ) : '📄'}
                {p.page_name}
              </span>
            ))}
          </div>
          {inv.note && (
            <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic', marginTop: 5 }}>
              💬 {inv.note}
            </div>
          )}
        </div>
        {inv.status === 'pending' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {!isCredentials && (
              <button
                onClick={copyAction}
                style={{
                  padding: '8px 12px', fontSize: 11, fontWeight: 800,
                  background: copied ? GREEN_L : PRIMARY_LIGHT,
                  color: copied ? GREEN : PRIMARY, border: `1px solid ${copied ? 'rgba(5,150,105,0.2)' : BORDER}`,
                  borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {copied ? (<><Check size={12} /> คัดลอกแล้ว</>) : (<><Copy size={12} /> คัดลอกลิงก์</>)}
              </button>
            )}
            <button
              onClick={onRevoke}
              style={{
                padding: '8px 10px', fontSize: 11, fontWeight: 800,
                background: RED_L, color: RED, border: 'none',
                borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <X size={12} /> ยกเลิก
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type InviteResult =
  | { authMethod: 'facebook'; url: string; expiresAt: string }
  | { authMethod: 'credentials'; loginUrl: string; email: string; password: string; expiresAt: string }

function InviteModal({ pages, origin, onClose }: { pages: Page[]; origin: string; onClose: () => void }) {
  const [authMethod, setAuthMethod] = useState<'credentials' | 'facebook'>('credentials')
  const [inviteeEmail, setInviteeEmail] = useState('')
  const [inviteeName, setInviteeName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const canSubmit =
    selected.length > 0 &&
    !creating &&
    (authMethod === 'facebook' ||
      (authMethod === 'credentials' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteeEmail.trim()) && inviteeName.trim().length > 0))

  async function create() {
    if (!canSubmit) return
    setCreating(true)
    try {
      const body: any = {
        pageIds: selected,
        note: note.trim() || undefined,
        authMethod,
      }
      if (authMethod === 'credentials') {
        body.inviteeEmail = inviteeEmail.trim()
        body.inviteeName = inviteeName.trim()
      }
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert('สร้างคำเชิญไม่สำเร็จ: ' + (data.error || 'unknown'))
        return
      }
      if (data.credentials) {
        setResult({
          authMethod: 'credentials',
          loginUrl: `${origin}${data.credentials.loginUrl}`,
          email: data.credentials.email,
          password: data.credentials.password,
          expiresAt: data.invitation.expires_at,
        })
      } else {
        setResult({
          authMethod: 'facebook',
          url: `${origin}${data.url}`,
          expiresAt: data.invitation.expires_at,
        })
      }
    } finally {
      setCreating(false)
    }
  }

  async function copyField(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch {}
  }

  async function copyAllCredentials() {
    if (result?.authMethod !== 'credentials') return
    const text = `🔑 บัญชีเข้าใช้งานระบบตอบแชท
URL: ${result.loginUrl}
Email: ${result.email}
รหัสผ่าน: ${result.password}

(คำเชิญหมดอายุ ${new Date(result.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })})`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField('all')
      setTimeout(() => setCopiedField(null), 1500)
    } catch {}
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      backdropFilter: 'blur(6px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: SURFACE, borderRadius: 22, padding: 28, width: '100%', maxWidth: 500,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(15,23,42,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={20} color={PRIMARY} /> เชิญแอดมินใหม่
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {!result ? (
          <>
            {/* Method toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 8 }}>
                วิธีให้แอดมิน login
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => setAuthMethod('credentials')}
                  style={{
                    padding: '12px 10px', fontSize: 12, fontWeight: 800,
                    background: authMethod === 'credentials' ? PRIMARY_LIGHT : SURFACE2,
                    color: authMethod === 'credentials' ? PRIMARY : MUTED,
                    border: `1.5px solid ${authMethod === 'credentials' ? 'rgba(24,119,242,0.4)' : BORDER}`,
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Mail size={13} /> Email + รหัสผ่าน
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>
                    แอดมินไม่ต้องมี FB account
                  </div>
                </button>
                <button
                  onClick={() => setAuthMethod('facebook')}
                  style={{
                    padding: '12px 10px', fontSize: 12, fontWeight: 800,
                    background: authMethod === 'facebook' ? PRIMARY_LIGHT : SURFACE2,
                    color: authMethod === 'facebook' ? PRIMARY : MUTED,
                    border: `1.5px solid ${authMethod === 'facebook' ? 'rgba(24,119,242,0.4)' : BORDER}`,
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Link2 size={13} /> Facebook Link
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>
                    ต้อง pass FB App Review
                  </div>
                </button>
              </div>
            </div>

            {/* Credentials-specific fields */}
            {authMethod === 'credentials' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 6 }}>
                    ชื่อแอดมิน <span style={{ color: RED }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={inviteeName}
                    onChange={e => setInviteeName(e.target.value)}
                    placeholder="เช่น พี่หน่อย"
                    maxLength={60}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 13,
                      border: `1.5px solid ${BORDER}`, borderRadius: 10, fontFamily: 'inherit',
                      background: SURFACE2, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 6 }}>
                    Email <span style={{ color: RED }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteeEmail}
                    onChange={e => setInviteeEmail(e.target.value)}
                    placeholder="agent@example.com"
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 13,
                      border: `1.5px solid ${BORDER}`, borderRadius: 10, fontFamily: 'inherit',
                      background: SURFACE2, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 8 }}>
                เลือกเพจที่ให้แอดมินดูแล <span style={{ color: RED }}>*</span>
              </label>
              {pages.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: MUTED, fontSize: 12, background: SURFACE2, borderRadius: 10 }}>
                  ยังไม่มีเพจที่คุณเป็นเจ้าของ
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                  {pages.map(p => (
                    <label key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: selected.includes(p.id) ? PRIMARY_LIGHT : SURFACE2,
                      border: `1.5px solid ${selected.includes(p.id) ? 'rgba(24,119,242,0.4)' : BORDER}`,
                      borderRadius: 10, cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => toggle(p.id)}
                        style={{ width: 18, height: 18, accentColor: PRIMARY, cursor: 'pointer' }}
                      />
                      {p.page_picture ? (
                        <img src={p.page_picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                      ) : <span style={{ fontSize: 16 }}>📄</span>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{p.page_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: TEXT, display: 'block', marginBottom: 6 }}>
                หมายเหตุ (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="เช่น ทีมตอบแชทกะเช้า"
                maxLength={200}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13,
                  border: `1.5px solid ${BORDER}`, borderRadius: 10, fontFamily: 'inherit',
                  background: SURFACE2, boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{
              background: '#f0fdf4', border: '1px solid rgba(5,150,105,0.18)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 16,
              fontSize: 11, color: '#065f46', lineHeight: 1.7,
            }}>
              {authMethod === 'credentials' ? (
                <>
                  <strong>📧 ระบบจะสร้าง Email + รหัสผ่าน</strong> — copy ส่งให้แอดมินผ่าน LINE<br />
                  แอดมินไป /login กรอก Email + รหัสผ่าน → ใช้งานได้ทันที (ไม่ต้องมี FB account)
                </>
              ) : (
                <>
                  <strong>📩 ระบบจะสร้างลิงก์เชิญ</strong> — แอดมินคลิกลิงก์ + login FB เพื่อยอมรับ<br />
                  ⚠️ ต้องใช้ FB account ที่ pass FB App Review แล้ว — ลิงก์หมดอายุใน 7 วัน
                </>
              )}
            </div>

            <button
              onClick={create}
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 800,
                background: !canSubmit ? '#94a3b8' : 'linear-gradient(135deg, #1877f2 0%, #2e89ff 55%, #5fa3ff 100%)',
                color: 'white', border: 'none', borderRadius: 12,
                cursor: !canSubmit ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                boxShadow: !canSubmit ? 'none' : '0 6px 22px rgba(11,95,204,0.42)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {authMethod === 'credentials' ? <Mail size={15} /> : <Link2 size={15} />}
              {creating ? 'กำลังสร้าง...' : authMethod === 'credentials' ? 'สร้าง Email + รหัสผ่าน' : 'สร้างลิงก์เชิญ'}
            </button>
          </>
        ) : result.authMethod === 'credentials' ? (
          <>
            <div style={{
              background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.25)',
              borderRadius: 14, padding: 16, marginBottom: 14, textAlign: 'center',
            }}>
              <div style={{ fontSize: 30, marginBottom: 4 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#065f46', marginBottom: 2 }}>
                สร้างบัญชีสำเร็จ
              </div>
              <div style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>
                ส่งให้แอดมิน · หมดอายุ {new Date(result.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            <div style={{
              background: '#fef3c7', border: '1px solid rgba(217,119,6,0.3)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 14,
              fontSize: 11, color: '#92400e', lineHeight: 1.7,
            }}>
              ⚠️ <strong>รหัสผ่านจะแสดงครั้งนี้ครั้งเดียว</strong> — ปิดหน้านี้แล้วจะดูซ้ำไม่ได้
            </div>

            <CredentialField label="URL" value={result.loginUrl} icon={<ExternalLink size={13} />}
              copied={copiedField === 'url'} onCopy={() => copyField('url', result.loginUrl)} />
            <CredentialField label="Email" value={result.email} icon={<Mail size={13} />}
              copied={copiedField === 'email'} onCopy={() => copyField('email', result.email)} />
            <CredentialField label="รหัสผ่าน" value={result.password} icon={<Key size={13} />} mono
              copied={copiedField === 'password'} onCopy={() => copyField('password', result.password)} />

            <button
              onClick={copyAllCredentials}
              style={{
                width: '100%', padding: '11px 20px', fontSize: 13, fontWeight: 800,
                background: copiedField === 'all' ? GREEN_L : PRIMARY_LIGHT,
                color: copiedField === 'all' ? GREEN : PRIMARY,
                border: `1.5px solid ${copiedField === 'all' ? 'rgba(5,150,105,0.25)' : BORDER}`,
                borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                marginBottom: 8, marginTop: 4,
              }}
            >
              {copiedField === 'all' ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === 'all' ? 'คัดลอกทั้งหมดแล้ว' : 'คัดลอกข้อความพร้อมส่ง'}
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '11px 20px', fontSize: 13, fontWeight: 800,
                background: SURFACE2, color: TEXT, border: `1.5px solid ${BORDER}`,
                borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              เสร็จสิ้น
            </button>
          </>
        ) : (
          <>
            <div style={{
              background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.25)',
              borderRadius: 14, padding: 16, marginBottom: 14, textAlign: 'center',
            }}>
              <div style={{ fontSize: 30, marginBottom: 4 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#065f46', marginBottom: 2 }}>
                สร้างลิงก์เชิญสำเร็จ
              </div>
              <div style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>
                หมดอายุ {new Date(result.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            <CredentialField label="ลิงก์เชิญ" value={result.url} icon={<Link2 size={13} />} mono
              copied={copiedField === 'url'} onCopy={() => copyField('url', result.url)} />

            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '11px 20px', fontSize: 13, fontWeight: 800,
                background: SURFACE2, color: TEXT, border: `1.5px solid ${BORDER}`,
                borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
              }}
            >
              เสร็จสิ้น
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CredentialField({
  label, value, icon, copied, onCopy, mono,
}: {
  label: string; value: string; icon: React.ReactNode
  copied: boolean; onCopy: () => void; mono?: boolean
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: MUTED, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {icon} {label}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={value}
          readOnly
          onFocus={e => e.target.select()}
          style={{
            flex: 1, padding: '10px 12px', fontSize: mono ? 13 : 13,
            border: `1.5px solid ${BORDER}`, borderRadius: 10,
            fontFamily: mono ? 'monospace' : 'inherit',
            background: SURFACE2, boxSizing: 'border-box', color: TEXT, fontWeight: mono ? 700 : 500,
          }}
        />
        <button
          onClick={onCopy}
          style={{
            padding: '10px 14px', fontSize: 12, fontWeight: 800,
            background: copied ? GREEN_L : PRIMARY_LIGHT,
            color: copied ? GREEN : PRIMARY,
            border: `1.5px solid ${copied ? 'rgba(5,150,105,0.25)' : BORDER}`,
            borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5, minWidth: 44, justifyContent: 'center',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}
