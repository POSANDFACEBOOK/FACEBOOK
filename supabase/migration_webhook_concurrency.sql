-- ============================================
-- FACEBOOK CHAT — กันข้อความที่เข้าพร้อมกันตีกัน (webhook หลาย request พร้อมกัน)
-- รันใน Supabase SQL Editor — รันซ้ำได้ ไม่ลบข้อมูล
--
-- แก้ 2 อย่าง:
-- 1) ตัวเลข "ใหม่" (unread_count) หาย — ลูกค้าส่งรัว 3 ข้อความ Facebook ยิง webhook พร้อมกัน
--    ทุกตัวอ่านค่าเดิม (0) แล้วเขียน 1 → ขึ้น 1 แทนที่จะเป็น 3 · แก้โดยบวกใน SQL คำสั่งเดียว
-- 2) ตอบอัตโนมัติซ้ำ — ลูกค้าพิมพ์ติดกัน 2 ข้อความ แล้วได้ข้อความบอทเหมือนกัน 2 รอบ
--    · แก้โดย "จอง" สิทธิ์ตอบไว้ที่ conversations.auto_reply_at ก่อนส่ง
--
-- โค้ดใหม่ทำงานได้แม้ยังไม่ได้รันไฟล์นี้ (จะกลับไปใช้วิธีเดิม + เขียน warning ใน log)
-- ============================================

-- ────────────────────────────────────────────
-- 1) จองสิทธิ์ตอบอัตโนมัติ (ตอบซ้ำได้ครั้งเดียวต่อ 1 ชม. ต่อแชท)
-- ────────────────────────────────────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS auto_reply_at TIMESTAMPTZ;

-- ────────────────────────────────────────────
-- 2) อัปเดตแชทเมื่อมีข้อความใหม่ — บวก unread_count ใน SQL (atomic)
--    ข้อความที่มาช้ากว่าข้อความล่าสุดในแชท (เช่นแอดมินตอบไปแล้ว) ห้ามทับ "ข้อความล่าสุด"
--    แต่ยังต้องนับ unread เสมอ (ไม่งั้นข้อความลูกค้าที่มาสลับลำดับจะไม่ขึ้นตัวเลข)
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bump_conversation_on_message(
  p_conv UUID,
  p_at TIMESTAMPTZ,
  p_preview TEXT,
  p_inbound BOOLEAN
) RETURNS VOID LANGUAGE sql AS $$
  UPDATE conversations SET
    unread_count = CASE
      WHEN p_inbound THEN COALESCE(unread_count, 0) + 1
      -- เพจตอบแล้ว (แม้ตอบจากแอป Facebook) = แอดมินอ่านแล้ว → ล้างตัวเลข "ใหม่"
      WHEN last_message_at IS NULL OR last_message_at <= p_at THEN 0
      ELSE unread_count END,
    last_message = CASE
      WHEN last_message_at IS NULL OR last_message_at <= p_at THEN p_preview
      ELSE last_message END,
    last_sender = CASE
      WHEN last_message_at IS NULL OR last_message_at <= p_at
        THEN (CASE WHEN p_inbound THEN 'customer' ELSE 'page' END)
      ELSE last_sender END,
    -- ลูกค้าทักกลับ → ส่งได้แล้ว → ล้างป้ายเตือน
    send_block_code = CASE WHEN p_inbound THEN NULL ELSE send_block_code END,
    send_block_at   = CASE WHEN p_inbound THEN NULL ELSE send_block_at END,
    last_message_at = CASE
      WHEN last_message_at IS NULL OR last_message_at <= p_at THEN p_at
      ELSE last_message_at END
  WHERE id = p_conv;
$$;

-- เรียกได้เฉพาะฝั่ง server (service_role) — client ไม่ต้องใช้ฟังก์ชันนี้
REVOKE EXECUTE ON FUNCTION bump_conversation_on_message(UUID, TIMESTAMPTZ, TEXT, BOOLEAN) FROM anon, authenticated;

-- ถ้ารันแล้วใน log ยังขึ้น "bump_conversation_on_message failed" → Supabase → Settings → API → Reload schema
