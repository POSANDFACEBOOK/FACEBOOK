-- ============================================
-- (ไม่บังคับ) ลบตารางของระบบยิงแอดเดิมออกจากฐานข้อมูล
-- ============================================
-- ⚠️ ลบแล้วกู้คืนไม่ได้ — ประวัติแคมเปญ ผลแอด ผลวิเคราะห์ AI และการแจ้งเตือนเดิมจะหายถาวร
-- ถ้าอยากเก็บไว้ดูย้อนหลัง ให้ Export ตารางเหล่านี้ใน Supabase ก่อน หรือไม่ต้องรันไฟล์นี้เลยก็ได้
-- (ระบบแชทไม่ได้ใช้ตารางเหล่านี้แล้ว ปล่อยไว้ก็ไม่มีผลอะไร)
-- ⚠️ รันหลังจากเว็บเวอร์ชันใหม่ (ที่ตัดระบบแอดออก) deploy เสร็จแล้วเท่านั้น
--
-- ไม่แตะตารางแชท: users, connected_pages, conversations, inbox_messages,
-- inbox_settings, quick_replies, page_members, team_invitations

BEGIN;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ai_analyses CASCADE;
DROP TABLE IF EXISTS ad_performance CASCADE;
DROP TABLE IF EXISTS ab_test_groups CASCADE;
DROP TABLE IF EXISTS ad_campaigns CASCADE;

-- คอลัมน์ของระบบแอดใน connected_pages
ALTER TABLE connected_pages DROP COLUMN IF EXISTS ad_account_id;
ALTER TABLE connected_pages DROP COLUMN IF EXISTS currency;

COMMIT;
