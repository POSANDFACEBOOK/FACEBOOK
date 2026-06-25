-- ============================================
-- FB Ads AI Manager — เปิด Realtime ให้ inbox (เด้งทันทีเมื่อมีข้อความใหม่)
-- รันใน Supabase SQL Editor — รันซ้ำได้
-- RLS เป็นแบบ page-member อยู่แล้ว → client (owner/agent) เห็นเฉพาะเพจที่เข้าถึงได้
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inbox_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;
  END IF;
END $$;

-- ให้ UPDATE/DELETE ส่งข้อมูลแถวเต็ม (ไม่จำเป็นสำหรับ INSERT แต่เผื่อ event อื่น)
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE inbox_messages REPLICA IDENTITY FULL;

-- ────────────────────────────────────────────
-- Security: client ใช้ JWT role=authenticated สำหรับ Realtime
-- → ปิดไม่ให้อ่านคอลัมน์ลับ (token/secret/รหัสผ่าน) ผ่าน REST โดยตรง
-- service_role (API ฝั่ง server) ยัง bypass ได้ปกติ ไม่กระทบการทำงาน
-- (ใช้ DO block กันกรณีคอลัมน์ยังไม่มี/รันก่อน migration อื่น)
-- ────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (page_access_token, line_channel_secret) ON connected_pages FROM anon, authenticated';
EXCEPTION WHEN undefined_column OR undefined_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (access_token, password_hash) ON users FROM anon, authenticated';
EXCEPTION WHEN undefined_column OR undefined_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (initial_password_hash) ON team_invitations FROM anon, authenticated';
EXCEPTION WHEN undefined_column OR undefined_object OR undefined_table THEN NULL; END $$;
