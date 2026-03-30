'use client'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
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
        <h1 style={{ color: 'white', marginBottom: 8 }}>FB Ads AI Manager</h1>
        <p style={{ color: '#64748b', marginBottom: 32 }}>ระบบยิงแอด Facebook อัตโนมัติ</p>
        <button
          onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#1877f2',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          เข้าสู่ระบบด้วย Facebook
        </button>
      </div>
    </div>
  )
}