'use client'
import { signIn, signOut, useSession } from 'next-auth/react'

export default function LoginPage() {
  const { data: session } = useSession()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: 48,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        maxWidth: 400,
        width: '100%',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <h1 style={{ color: 'white', marginBottom: 8, fontSize: 24 }}>FB Ads AI Manager</h1>
        <p style={{ color: '#64748b', marginBottom: 32, fontSize: 14 }}>
          ระบบยิงแอด Facebook อัตโนมัติ
        </p>

        {session ? (
          <div>
            <p style={{ color: '#4ade80', marginBottom: 16, fontSize: 14 }}>
              ✅ Login แล้วในฐานะ {session.user?.name}
            </p>
            <a href="/dashboard"
              style={{ display: 'block', width: '100%', padding: '14px 24px', background: '#6366f1', color: 'white', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, textDecoration: 'none' }}>
              ไปที่ Dashboard
            </a>
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ width: '100%', padding: '14px 24px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>
              Logout แล้ว Login ใหม่
            </button>
          </div>
        ) : (
          <button onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}
            style={{ width: '100%', padding: '14px 24px', background: '#1877f2', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            เข้าสู่ระบบด้วย Facebook
          </button>
        )}
      </div>
    </div>
  )
}
