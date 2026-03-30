# CLAUDE.md — FB Ads AI Manager

ไฟล์นี้ช่วยให้ Claude Code เข้าใจ project นี้โดยอัตโนมัติ
เมื่อเปิด project ใน Claude Code จะอ่านไฟล์นี้ก่อนเสมอ

---

## 🏗️ Architecture

```
Next.js 14 App Router  →  Supabase (PostgreSQL)
        ↓
  Facebook Graph API v19
        ↓
  Anthropic Claude API  →  AI Analysis
        ↓
  Vercel (Deploy + Cron Jobs)
```

## 📁 โครงสร้างไฟล์สำคัญ

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  ← Facebook OAuth
│   │   ├── pages/route.ts               ← ดึง FB Pages
│   │   ├── posts/route.ts               ← ดึง Posts จาก Page
│   │   ├── ads/
│   │   │   ├── route.ts                 ← List campaigns
│   │   │   └── create/route.ts          ← สร้าง ad campaign
│   │   ├── ai-analyze/route.ts          ← AI วิเคราะห์แอด
│   │   ├── notifications/route.ts       ← การแจ้งเตือน
│   │   └── cron/sync-performance/route.ts ← Cron ทุก 6 ชม.
│   ├── dashboard/page.tsx               ← หน้าหลัก (Client Component)
│   └── login/page.tsx                   ← หน้า Login Facebook
├── lib/
│   ├── facebook.ts      ← Facebook Graph API helpers
│   ├── ai-analyzer.ts   ← Claude AI analysis logic
│   └── supabase.ts      ← Supabase client
supabase/
└── schema.sql           ← Database schema ทั้งหมด
```

## 🗄️ Database Tables (Supabase)

| Table | ใช้ทำอะไร |
|-------|-----------|
| `users` | ข้อมูล user + Facebook access token |
| `connected_pages` | FB Pages ที่ user เชื่อมต่อ + page token + ad account |
| `ad_campaigns` | Campaign ที่สร้าง + FB IDs + targeting settings |
| `ad_performance` | Metrics snapshot ทุก 6 ชม. (impressions, spend, CTR ฯลฯ) |
| `ai_analyses` | ผล AI วิเคราะห์ + recommendation |
| `notifications` | การแจ้งเตือน user |

## 🔑 Environment Variables ที่ต้องมี

```bash
FACEBOOK_CLIENT_ID          # จาก developers.facebook.com
FACEBOOK_CLIENT_SECRET
NEXT_PUBLIC_SUPABASE_URL    # จาก supabase.com project settings
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY           # จาก console.anthropic.com
NEXTAUTH_URL                # URL ของ app (localhost:3000 หรือ vercel URL)
NEXTAUTH_SECRET             # random string 32 chars
CRON_SECRET                 # สำหรับ protect cron endpoint
```

## 🔄 Flow การทำงาน

### ยิงแอด (User Flow)
1. User login ด้วย Facebook → ได้ access token
2. ระบบดึง Pages ที่ user เป็น Admin → sync ลง `connected_pages`
3. User เลือก Page → ระบบดึง Posts ล่าสุด
4. User เลือก Post → ตั้ง budget, targeting, ระยะเวลา
5. กด "ยิงแอด" → API สร้าง Campaign → Ad Set → Ad ใน Facebook
6. บันทึก IDs ลง `ad_campaigns`

### Cron Job (ทุก 6 ชั่วโมง)
1. ดึง active campaigns ทั้งหมด
2. เรียก Facebook Insights API → บันทึกลง `ad_performance`
3. ถ้าผ่านมา 24+ ชม. นับจาก AI analyze ล่าสุด → trigger `/api/ai-analyze`
4. AI วิเคราะห์ metrics → สร้าง recommendation → notify user

### AI Analysis
- ส่ง metrics ไปให้ Claude วิเคราะห์ภาษาไทย
- ผลลัพธ์: recommendation + summary + action items
- recommendations: `keep_running` | `increase_budget` | `decrease_budget` | `change_targeting` | `pause_ad` | `extend_duration`

## 🛠️ Common Tasks สำหรับ Claude Code

### เพิ่ม Feature ใหม่
- API routes อยู่ใน `src/app/api/`
- UI อยู่ใน `src/app/dashboard/page.tsx`
- Facebook API helpers อยู่ใน `src/lib/facebook.ts`

### แก้ AI Prompt
- แก้ที่ `src/lib/ai-analyzer.ts` → function `analyzeAdPerformance()`
- Prompt อยู่ใน template literal ยาวๆ

### เพิ่ม Database Table
1. เพิ่ม SQL ใน `supabase/schema.sql`
2. รันใน Supabase SQL Editor
3. เพิ่ม TypeScript types ถ้าจำเป็น

### Debug Facebook API Errors
- ดู error message จาก `data.error.message`
- ตรวจสอบ permissions ที่ขอใน `src/app/api/auth/[...nextauth]/route.ts`
- ทดสอบใน Graph API Explorer: https://developers.facebook.com/tools/explorer/

## ⚠️ สิ่งที่ต้องระวัง

1. **Page Access Token** ≠ User Access Token — ต้องใช้ให้ถูก
2. **Ad Account ID** format คือ `act_XXXXXXXXX` (มี `act_` นำหน้า)
3. **Daily Budget** ใน Facebook API = สตางค์ (THB × 100)
4. **Cron Secret** ต้องเซ็ตใน Vercel Environment Variables ด้วย
5. Facebook Permissions ต้องผ่าน App Review ก่อน go live

## 🚀 Local Development

```bash
npm install
cp .env.example .env.local
# ใส่ค่าใน .env.local
npm run dev
# เปิด http://localhost:3000
```

## 📦 Deploy

```bash
# Push to main → GitHub Actions deploy อัตโนมัติ
git add .
git commit -m "feat: your feature"
git push origin main
```
