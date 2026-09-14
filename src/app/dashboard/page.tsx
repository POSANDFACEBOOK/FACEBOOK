import { redirect } from 'next/navigation'

// ระบบนี้เป็นระบบตอบแชทอย่างเดียว — หน้าหลักคือกล่องข้อความ
// (ลิงก์เก่า /dashboard ที่แชร์กันไว้ยังใช้ได้ พาไปกล่องข้อความให้อัตโนมัติ)
export default function DashboardHome() {
  redirect('/dashboard/inbox')
}
