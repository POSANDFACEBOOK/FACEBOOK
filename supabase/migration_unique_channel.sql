-- ============================================
-- FACEBOOK CHAT — กันช่องทางเดียวกันถูกเชื่อมซ้ำ 2 บัญชี
-- รันใน Supabase SQL Editor — รันซ้ำได้ ไม่ลบ/ไม่แก้ข้อมูล
-- ============================================
-- ถ้าเพจ FB / LINE OA เดียวกันมี 2 แถว webhook จะหาช่องทางไม่เจอ → ข้อความของช่องทางนั้นหายทั้งหมด
-- ระบบเช็คให้แล้วตอนกดเชื่อม ไฟล์นี้เพิ่มกันชั้นสุดท้ายที่ฐานข้อมูล (กันกดพร้อมกัน 2 คน)
--
-- ผลที่ได้:
--   "Success. No rows returned"          = เรียบร้อย
--   error "could not create unique index" = มีช่องทางซ้ำอยู่แล้ว (ไม่มีอะไรถูกเปลี่ยน) → ส่งข้อความ error ให้ผู้พัฒนาดู

CREATE UNIQUE INDEX IF NOT EXISTS connected_pages_channel_page_uniq
  ON connected_pages (channel, page_id);
