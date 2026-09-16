# CLAUDE.md — FACEBOOK CHAT NAIWANSOOK

ระบบ **ตอบแชทลูกค้าอย่างเดียว** — ตอนนี้เน้น **Facebook Page** อย่างเดียว
(ระบบยิงแอด/วิเคราะห์แอดเดิมถูกตัดออกทั้งหมดแล้ว อย่าเพิ่มกลับโดยไม่ได้รับคำสั่ง)

> **LINE OA ถูกซ่อนไว้ก่อน (ไม่ได้ลบโค้ด)** — สวิตช์ `LINE_ENABLED` ใน `src/lib/features.ts`
> อ่านจาก env `NEXT_PUBLIC_ENABLE_LINE` (ไม่ตั้ง = ปิด) กรองเพจ LINE ออกที่ `getCurrentUserContext` จุดเดียว
> + ซ่อน UI ในหน้าช่องทาง/ทีม/กล่องข้อความ + API `line/connect`, `line/health` ตอบ 403
> webhook LINE ยังรับข้อความเก็บไว้ · เปิดกลับ = ตั้ง env เป็น `true` ใน Vercel แล้ว Redeploy
ผู้ใช้หลักคือแอดมินร้านอาหารที่ใช้ **มือถือ** — ข้อความใน UI เป็นภาษาไทยที่อ่านแล้วรู้ว่าต้องทำอะไรต่อ

## 🏗️ Architecture
```
Facebook Messenger webhook ─┐
LINE Messaging API webhook ─┼─→ Next.js 14 API routes ─→ Supabase (Postgres + Realtime + Storage)
Inbox UI (poll + realtime) ─┘                                ↑
                                   Claude API (AI ช่วยร่างคำตอบ)
Deploy: push main → GitHub Actions → Vercel
```

## 📁 ไฟล์สำคัญ
```
src/app/dashboard/inbox/page.tsx        UI กล่องข้อความ (ไฟล์ใหญ่ ~2,950 บรรทัด)
src/app/dashboard/channels/page.tsx     เชื่อมเพจ FB / LINE OA + health check
src/app/dashboard/team/page.tsx         จัดการทีม (owner เท่านั้น)
src/app/dashboard/page.tsx              redirect → /dashboard/inbox
src/app/api/inbox/*                     conversations, send, upload, sync, mark-read, ai-suggest, quick-replies, settings, repair
src/app/api/pages/route.ts              รายชื่อเพจ FB ที่ผู้ใช้ดูแล (ไม่ส่ง page token ให้ browser)
src/app/api/pages/connect/route.ts      เชื่อมเพจ FB — ดึง token ฝั่ง server เอง + subscribe webhook
src/app/api/line/{connect,health}       เชื่อม/ตรวจ LINE OA
src/app/api/webhooks/{messenger,line}   รับข้อความ (await ให้เสร็จก่อนตอบ, rehost รูปผ่าน lib/media.ts)
src/app/api/realtime/token              มินต์ Supabase JWT (SUPABASE_JWT_SECRET)
src/lib/team.ts                         getCurrentUserContext — ใช้ในทุก API route (กรองเพจ LINE เมื่อปิดสวิตช์)
src/lib/features.ts                     สวิตช์ฟีเจอร์ (LINE_ENABLED)
src/lib/supabase.ts                     supabaseAdmin(), ensureFbUser()
src/lib/fb-pages.ts                     fetchManagedPages(), canConnectPage() — เพจที่ผู้ใช้ดูแล + บทบาทที่ตอบแชทได้
src/lib/app-badge.ts                    ตัวเลขแชทใหม่บนชื่อแท็บ/favicon/ไอคอนแอป (Badging API)
src/lib/customer-avatar.ts              รูปโปรไฟล์ลูกค้า: ดึงจาก FB มาเก็บใน Storage (avatars/) เพราะลิงก์ FB หมดอายุ · none:<วันที่> = ไม่มีรูป · ห้ามจำ "ไม่มีรูป" ตอน FB ล่ม/token หมดอายุ
src/app/api/inbox/avatar/[id]           302 ไปรูปลูกค้า (ใช้เฉพาะแชทที่รูปยังไม่อยู่ในระบบ)
public/icon.svg + icons/ + favicon.ico   ไอคอนแอป "ตัว N" (ต้นฉบับ = icon.svg; PNG/ICO สร้างจากไฟล์นี้) · manifest.webmanifest = ติดตั้งเป็นแอปได้
src/lib/{messenger,line,media}.ts       helpers ของแต่ละช่องทาง
supabase/*.sql                          ลำดับการรันอยู่ใน SETUP_GUIDE.md
```

## 🗄️ Database
| Table | ใช้ทำอะไร |
|---|---|
| `users` | ผู้ใช้ (FB: `facebook_id`, แอดมิน: email+password) |
| `connected_pages` | ช่องทางแชท 1 แถว = 1 เพจ FB หรือ 1 LINE OA (`channel` = `facebook`/`line`) |
| `page_members` | สิทธิ์รายเพจ `owner` / `agent` (trigger สร้าง owner ให้อัตโนมัติตอน insert เพจ) |
| `team_invitations` | ลิงก์เชิญเข้าทีม |
| `conversations` / `inbox_messages` | แชทและข้อความ |
| `inbox_settings` / `quick_replies` | ตั้งค่าแชทรายเพจ / ข้อความตอบเร็ว |

## 🔐 สิทธิ์
- `ctx.isOwner` = เป็น owner ของอย่างน้อย 1 เพจ → จัดการทีม, ตรวจ LINE
- คนที่ล็อกอินด้วย Facebook และยังไม่มีสิทธิ์ในเพจไหนเลย (`memberships.length === 0`) เชื่อมเพจ/LINE แรกได้
- ลูกทีม (`isAgentOnly` — เข้าด้วยอีเมล/รหัสผ่าน หรือ Facebook) = ตอบแชทเท่านั้น
- ทุก route ต้องเช็ค `ctx.accessiblePageIds` ก่อนอ่าน/เขียนแชท

## ⚠️ สิ่งที่ต้องระวัง
1. **ห้ามรับ page access token จาก client** — ดึงจาก Graph API ด้วย user token ฝั่ง server เท่านั้น
2. **ลบแถว `connected_pages` = ลบแชททั้งหมดของช่องทางนั้น** (FK ON DELETE CASCADE) — ต้องเตือนผู้ใช้เสมอ
3. เพจ FB / LINE OA เดียวกันห้ามถูกเชื่อมโดย 2 บัญชี — webhook หาช่องทางด้วย `page_id` แบบ `.single()` ถ้าซ้ำข้อความจะหายทั้งช่องทาง (เช็ค 409 ใน connect routes + `migration_unique_channel.sql`)
4. Messenger ตอบได้ภายใน 24 ชม. (error #551/#10) — แสดงข้อความที่แอดมินเข้าใจ
5. SQL migration ให้ผู้ใช้รันเองใน Supabase SQL Editor — ห้าม DROP/ลบข้อมูลอัตโนมัติ
6. iOS Safari เก่า: ห้ามใช้ regex lookbehind ใน client code (จอขาว)
7. **Vercel functions อยู่ region `sin1` (vercel.json)** ให้ใกล้ Supabase (ap-southeast-1 สิงคโปร์) — ถ้าเอาออกจะกลับไป iad1 (สหรัฐฯ) ทุก query ข้ามทวีป สลับเพจ/เปิดแชทช้าหลายวินาที
8. bucket `chat-uploads` เป็น public แต่ **ห้ามมี policy SELECT** บน storage.objects (จะทำให้ใครก็ตามที่มี anon key ไล่ดูรายชื่อไฟล์/รูปลูกค้าทั้ง bucket ได้) — อ่าน/เขียน storage ผ่าน service role เท่านั้น
9. รายการแชทในกล่องข้อความ: โหลดผ่าน `loadConversations`/`applyListResponse` เท่านั้น (มี seq + key กันผลเก่าทับเพจที่เลือก และแคชต่อ key) — ห้าม `setConversations(res.conversations)` ตรงๆ

## 🚀 Local / Deploy
```bash
npm install
cp .env.example .env.local
npm run dev
npx tsc --noEmit && npm run build   # ตรวจก่อน push
```
push/merge เข้า `main` → deploy อัตโนมัติ
