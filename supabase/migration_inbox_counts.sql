-- ============================================
-- FACEBOOK CHAT — นับแชท "ใหม่ / ยังไม่ตอบ" แยกตามเพจในฐานข้อมูล
-- รัน SQL นี้ใน Supabase SQL Editor (รันซ้ำได้ ไม่ลบข้อมูลอะไรทั้งสิ้น)
-- ============================================
--
-- ทำไมต้องมี: เดิม /api/inbox/conversations ดึง "ทุกแถว" ที่เข้าเงื่อนไขมานับใน JS
-- แต่ PostgREST ตัดผลลัพธ์ที่ 1000 แถว → ร้านที่แชทเยอะ ตัวเลขบนการ์ดเพจจะขาด
-- และไม่ตรงกับตัวเลขรวมบนชิป แอดมินเลยไม่รู้ว่าเพจไหนมีลูกค้าค้างจริง
--
-- ยังไม่รันไฟล์นี้ก็ใช้งานได้ — โค้ดจะถอยไปนับด้วย count query รายเพจแทน (ช้ากว่าเล็กน้อย)
--
-- นิยามตัวเลข (ต้องตรงกับ src/app/api/inbox/conversations/route.ts):
-- - unread      = แชทที่ยังไม่ได้เปิดอ่าน (unread_count > 0) — นับแชทที่ "จัดเก็บ" ไว้ด้วย
--                 เพราะลูกค้าเก่าที่กลับมาทักต้องเด้งกลับเข้ากล่องข้อความ ห้ามหายเงียบ
-- - needs_reply = เปิดอ่านแล้วแต่ยังไม่ได้ตอบ (ลูกค้าพิมพ์ล่าสุด) และยังไม่ถูกจัดเก็บ

CREATE OR REPLACE FUNCTION inbox_page_counts(p_page_ids uuid[])
RETURNS TABLE(page_id uuid, unread bigint, needs_reply bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT c.page_id,
         count(*) FILTER (WHERE c.unread_count > 0),
         count(*) FILTER (WHERE c.last_sender = 'customer' AND c.unread_count <= 0 AND c.is_archived = false)
  FROM conversations c
  WHERE c.page_id = ANY(p_page_ids)
  GROUP BY c.page_id;
$$;

-- เรียกผ่าน service role (ฝั่ง server) เท่านั้น — ห้ามให้ anon key เรียกได้
REVOKE ALL ON FUNCTION inbox_page_counts(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION inbox_page_counts(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION inbox_page_counts(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION inbox_page_counts(uuid[]) TO service_role;

-- ช่วยตัวกรอง "ยังไม่ตอบ" ของรายการแชท (แชทที่ยังไม่จัดเก็บ)
CREATE INDEX IF NOT EXISTS idx_conv_page_active ON conversations(page_id) WHERE is_archived = false;
