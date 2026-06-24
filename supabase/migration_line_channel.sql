-- ============================================
-- FB Ads AI Manager — LINE Official Account channel
-- รัน SQL นี้ใน Supabase SQL Editor — รันซ้ำได้
-- ใช้สถาปัตยกรรมเดิม: LINE OA = แถวใน connected_pages (channel='line')
--   → inbox / สิทธิ์ (page_members) / AI / quick replies ทำงานต่อได้เลย
-- ============================================

-- ช่องทาง: 'facebook' (เดิม) | 'line'
ALTER TABLE connected_pages ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'facebook';

-- LINE channel secret (ใช้ verify ลายเซ็น webhook) — page_access_token เก็บ LINE channel access token
ALTER TABLE connected_pages ADD COLUMN IF NOT EXISTS line_channel_secret TEXT;

-- mapping สำหรับ LINE (เก็บใน column เดิมแบบ generic):
--   page_id        = LINE bot userId (destination ใน webhook)
--   page_name      = LINE OA display name
--   page_picture   = LINE OA picture
--   page_access_token = LINE channel access token (long-lived)
-- conversations:
--   fb_page_id = LINE bot userId, fb_psid = LINE userId ของลูกค้า (UNIQUE เดิมใช้ได้)

CREATE INDEX IF NOT EXISTS idx_connected_pages_channel ON connected_pages(channel);
