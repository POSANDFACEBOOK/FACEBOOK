-- ============================================
-- FB Ads AI Manager — Page nickname (ชื่อเล่นเพจ)
-- รันใน Supabase SQL Editor — รันซ้ำได้
-- ============================================

-- ชื่อเล่นเพจ (แสดงแทนชื่อเต็มในกล่องข้อความ เพื่อให้ดูสะอาด)
ALTER TABLE connected_pages ADD COLUMN IF NOT EXISTS nickname TEXT;
