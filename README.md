# 🚀 FB Ads AI Manager

ระบบจัดการ Facebook Ads อัตโนมัติ + AI วิเคราะห์ ยิงไปได้เลย เชื่อมหลาย Pages

## Stack
- **Frontend + Backend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI Analysis**: Claude API (Anthropic)
- **Deploy**: Vercel
- **Auth**: Facebook OAuth via NextAuth.js

---

## 📋 Setup Guide (ทำตามลำดับ)

### Step 1: Facebook Developer App

1. ไปที่ https://developers.facebook.com
2. สร้าง App ใหม่ → เลือก **Business**
3. เพิ่ม Product: **Facebook Login** และ **Marketing API**
4. ใน Settings > Basic:
   - Copy `App ID` และ `App Secret`
5. ใน Facebook Login > Settings:
   - Valid OAuth Redirect URIs: `https://your-domain.vercel.app/api/auth/callback/facebook`
6. ขอ Permissions: `pages_manage_ads`, `pages_read_engagement`, `ads_management`, `ads_read`

### Step 2: Supabase Setup

1. ไปที่ https://supabase.com → สร้าง Project
2. ไปที่ SQL Editor → รัน `supabase/schema.sql` ที่แนบมา
3. Copy `Project URL` และ `anon public key` จาก Settings > API

### Step 3: Environment Variables

สร้างไฟล์ `.env.local`:

```env
# Facebook
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic AI
ANTHROPIC_API_KEY=your_claude_api_key

# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=generate_random_32_chars
```

### Step 4: Deploy to Vercel

```bash
npm install
npx vercel --prod
```

เพิ่ม Environment Variables ทั้งหมดใน Vercel Dashboard

---

## 🎯 วิธีใช้งาน

1. **Login** ด้วย Facebook Account ที่เป็น Admin ของ Pages
2. **เชื่อมต่อ Pages** ที่ต้องการจัดการ
3. **เลือกโพสต์** ที่ต้องการยิงแอด
4. **ตั้งค่า Budget** และ **กลุ่มเป้าหมาย**
5. **กด Boost** → ระบบสร้าง Ad Campaign อัตโนมัติ
6. **AI วิเคราะห์** ผลลัพธ์ทุก 6 ชั่วโมง → แนะนำว่าควรเติมเงินหรือเปลี่ยน Targeting

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth Facebook OAuth
│   │   ├── pages/         # ดึง FB Pages
│   │   ├── posts/         # ดึง Posts จาก Page
│   │   ├── ads/           # สร้าง/จัดการ Ads
│   │   └── ai-analyze/    # AI วิเคราะห์ Ads
│   ├── dashboard/         # หน้า Dashboard หลัก
│   ├── pages-connect/     # เชื่อมต่อ Pages
│   └── ads/[id]/          # รายละเอียด Ad + AI analysis
├── components/
│   ├── PageCard.tsx
│   ├── PostSelector.tsx
│   ├── AdBoostModal.tsx
│   └── AIInsightPanel.tsx
└── lib/
    ├── facebook.ts        # Facebook API helpers
    ├── supabase.ts        # Supabase client
    └── ai-analyzer.ts     # Claude AI analysis
```
