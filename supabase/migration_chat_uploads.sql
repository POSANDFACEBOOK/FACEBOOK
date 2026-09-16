-- ============================================
-- FACEBOOK CHAT — Storage bucket สำหรับรูปที่แอดมินส่งในแชท
-- รันใน Supabase SQL Editor — รันซ้ำได้
-- ============================================

-- bucket แบบ public (FB/LINE ต้องเข้าถึง URL รูปได้เพื่อดึงไปส่งให้ลูกค้า)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-uploads',
  'chat-uploads',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp'];

-- bucket เป็น public อยู่แล้ว → เปิดรูปผ่าน URL /object/public/... ได้โดยไม่ต้องมี policy SELECT
-- ห้ามสร้าง policy SELECT ให้ anon/authenticated: มันไม่ได้ช่วยให้ "ดูรูป" แต่ทำให้ใครก็ตามที่มี anon key
-- (ฝังอยู่ในหน้าเว็บ) "ไล่ดูรายชื่อไฟล์ทั้ง bucket" ได้ — รวมรูปโปรไฟล์ลูกค้าทุกคนใน avatars/
DROP POLICY IF EXISTS "chat_uploads_public_read" ON storage.objects;

-- เขียน/ลบ ทำผ่าน service role (API /api/inbox/upload) เท่านั้น — service role bypass RLS
-- ปฏิเสธ anon/authenticated อย่างชัดเจน (defense-in-depth) เผื่อ key หลุด
DROP POLICY IF EXISTS "chat_uploads_no_client_write" ON storage.objects;
CREATE POLICY "chat_uploads_no_client_write" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "chat_uploads_no_client_delete" ON storage.objects;
CREATE POLICY "chat_uploads_no_client_delete" ON storage.objects
  FOR DELETE TO anon, authenticated USING (false);
