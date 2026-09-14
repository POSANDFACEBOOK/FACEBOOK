import { NextResponse } from 'next/server'

// Facebook Data Deletion Callback — FB ต้องการ url ให้ผู้ใช้เข้าไปดูสถานะ + confirmation_code
const statusUrl = () => {
  const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  return `${base.replace(/\/$/, '')}/privacy`
}

export async function GET() {
  return NextResponse.json({
    url: statusUrl(),
    confirmation_code: 'data-deletion-request',
    message: 'หากต้องการลบข้อมูลของคุณ กรุณาติดต่อผู้ดูแลระบบ',
  })
}

export async function POST() {
  return NextResponse.json({
    url: statusUrl(),
    confirmation_code: `del-${Date.now()}`,
  })
}
