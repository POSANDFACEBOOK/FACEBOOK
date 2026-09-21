-- ============================================
-- FACEBOOK CHAT — Index ให้ตรงกับ "รายการแชท" ชุดปัจจุบัน
-- รัน SQL นี้ใน Supabase SQL Editor (รันซ้ำได้ ไม่ลบข้อมูลสักแถว — แก้เฉพาะ index)
-- รันก่อนหรือหลัง migration_security_grants.sql ก็ได้ (ไม่มี index ทับกันแล้ว) · ไม่รันก็ไม่พัง
-- ============================================
--
-- ทำไมต้องมี: query ที่ถี่ที่สุดในแอปคือรายการแชท (ทุกเครื่องที่เปิดอยู่ยิงทุก 7 วินาที)
-- ตอนนี้ตัวกรองของ src/app/api/inbox/conversations/route.ts เป็นแบบนี้
--   ค่าเริ่มต้น ("ทั้งหมด") = is_archived = false OR unread_count > 0
--   "ใหม่"                  = unread_count > 0            ← ไม่มีเงื่อนไข is_archived แล้ว
-- แต่ index เดิมมีเงื่อนไข is_archived = false ติดอยู่ Postgres จึงใช้ไม่ได้
-- (partial index ใช้ได้ก็ต่อเมื่อเงื่อนไขของ query "การันตี" เงื่อนไขของ index —
--  unread_count > 0 เฉยๆ ไม่การันตีว่า is_archived = false)
-- ผลคือร้านที่มีสองหมื่นแชทต้องอ่านทั้งเพจมาเรียงใหม่ทุก 7 วินาที → สลับเพจแล้วค้าง
--
-- แก้ที่ index อย่างเดียว ไม่แตะโค้ด/ไม่แตะข้อมูล — พฤติกรรมที่แอดมินเห็นเหมือนเดิมทุกอย่าง
-- (แชทที่จัดเก็บไว้แล้วลูกค้าทักกลับมา ยังต้องเด้งกลับเข้ากล่องข้อความเหมือนเดิม)

-- ────────────────────────────────────────────
-- 1) "ใหม่" (filter=unread) + ตัวเลข unread รายเพจ
--    เงื่อนไขต้องเป็น unread_count > 0 เท่านั้น ให้ตรงกับ query
-- ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conv_unread_any
  ON conversations (page_id, last_message_at DESC NULLS LAST)
  WHERE unread_count > 0;

-- ────────────────────────────────────────────
-- 2) รายการแชทค่าเริ่มต้น — เงื่อนไขเป็น OR ต้องทำ index ที่มีเงื่อนไข OR เหมือนกัน
--    Postgres จะจับคู่ได้ (แต่ละข้างของ OR การันตีเงื่อนไขของ index) แล้วเดิน index
--    ตามลำดับ last_message_at หยุดที่ LIMIT 50 ไม่ต้องเรียงทั้งเพจ
-- ────────────────────────────────────────────
-- เลือกเพจเดียว
CREATE INDEX IF NOT EXISTS idx_conv_page_inbox_last
  ON conversations (page_id, last_message_at DESC NULLS LAST)
  WHERE is_archived = false OR unread_count > 0;

-- "ทุกเพจ"
CREATE INDEX IF NOT EXISTS idx_conv_inbox_last
  ON conversations (last_message_at DESC NULLS LAST)
  WHERE is_archived = false OR unread_count > 0;

-- ────────────────────────────────────────────
-- 3) ลบ index ที่ไม่มี query ไหนใช้แล้ว (เหลือไว้ = เสียเวลาเขียนทุกครั้งที่ลูกค้าทักเข้ามา)
--    ไม่ใช่การลบข้อมูล — ถ้าอยากได้คืน คัดลอกคำสั่งในคอมเมนต์ไปรันได้เลย
-- ────────────────────────────────────────────
-- เดิม: CREATE INDEX idx_conv_unread_active ON conversations (page_id, last_message_at DESC NULLS LAST)
--         WHERE unread_count > 0 AND is_archived = false;   ← ถูกแทนด้วย idx_conv_unread_any ข้อ 1
DROP INDEX IF EXISTS idx_conv_unread_active;

-- เดิม: CREATE INDEX idx_conv_page_active ON conversations(page_id) WHERE is_archived = false;
--         ← ซ้ำกับ idx_conv_page_active_last (คอลัมน์ page_id ขึ้นต้นเหมือนกัน เงื่อนไขเดียวกัน)
DROP INDEX IF EXISTS idx_conv_page_active;

-- ────────────────────────────────────────────
-- 4) ตรวจผลหลังรัน (คัดลอกไปรันแยก — ต้องเห็น "Index Scan" ไม่ใช่ "Seq Scan"/"Sort")
-- ────────────────────────────────────────────
-- EXPLAIN SELECT id FROM conversations
--   WHERE page_id = '<ใส่ id ของเพจ>' AND (is_archived = false OR unread_count > 0)
--   ORDER BY last_message_at DESC NULLS LAST LIMIT 50;
