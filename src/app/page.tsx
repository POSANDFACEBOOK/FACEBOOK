import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default function Home() {
  // Allow Facebook/Meta bots to access the page (needed for App Review / Go Live)
  const headersList = headers()
  const ua = headersList.get('user-agent') || ''
  const isBot = /facebookexternalhit|facebookcatalog|Facebot|MetaInspector/i.test(ua)

  if (!isBot) {
    redirect('/login')
  }

  return (
    <html lang="th">
      <head>
        <title>FACEBOOK CHAT NAIWANSOOK</title>
        <meta name="description" content="ระบบรวมแชทลูกค้าจาก Facebook Page และ LINE OA ไว้ตอบในที่เดียว" />
      </head>
      <body style={{ fontFamily: 'sans-serif', padding: '40px', textAlign: 'center' }}>
        <h1>FACEBOOK CHAT NAIWANSOOK</h1>
        <p>Unified customer chat inbox for Facebook Pages and LINE Official Accounts</p>
      </body>
    </html>
  )
}
