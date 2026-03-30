'use client'
import { SessionProvider } from 'next-auth/react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, padding: 0 }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}