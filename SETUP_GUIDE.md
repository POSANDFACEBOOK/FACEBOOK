# 🚀 คู่มือติดตั้ง (ภาษาไทย)

## 1) Facebook App
1. https://developers.facebook.com → **Create App** → ประเภท **Business**
2. เพิ่ม Products: **Facebook Login** และ **Messenger**
3. **Facebook Login → Settings** → Valid OAuth Redirect URIs
   ```
   http://localhost:3000/api/auth/callback/facebook
   https://your-app.vercel.app/api/auth/callback/facebook
   ```
4. **App Review → Permissions** ที่ระบบใช้:
   `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`,
   `pages_manage_metadata`, `pages_messaging`, `business_management`
5. **Settings → Basic** → คัดลอก App ID / App Secret → `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
6. **Messenger → Settings → Webhooks**
   | Field | ค่า |
   |---|---|
   | Callback URL | `https://your-app.vercel.app/api/webhooks/messenger` |
   | Verify Token | ค่าเดียวกับ `FB_WEBHOOK_VERIFY_TOKEN` |
   | Fields | `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads` |

## 2) Supabase
1. สร้าง Project (Region: Singapore)
2. **SQL Editor** → รันไฟล์ใน `supabase/` ตามลำดับ
   1. `schema.sql`
   2. `migration_inbox.sql`
   3. `migration_team_roles.sql`
   4. `migration_team_credentials.sql`
   5. `migration_page_nickname.sql`
   6. `fix_last_sender.sql`
   7. `migration_line_channel.sql`
   8. `migration_chat_uploads.sql`
   9. `migration_send_block.sql`
   10. `migration_realtime_inbox.sql`
   11. `migration_unique_channel.sql`
3. **Project Settings → API** → คัดลอก URL, anon key, service_role key, JWT Secret

> ฐานข้อมูลเดิมที่เคยใช้ระบบยิงแอด: ตารางแอดเก่ายังอยู่แต่ไม่ถูกใช้แล้ว
> ถ้าต้องการลบให้ดู `supabase/optional_drop_ads_tables.sql` (ลบแล้วกู้คืนไม่ได้)

## 3) Environment Variables
ใส่ใน `.env.local` และ Vercel → Project Settings → Environment Variables (ดูตัวอย่างใน `.env.example`)
```
FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, FB_WEBHOOK_VERIFY_TOKEN
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
ANTHROPIC_API_KEY
NEXTAUTH_URL, NEXTAUTH_SECRET
```

## 4) Deploy
push เข้า `main` → GitHub Actions deploy ขึ้น Vercel อัตโนมัติ
(ต้องตั้ง GitHub Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)

## 5) เริ่มใช้งาน
1. เจ้าของเพจเข้า `/login` → **เข้าสู่ระบบด้วย Facebook** (กดอนุญาตให้เข้าถึงเพจ)
2. เมนู **ช่องทางแชท**
   - Facebook: กด **เชื่อมเพจ** ที่เพจที่ต้องการ
   - LINE: กด **เชื่อม LINE OA** → ใส่ Channel access token + Channel secret → นำ Webhook URL
     `https://your-app.vercel.app/api/webhooks/line` ไปใส่ใน LINE Developers และเปิด **Use webhook**
   - กด **ตรวจสอบการเชื่อมต่อทั้งหมด** เพื่อเช็ค LINE ทุก OA ในครั้งเดียว
3. เมนู **จัดการทีม** → เพิ่มแอดมิน (อีเมล+รหัสผ่าน หรือส่งลิงก์เชิญ) และเลือกเพจที่ให้ตอบ
4. ส่งลิงก์ `https://your-app.vercel.app/dashboard/inbox` ให้แอดมิน

## ⚠️ ข้อจำกัดของ Facebook / LINE
- **Messenger 24 ชม.** — ตอบลูกค้าได้ภายใน 24 ชม. นับจากข้อความล่าสุดของลูกค้า
- **Page token หมดอายุ** เมื่อเจ้าของเปลี่ยนรหัสผ่าน/ถอนสิทธิ์ → เจ้าของออกจากระบบแล้วเข้าใหม่ แล้วกด **เชื่อมใหม่** ที่เพจนั้นในหน้า "ช่องทางแชท"
- **LINE ไม่มีสถานะ "อ่านแล้ว" จาก OA Manager** — ใช้ปุ่ม "อ่านทั้งหมด" ในระบบแทน
- ใน LINE OA Manager → Response settings ต้องเปิด **Webhooks** และปิด **ตอบกลับอัตโนมัติ**

## 🆘 แก้ปัญหาที่พบบ่อย
- **ไม่เห็นเพจให้เชื่อม** → ออกจากระบบ แล้วเข้าด้วย Facebook ใหม่ กด "แก้ไขการเข้าถึง" และเลือกเพจให้ครบ
- **ขึ้นว่า "บทบาทในเพจไม่พอให้ตอบแชท"** → ต้องเป็นผู้ดูแล/ผู้ตรวจสอบ หรือมีสิทธิ์ข้อความในเพจนั้น
- **ข้อความ Facebook ไม่เข้า** → หน้า "ช่องทางแชท" กด **เชื่อมใหม่** ที่เพจนั้น, เช็ค Webhooks fields และ `FB_WEBHOOK_VERIFY_TOKEN`, ดู Vercel logs ของ `/api/webhooks/messenger`
- **ข้อความ LINE ไม่เข้า** → หน้า "ช่องทางแชท" → ตรวจสอบการเชื่อมต่อทั้งหมด แล้วแก้ตามที่ระบบบอก
- **แชทไม่เด้งทันที** → ตั้ง `SUPABASE_JWT_SECRET` และรัน `migration_realtime_inbox.sql`
