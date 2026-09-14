-- ============================================
-- FACEBOOK CHAT — กันช่องทางเดียวกันถูกเชื่อมซ้ำ 2 บัญชี
-- รันใน Supabase SQL Editor — รันซ้ำได้ ไม่ลบข้อมูล
-- ============================================
-- ถ้าเพจ FB / LINE OA เดียวกันมี 2 แถว webhook จะหาช่องทางไม่เจอ → ข้อความของช่องทางนั้นหายทั้งหมด
-- ระบบเช็คให้แล้วตอนกดเชื่อม ไฟล์นี้เพิ่มกันชั้นสุดท้ายที่ฐานข้อมูล (กันกดพร้อมกัน 2 คน)

-- 1) ดูก่อนว่ามีซ้ำอยู่แล้วไหม (ถ้ามีแถวออกมา ให้ส่งผลให้ผู้พัฒนาดูก่อน — ขั้นที่ 2 จะข้ามไปเอง)
SELECT channel, page_id, COUNT(*) AS rows, array_agg(page_name) AS names
FROM connected_pages
GROUP BY channel, page_id
HAVING COUNT(*) > 1;

-- 2) สร้าง unique index เฉพาะเมื่อไม่มีข้อมูลซ้ำ
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM connected_pages GROUP BY channel, page_id HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'พบช่องทางซ้ำ — ยังไม่สร้าง index (ดูผลจากขั้นที่ 1)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'connected_pages_channel_page_uniq'
  ) THEN
    CREATE UNIQUE INDEX connected_pages_channel_page_uniq ON connected_pages (channel, page_id);
  END IF;
END $$;
