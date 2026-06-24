-- ============================================
-- FB Ads AI Manager — Storage bucket สำหรับรูปที่แอดมินส่งในแชท
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

-- อ่านได้แบบ public (ดูรูปได้ทุกคนที่มี URL — จำเป็นสำหรับ FB/LINE)
DROP POLICY IF EXISTS "chat_uploads_public_read" ON storage.objects;
CREATE POLICY "chat_uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-uploads');

-- เขียน/ลบ ทำผ่าน service role (API /api/inbox/upload) เท่านั้น — service role bypass RLS
-- ปฏิเสธ anon/authenticated อย่างชัดเจน (defense-in-depth) เผื่อ key หลุด
DROP POLICY IF EXISTS "chat_uploads_no_client_write" ON storage.objects;
CREATE POLICY "chat_uploads_no_client_write" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "chat_uploads_no_client_delete" ON storage.objects;
CREATE POLICY "chat_uploads_no_client_delete" ON storage.objects
  FOR DELETE TO anon, authenticated USING (false);
