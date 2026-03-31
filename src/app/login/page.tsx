'use client'
import { signIn, signOut, useSession } from 'next-auth/react'

export default function LoginPage() {
  const { data: session } = useSession()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#eef2ff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sarabun', sans-serif", padding: 20, position: 'relative',
    }}>
      {/* Tech grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />
      {/* Glow blobs */}
      <div style={{ position: 'fixed', top: '-8%', right: '-5%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '-6%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{
          width: 80, height: 80, margin: '0 auto 22px',
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)',
          borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          boxShadow: '0 8px 32px rgba(67,56,202,0.45), 0 3px 10px rgba(67,56,202,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}>⚡</div>

        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1a1f3c', margin: '0 0 7px', letterSpacing: '-0.5px' }}>
          FB Ads AI Manager
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 34, fontSize: 14, lineHeight: 1.6, fontWeight: 500 }}>
          ระบบจัดการโฆษณา Facebook อัตโนมัติด้วย AI
        </p>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(99,102,241,0.14)',
          borderRadius: 26, padding: '30px 28px',
          boxShadow: '8px 8px 28px rgba(99,102,241,0.14), -6px -6px 20px rgba(255,255,255,0.95), 0 2px 8px rgba(0,0,0,0.05)',
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
                  <p style={{ fontSize: 13, color: '#1a1f3c', margin: 0, fontWeight: 700 }}>{session.user?.name}</p>
                </div>
              </div>

              <a href="/dashboard" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                width: '100%', padding: '14px 24px',
                background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)',
                color: 'white', borderRadius: 15, fontSize: 15, fontWeight: 800,
                textDecoration: 'none', marginBottom: 11,
                boxShadow: '0 6px 22px rgba(67,56,202,0.45), 0 2px 8px rgba(67,56,202,0.22), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
                transition: 'all 0.2s', boxSizing: 'border-box', letterSpacing: '0.02em',
              }}>
                🚀 ไปที่ Dashboard
              </a>

              <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
                width: '100%', padding: '12px 24px',
                background: 'linear-gradient(145deg, #ffffff, #f0f4ff)',
                color: '#6b7280',
                border: '1.5px solid rgba(99,102,241,0.15)', borderRadius: 14, fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '3px 3px 10px rgba(99,102,241,0.1), -2px -2px 8px rgba(255,255,255,0.9)',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>
                Logout แล้ว Login ใหม่
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 22, lineHeight: 1.7, fontWeight: 500 }}>
                เชื่อมต่อบัญชี Facebook เพื่อเริ่มจัดการโฆษณาอัตโนมัติ
              </p>
              <button
                onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}
                style={{
                  width: '100%', padding: '15px 24px',
                  background: 'linear-gradient(135deg, #1877f2 0%, #0d65d9 100%)',
                  color: 'white', border: 'none', borderRadius: 15,
                  fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 6px 22px rgba(24,119,242,0.45), 0 2px 8px rgba(24,119,242,0.22), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
                  transition: 'all 0.2s', letterSpacing: '0.02em',
                }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                เข้าสู่ระบบด้วย Facebook
              </button>
            </>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 22, fontWeight: 500 }}>
          🔒 ปลอดภัยด้วย Facebook OAuth 2.0
        </p>
      </div>
    </div>
  )
}
