-- ============================================
-- FB Ads AI Manager — flag แชทที่ส่งไม่ได้ (ลูกค้าไม่พร้อมรับข้อความ)
-- รันใน Supabase SQL Editor — รันซ้ำได้
-- ============================================

-- เก็บ FB error code ที่ทำให้ส่งไม่ได้ (เช่น 551 = ปิดรับ/บล็อก, 10 = เกิน 24 ชม.)
-- null = ส่งได้ปกติ. ล้างอัตโนมัติเมื่อลูกค้าทักกลับมา
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS send_block_code INTEGER;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS send_block_at TIMESTAMPTZ;
