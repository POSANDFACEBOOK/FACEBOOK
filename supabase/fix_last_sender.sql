-- ============================================
-- แก้ค่า last_sender ของแชทเก่าให้ตรงกับข้อความล่าสุดจริง
-- (ทำให้ตัวกรอง "ยังไม่ตอบ" นับถูกต้อง — ก่อนหน้านี้ค้างค่าเก่าเป็น 'customer')
-- รันครั้งเดียวใน Supabase SQL Editor — รันซ้ำได้ ปลอดภัย
-- ============================================

UPDATE conversations c
SET last_sender = sub.ls
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    CASE WHEN direction = 'outbound' THEN 'page' ELSE 'customer' END AS ls
  FROM inbox_messages
  ORDER BY conversation_id, created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.last_sender IS DISTINCT FROM sub.ls;
