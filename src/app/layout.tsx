import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FB Ads AI Manager',
  description: 'ระบบยิงแอด Facebook อัตโนมัติ + AI วิเคราะห์',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}