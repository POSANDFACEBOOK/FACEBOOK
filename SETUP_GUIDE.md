# 🚀 คู่มือ Setup ทีละขั้นตอน (ภาษาไทย)

ทำตามลำดับนี้เลยครับ ใช้เวลาประมาณ 45-60 นาที

---

## ขั้นตอนที่ 1 — สร้าง Facebook Developer App

### 1.1 สร้าง App
1. ไปที่ https://developers.facebook.com
2. คลิก **"My Apps"** → **"Create App"**
3. เลือก **"Business"** → กด Next
4. ใส่ชื่อ App (เช่น "My Ads Manager") → กด Create App

### 1.2 เพิ่ม Products
ใน App Dashboard → Add Products:
- ✅ **Facebook Login** → กด Set Up
- ✅ **Marketing API** → กด Set Up

### 1.3 ตั้งค่า Facebook Login
1. ไปที่ **Facebook Login → Settings**
2. ใส่ Valid OAuth Redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/facebook
   https://your-app.vercel.app/api/auth/callback/facebook
   ```
3. กด Save

### 1.4 ขอ Permissions (สำคัญมาก!)
ไปที่ **App Review → Permissions and Features** → ขอ:
- `pages_show_list`
- `pages_manage_ads`
- `pages_read_engagement`
- `ads_management`
- `ads_read`
- `business_management`

> ⚠️ **หมายเหตุ**: ระหว่างทดสอบให้เพิ่ม Facebook accounts เป็น "Test Users" ก่อน
> ไปที่ Roles → Test Users → Add

### 1.5 Copy Credentials
ไปที่ **Settings → Basic**:
- Copy **App ID** → จะเป็น `FACEBOOK_CLIENT_ID`
- Copy **App Secret** → จะเป็น `FACEBOOK_CLIENT_SECRET`

---

## ขั้นตอนที่ 2 — ตั้งค่า Supabase

### 2.1 สร้าง Project
1. ไปที่ https://supabase.com → Sign Up / Login
2. กด **"New Project"**
3. ตั้งชื่อ project, เลือก Region (Singapore ใกล้สุด), ตั้ง Database Password
4. รอ 2-3 นาทีให้ project พร้อม

### 2.2 รัน Database Schema
1. ไปที่ **SQL Editor** (ไอคอนซ้ายมือ)
2. กด **"New Query"**
3. Copy ทั้งหมดจากไฟล์ `supabase/schema.sql`
4. Paste แล้วกด **"Run"** (Ctrl+Enter)
5. ควรเห็น "Success" ✅

### 2.3 Copy Credentials
ไปที่ **Settings → API**:
- Copy **Project URL** → จะเป็น `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → จะเป็น `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role** key → จะเป็น `SUPABASE_SERVICE_ROLE_KEY`

---

## ขั้นตอนที่ 3 — ขอ Anthropic API Key

1. ไปที่ https://console.anthropic.com
2. Sign Up / Login
3. ไปที่ **API Keys** → **"Create Key"**
4. Copy key → จะเป็น `ANTHROPIC_API_KEY`
5. เติมเครดิตอย่างน้อย $5 (ใช้ไม่มาก)

---

## ขั้นตอนที่ 4 — ตั้งค่า GitHub Repository

```bash
# 1. สร้าง repo ใหม่บน github.com ก่อน (อย่า initialize with README)

# 2. Copy โค้ดทั้งหมดไปไว้ในโฟลเดอร์
# แล้วรันคำสั่งนี้ในโฟลเดอร์ project:

git init
git add .
git commit -m "feat: initial FB Ads AI Manager"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fb-ads-manager.git
git push -u origin main
```

---

## ขั้นตอนที่ 5 — Deploy บน Vercel

### 5.1 Import Project
1. ไปที่ https://vercel.com → Login ด้วย GitHub
2. กด **"New Project"**
3. Import repo `fb-ads-manager` ที่สร้างไว้
4. Framework: Next.js (detect อัตโนมัติ)

### 5.2 ใส่ Environment Variables
ก่อนกด Deploy → เพิ่ม Environment Variables ทั้งหมด:

```
FACEBOOK_CLIENT_ID          = [จาก Step 1]
FACEBOOK_CLIENT_SECRET      = [จาก Step 1]
NEXT_PUBLIC_SUPABASE_URL    = [จาก Step 2]
NEXT_PUBLIC_SUPABASE_ANON_KEY = [จาก Step 2]
SUPABASE_SERVICE_ROLE_KEY   = [จาก Step 2]
ANTHROPIC_API_KEY           = [จาก Step 3]
NEXTAUTH_URL                = https://your-app.vercel.app
NEXTAUTH_SECRET             = [generate: openssl rand -base64 32]
CRON_SECRET                 = [generate: openssl rand -hex 16]
```

### 5.3 Deploy!
กด **"Deploy"** → รอ 2-3 นาที

### 5.4 อัปเดต Facebook App
กลับไปที่ Facebook Developer App:
- ใส่ Vercel URL จริงใน OAuth Redirect URIs

---

## ขั้นตอนที่ 6 — ตั้งค่า GitHub Actions (Auto Deploy)

### 6.1 ดึง Vercel Credentials
ใน Vercel:
- **Settings → Tokens** → สร้าง token → copy เป็น `VERCEL_TOKEN`
- **Settings → General** → copy `Org ID` เป็น `VERCEL_ORG_ID`  
- **Project Settings → General** → copy `Project ID` เป็น `VERCEL_PROJECT_ID`

### 6.2 เพิ่ม GitHub Secrets
ไปที่ GitHub repo → **Settings → Secrets and variables → Actions** → เพิ่ม:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

ตอนนี้ทุกครั้งที่ push to `main` → deploy อัตโนมัติ! 🎉

---

## ขั้นตอนที่ 7 — เชื่อมต่อ Claude Code

### 7.1 ติดตั้ง Claude Code
```bash
npm install -g @anthropic/claude-code
```

### 7.2 เปิด Project
```bash
cd fb-ads-manager
claude
```

Claude Code จะอ่าน `CLAUDE.md` อัตโนมัติ และรู้จัก project ของคุณทันที

### 7.3 ตัวอย่างการใช้งาน Claude Code
```
# เพิ่ม feature ใหม่
> เพิ่มฟีเจอร์ export ข้อมูล campaign เป็น CSV

# แก้ bug
> แก้ไข error ใน /api/ads/create เมื่อ ad account ไม่มี

# แก้ UI
> ปรับ Dashboard ให้แสดง chart ของ spend รายวัน

# แก้ AI prompt
> ปรับ prompt ให้ AI วิเคราะห์เรื่อง cost per engagement ด้วย
```

---

## ✅ Checklist ก่อนใช้งานจริง

- [ ] Facebook App ผ่าน App Review แล้ว (สำหรับ user อื่นที่ไม่ใช่ test user)
- [ ] Supabase schema รันแล้วไม่มี error
- [ ] Environment variables ครบทุกตัวใน Vercel
- [ ] Login ด้วย Facebook ได้สำเร็จ
- [ ] เชื่อมต่อ Page ได้อย่างน้อย 1 Page
- [ ] ลองยิงแอด test (ใช้งบน้อยๆ เช่น 50 บาท/วัน)
- [ ] Cron Job ทำงาน (ดูใน Vercel → Functions → Cron)

---

## 🆘 แก้ปัญหาที่พบบ่อย

**Login แล้ว redirect ไม่ถูก**
→ เช็ค `NEXTAUTH_URL` และ Facebook OAuth Redirect URIs

**ไม่เห็น Ad Account**
→ Page ต้องมี Business Manager และผูก Ad Account ไว้

**AI วิเคราะห์ไม่ทำงาน**
→ เช็ค `ANTHROPIC_API_KEY` และยอดเครดิตใน console.anthropic.com

**Cron ไม่รัน**
→ ต้องมี Vercel Pro plan หรือ Hobby plan (cron ฟรีบน Hobby)
→ เช็ค `CRON_SECRET` ตรงกันทั้ง .env และ Vercel

**Facebook API Error: (#200)**
→ ยังไม่ได้ขอ Permission หรือ App ยังไม่ผ่าน Review
