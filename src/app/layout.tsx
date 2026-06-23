'use client'
import { SessionProvider } from 'next-auth/react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#1877f2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* ── Global interaction polish: hover "pop", tap feedback ── */}
        <style>{`
          * { -webkit-tap-highlight-color: transparent; }
          @keyframes fbspin { from { transform: rotate(0) } to { transform: rotate(360deg) } }

          /* Card / tile — lift + glow on hover */
          .fbpop {
            transition: transform .17s cubic-bezier(.2,.8,.3,1), box-shadow .17s cubic-bezier(.2,.8,.3,1);
            will-change: transform;
          }
          .fbpop:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 36px rgba(24,119,242,.24), 0 5px 12px rgba(11,95,204,.14);
          }
          .fbpop:active { transform: translateY(-1px) scale(.995); }

          /* Button — press + brighten */
          .fbtap {
            transition: transform .14s cubic-bezier(.2,.8,.3,1), filter .14s, box-shadow .14s;
            will-change: transform;
          }
          .fbtap:hover { transform: translateY(-2px); filter: brightness(1.06) saturate(1.05); }
          .fbtap:active { transform: scale(.95); filter: brightness(.98); }

          /* Sidebar nav row — slide on hover */
          .fbnav {
            transition: transform .15s cubic-bezier(.2,.8,.3,1), background .15s, box-shadow .15s, border-color .15s;
            will-change: transform;
          }
          .fbnav:hover { transform: translateX(4px); }

          /* Page tile — pop on hover */
          .fbtile {
            transition: transform .16s cubic-bezier(.2,.8,.3,1), box-shadow .16s, border-color .16s;
            will-change: transform;
          }
          .fbtile:hover { transform: translateY(-3px) scale(1.02); }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
