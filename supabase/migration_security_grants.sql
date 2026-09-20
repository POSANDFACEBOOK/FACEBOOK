-- ============================================
-- FACEBOOK CHAT — ล็อกสิทธิ์ฝั่งเบราว์เซอร์ + แก้ policy วนซ้ำ + index รายการแชท
-- รันใน Supabase SQL Editor เป็นไฟล์สุดท้าย (ต่อจาก migration อื่นทั้งหมด) — รันซ้ำได้
-- ไม่ลบข้อมูลใดๆ · ไม่ DROP ตาราง · server ใช้ service role ซึ่ง bypass RLS อยู่แล้ว → แอปทำงานเหมือนเดิม
--
-- ทำไมต้องรัน
-- 1) /api/realtime/token แจก JWT role=authenticated ให้เบราว์เซอร์ และ anon key ก็อยู่ในหน้าเว็บอยู่แล้ว
--    → ใครเปิด DevTools ก็ยิง /rest/v1 ตรงได้ ด้วย "สิทธิ์ระดับตาราง" ที่ Supabase ให้ authenticated มาตั้งแต่แรก
--    (อ่าน connected_pages.page_access_token ไปตอบแชทแทนเพจ / ลบแชททั้งเพจ / แก้ตั้งค่า / สร้างคำเชิญให้ตัวเอง)
--    การ REVOKE ราย "คอลัมน์" ใน migration_realtime_inbox.sql ไม่มีผล เพราะสิทธิ์ระดับตารางยังอยู่
-- 2) policy "members_visibility" ของ page_members อ้างถึง page_members เอง → Postgres ฟ้อง
--    "infinite recursion detected in policy" ทุกครั้งที่ Realtime เช็คสิทธิ์ของแถวใหม่
--    → ข้อความใหม่ไม่เคยเด้งเข้าเครื่องจริงๆ เลย (ได้แต่รอ poll ทุก 7 วิ) ทั้งที่หน้าเว็บขึ้นว่า SUBSCRIBED
-- ============================================

-- ────────────────────────────────────────────
-- 1) Helper — ดึงเพจของผู้ใช้โดยไม่ผ่าน RLS ของ page_members
--    SECURITY DEFINER = รันด้วยสิทธิ์เจ้าของฟังก์ชัน → policy ไม่วนกลับเข้า page_members อีก
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_page_ids()
  RETURNS SETOF UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT page_id FROM public.page_members WHERE user_id = auth.uid()::UUID $$;

CREATE OR REPLACE FUNCTION public.my_owned_page_ids()
  RETURNS SETOF UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT page_id FROM public.page_members WHERE user_id = auth.uid()::UUID AND role = 'owner' $$;

REVOKE ALL ON FUNCTION public.my_page_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_owned_page_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_page_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_owned_page_ids() TO authenticated;

-- ────────────────────────────────────────────
-- 2) ตัดสิทธิ์ตารางของ anon/authenticated ให้เหลือเท่าที่ Realtime ต้องใช้จริง
--    Realtime เช็คสิทธิ์ด้วย SELECT เท่านั้น → ให้แค่ 2 ตารางที่หน้าเว็บ subscribe
--    (ต้องทำข้อนี้ก่อน/พร้อมข้อ 3 — ถ้าแก้ recursion ก่อนตัดสิทธิ์ page_access_token จะอ่านได้ทันที)
-- ────────────────────────────────────────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- ตารางที่สร้างใหม่ทีหลังก็จะไม่ได้สิทธิ์อัตโนมัติอีก (ถ้าต้องใช้ Realtime ให้ GRANT SELECT เองทีละตาราง)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.inbox_messages TO authenticated;

-- ────────────────────────────────────────────
-- 3) Policy — อ่านอย่างเดียว และเลิกอ้างถึงตารางตัวเอง
--    ทุกการเขียนไปที่ server (service role) อยู่แล้ว → client ไม่ต้องมีสิทธิ์เขียนเลย
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "members_visibility" ON page_members;
CREATE POLICY "members_visibility" ON page_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()::UUID
  OR page_id IN (SELECT public.my_owned_page_ids())
);

DROP POLICY IF EXISTS "conv_member_access" ON conversations;
DROP POLICY IF EXISTS "conv_member_select" ON conversations;
CREATE POLICY "conv_member_select" ON conversations FOR SELECT TO authenticated USING (
  page_id IN (SELECT public.my_page_ids())
);

DROP POLICY IF EXISTS "msg_member_access" ON inbox_messages;
DROP POLICY IF EXISTS "msg_member_select" ON inbox_messages;
CREATE POLICY "msg_member_select" ON inbox_messages FOR SELECT TO authenticated USING (
  conversation_id IN (
    SELECT c.id FROM conversations c WHERE c.page_id IN (SELECT public.my_page_ids())
  )
);

-- team_invitations: policy เดิมเป็น FOR ALL USING (owner_user_id = auth.uid()) และไม่มี WITH CHECK
-- → ใครก็ตามที่มี JWT ยิง REST มาสร้างคำเชิญให้ตัวเองเข้าเพจไหนก็ได้ที่รู้ id
-- app แตะตารางนี้ผ่าน service role เท่านั้น → client ไม่ต้องมี policy เลย (RLS เปิดอยู่ = ปฏิเสธทั้งหมด)
DROP POLICY IF EXISTS "invites_owner" ON team_invitations;
REVOKE ALL ON public.team_invitations FROM anon, authenticated;

-- หมายเหตุ: policy FOR ALL ที่เหลือ (connected_pages, inbox_settings, quick_replies, users)
-- ไม่ถูกแตะ เพราะพอไม่มีสิทธิ์ระดับตารางแล้ว client ก็ยิงถึงตารางพวกนี้ไม่ได้ตั้งแต่ต้น

-- ────────────────────────────────────────────
-- 4) Index รายการแชท — ทุกเครื่องที่เปิดอยู่ยิง query ชุดนี้ทุก 7 วินาที
--    ORDER BY last_message_at DESC NULLS LAST ใช้ idx_conv_last_at เดิมไม่ได้ (เดิมเป็น NULLS FIRST)
--    → ตอนนี้ Postgres ต้องอ่านแชททั้งหมดของเพจแล้วมาเรียงใหม่ทุกครั้ง
--    ใช้ CREATE INDEX ธรรมดา (ไม่ใช่ CONCURRENTLY) เพราะ SQL Editor รันในทรานแซกชัน
-- ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conv_page_active_last
  ON conversations (page_id, last_message_at DESC NULLS LAST)
  WHERE is_archived = false;

-- "ทุกเพจ" (ไม่ได้เลือกเพจใดเพจหนึ่ง)
CREATE INDEX IF NOT EXISTS idx_conv_active_last
  ON conversations (last_message_at DESC NULLS LAST)
  WHERE is_archived = false;

-- "ยังไม่ตอบ" — ทั้งตัวเลขบนแท็บและรายการ (เดิมไม่มี index รองรับเลย)
CREATE INDEX IF NOT EXISTS idx_conv_needs_reply
  ON conversations (page_id, last_message_at DESC NULLS LAST)
  WHERE last_sender = 'customer' AND unread_count <= 0 AND is_archived = false;

-- "ใหม่" — idx_conv_unread เดิมไม่มี page_id/is_archived จึงยังต้องอ่านทั้งแถว
CREATE INDEX IF NOT EXISTS idx_conv_unread_active
  ON conversations (page_id, last_message_at DESC NULLS LAST)
  WHERE unread_count > 0 AND is_archived = false;

-- ────────────────────────────────────────────
-- 5) ตรวจผลหลังรัน (คัดลอกไปรันแยก — ต้องได้ false ทั้ง 4 ค่า)
-- ────────────────────────────────────────────
-- SELECT
--   has_column_privilege('authenticated','public.connected_pages','page_access_token','SELECT') AS อ่าน_page_token_ได้,
--   has_table_privilege('authenticated','public.team_invitations','INSERT')                     AS สร้างคำเชิญได้,
--   has_table_privilege('authenticated','public.conversations','DELETE')                        AS ลบแชทได้,
--   has_table_privilege('authenticated','public.users','SELECT')                                AS อ่านตาราง_users_ได้;

-- ตรวจว่า policy ไม่วนซ้ำแล้ว (เดิม error 42P17 — หลังแก้ต้องได้ตัวเลข)
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims','{"sub":"<ใส่ users.id ที่มีจริง>","role":"authenticated"}',true);
--   SELECT count(*) FROM conversations;
--   SELECT count(*) FROM inbox_messages;
-- ROLLBACK;
