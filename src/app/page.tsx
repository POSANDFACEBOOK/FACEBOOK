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
        <title>FB Ads AI Manager</title>
        <meta name="description" content="AI-powered Facebook Ads Manager" />
      </head>
      <body style={{ fontFamily: 'sans-serif', padding: '40px', textAlign: 'center' }}>
        <h1>FB Ads AI Manager</h1>
        <p>AI-powered Facebook Ads Management Platform</p>
      </body>
    </html>
  )
}
