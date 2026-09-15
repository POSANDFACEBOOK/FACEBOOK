# 💬 FACEBOOK CHAT NAIWANSOOK

ระบบตอบแชทลูกค้าจาก **Facebook Page** ในที่เดียว
(รองรับ **LINE Official Account** ด้วย แต่ตอนนี้ซ่อนไว้ก่อน — เปิดได้ด้วย env `NEXT_PUBLIC_ENABLE_LINE=true` แล้ว Redeploy)
ออกแบบให้แอดมินร้านใช้บนมือถือเป็นหลัก — เจ้าของเพจเชื่อมช่องทางและเพิ่มทีม แอดมินเข้ามาตอบแชทอย่างเดียว

## ฟีเจอร์
- **กล่องข้อความรวม** — เลือกช่องทาง Facebook / LINE ก่อน พร้อมตัวเลขแชทที่ยังไม่อ่าน
- **เด้งทันที** — webhook + Supabase Realtime (มี polling สำรอง)
- **ส่งข้อความ/รูปภาพ** — แสดงสติกเกอร์และรูปจากลูกค้า, ส่งซ้ำได้เมื่อส่งไม่สำเร็จ
- **ข้อความตอบเร็ว (quick replies)** และ **AI ช่วยร่างคำตอบ** (Claude)
- **ตัวกรอง** ใหม่ / ยังไม่ตอบ / ติดดาว / เก็บแล้ว + ค้นหาชื่อลูกค้า/ข้อความ
- **ทีม** — เจ้าของเพจเพิ่มแอดมิน (อีเมล+รหัสผ่าน หรือลิงก์เชิญผ่าน Facebook) กำหนดสิทธิ์รายเพจ

## Stack
Next.js 14 (App Router) · Supabase (PostgreSQL + Realtime + Storage) · NextAuth (Facebook + Credentials) · Vercel

## เริ่มต้น
ดูขั้นตอนติดตั้งทั้งหมดใน [SETUP_GUIDE.md](SETUP_GUIDE.md)

```bash
npm install
cp .env.example .env.local   # ใส่ค่าจริง
npm run dev                  # http://localhost:3000
```

## โครงสร้างหลัก
```
src/app/
├── dashboard/inbox/      หน้าตอบแชท (หน้าหลัก — /dashboard พามาที่นี่อัตโนมัติ)
├── dashboard/channels/   เชื่อมเพจ Facebook / LINE OA + ตรวจการเชื่อมต่อ
├── dashboard/team/       จัดการทีมแอดมิน
└── api/
    ├── inbox/            รายการแชท, ข้อความ, ส่ง, อัปโหลดรูป, sync, AI, quick replies
    ├── pages/            รายชื่อเพจ FB ที่ดูแล + เชื่อมเพจ (/api/pages/connect)
    ├── line/             เชื่อม LINE OA + health check
    ├── webhooks/         messenger + line
    ├── team/             เชิญ/สมาชิก/สิทธิ์
    └── realtime/token    JWT สำหรับ Supabase Realtime
```
