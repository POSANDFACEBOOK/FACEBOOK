'use client'
import { Suspense, useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#eaf2fd' }} />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [mode, setMode] = useState<'owner' | 'agent'>('owner')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
        callbackUrl,
      })
      if (!res || res.error) {
        setError('Email หรือรหัสผ่านไม่ถูกต้อง')
        setBusy(false)
        return
      }
      router.push(res.url || callbackUrl)
    } catch (err: any) {
      setError('เกิดข้อผิดพลาด: ' + (err?.message || 'unknown'))
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#eaf2fd',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sarabun', sans-serif", padding: 20, position: 'relative',
    }}>
      {/* Tech grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(24,119,242,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(24,119,242,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />
      {/* Glow blobs */}
      <div style={{ position: 'fixed', top: '-8%', right: '-5%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(24,119,242,0.12) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '-6%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{
          width: 80, height: 80, margin: '0 auto 22px',
          background: 'linear-gradient(135deg, #1877f2 0%, #2e89ff 55%, #5fa3ff 100%)',
          borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          boxShadow: '0 8px 32px rgba(11,95,204,0.45), 0 3px 10px rgba(11,95,204,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}>⚡</div>

        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1a1f3c', margin: '0 0 7px', letterSpacing: '-0.5px' }}>
          FB Ads AI Manager
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 28, fontSize: 14, lineHeight: 1.6, fontWeight: 500 }}>
          ระบบจัดการโฆษณาและตอบแชท Facebook
        </p>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(24,119,242,0.14)',
          borderRadius: 26, padding: '26px 24px',
          boxShadow: '8px 8px 28px rgba(24,119,242,0.14), -6px -6px 20px rgba(255,255,255,0.95), 0 2px 8px rgba(0,0,0,0.05)',
        }}>
          {session ? (
            <div>
              {/* Logged-in state */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 11,
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                border: '1.5px solid rgba(5,150,105,0.22)', borderRadius: 14,
                padding: '11px 15px', marginBottom: 22, textAlign: 'left',
                boxShadow: '2px 2px 8px rgba(5,150,105,0.1), -1px -1px 5px rgba(255,255,255,0.9)',
              }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div>
                  <p style={{ fontSize: 11, color: '#059669', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Login สำเร็จ</p>
                  <p style={{ fontSize: 13, color: '#1a1f3c', margin: 0, fontWeight: 700 }}>{session.user?.name || session.user?.email}</p>
                </div>
              </div>

              <a href="/dashboard" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                width: '100%', padding: '14px 24px',
                background: 'linear-gradient(135deg, #1877f2 0%, #2e89ff 55%, #5fa3ff 100%)',
                color: 'white', borderRadius: 15, fontSize: 15, fontWeight: 800,
                textDecoration: 'none', marginBottom: 11,
                boxShadow: '0 6px 22px rgba(11,95,204,0.45), 0 2px 8px rgba(11,95,204,0.22), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
                transition: 'all 0.2s', boxSizing: 'border-box', letterSpacing: '0.02em',
              }}>
                🚀 ไปที่ Dashboard
              </a>

              <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
                width: '100%', padding: '12px 24px',
                background: 'linear-gradient(145deg, #ffffff, #f0f4ff)',
                color: '#6b7280',
                border: '1.5px solid rgba(24,119,242,0.15)', borderRadius: 14, fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '3px 3px 10px rgba(24,119,242,0.1), -2px -2px 8px rgba(255,255,255,0.9)',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>
                Logout แล้ว Login ใหม่
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                background: '#f0f6ff', padding: 4, borderRadius: 12, marginBottom: 18,
              }}>
                <button
                  onClick={() => { setMode('owner'); setError(null) }}
                  style={{
                    padding: '9px 12px', fontSize: 12, fontWeight: 800,
                    background: mode === 'owner' ? 'white' : 'transparent',
                    color: mode === 'owner' ? '#1877f2' : '#6b7280',
                    border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: mode === 'owner' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.18s',
                  }}
                >
                  🏢 เจ้าของเพจ
                </button>
                <button
                  onClick={() => { setMode('agent'); setError(null) }}
                  style={{
                    padding: '9px 12px', fontSize: 12, fontWeight: 800,
                    background: mode === 'agent' ? 'white' : 'transparent',
                    color: mode === 'agent' ? '#1877f2' : '#6b7280',
                    border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: mode === 'agent' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.18s',
                  }}
                >
                  👤 แอดมินตอบแชท
                </button>
              </div>

              {mode === 'owner' ? (
                <>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 18, lineHeight: 1.7, fontWeight: 500 }}>
                    เชื่อมต่อบัญชี Facebook เพื่อจัดการเพจ
                  </p>
                  <button
                    className="fbtap"
                    onClick={() => signIn('facebook', { callbackUrl })}
                    style={{
                      width: '100%', padding: '14px 22px',
                      background: 'linear-gradient(135deg, #1877f2 0%, #0d65d9 100%)',
                      color: 'white', border: 'none', borderRadius: 14,
                      fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 6px 22px rgba(24,119,242,0.45), 0 2px 8px rgba(24,119,242,0.22), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      letterSpacing: '0.02em',
                    }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    เข้าสู่ระบบด้วย Facebook
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.7, fontWeight: 500 }}>
                    ใช้ Email + รหัสผ่านที่ได้รับจากเจ้าของเพจ
                  </p>
                  <form onSubmit={handleCredentialsLogin}>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email"
                      autoComplete="email"
                      required
                      style={{
                        width: '100%', padding: '12px 14px', fontSize: 13,
                        border: '1.5px solid rgba(24,119,242,0.15)', borderRadius: 12,
                        fontFamily: 'inherit', background: '#f0f6ff',
                        boxSizing: 'border-box', marginBottom: 10,
                      }}
                    />
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="รหัสผ่าน"
                        autoComplete="current-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        style={{
                          width: '100%', padding: '12px 44px 12px 14px', fontSize: 13,
                          border: '1.5px solid rgba(24,119,242,0.15)', borderRadius: 12,
                          fontFamily: 'inherit', background: '#f0f6ff',
                          boxSizing: 'border-box',
                          letterSpacing: showPassword ? 'normal' : '0.05em',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          width: 32, height: 32, border: 'none', background: 'transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6b7280', padding: 0,
                        }}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {error && (
                      <div style={{
                        background: '#fee2e2', color: '#991b1b',
                        border: '1px solid rgba(220,38,38,0.2)',
                        borderRadius: 10, padding: '9px 12px', fontSize: 12,
                        fontWeight: 700, marginBottom: 12, textAlign: 'left',
                      }}>
                        ⚠️ {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      className="fbtap"
                      disabled={busy || !email.trim() || !password}
                      style={{
                        width: '100%', padding: '14px 22px',
                        background: (busy || !email.trim() || !password) ? '#94a3b8' : 'linear-gradient(135deg, #1877f2 0%, #2e89ff 55%, #5fa3ff 100%)',
                        color: 'white', border: 'none', borderRadius: 14,
                        fontSize: 14, fontWeight: 800,
                        cursor: (busy || !email.trim() || !password) ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: (busy || !email.trim() || !password) ? 'none' : '0 6px 22px rgba(11,95,204,0.45), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
                        letterSpacing: '0.02em',
                      }}>
                      {busy ? 'กำลังเข้าสู่ระบบ...' : '✉️ เข้าสู่ระบบ'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 18, fontWeight: 500 }}>
          🔒 ปลอดภัยด้วย OAuth 2.0 / bcrypt
        </p>
      </div>
    </div>
  )
}
