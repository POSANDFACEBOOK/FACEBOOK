-- ============================================
-- FACEBOOK CHAT NAIWANSOOK — Supabase Schema (ตารางพื้นฐาน)
-- ติดตั้งใหม่: รันไฟล์นี้ก่อน แล้วรัน migration ตามลำดับใน README.md
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ผู้ใช้ (เจ้าของเพจที่ล็อกอินด้วย Facebook / แอดมินที่ล็อกอินด้วยอีเมล)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facebook_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  image TEXT,
  access_token TEXT, -- Facebook User Access Token
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ช่องทางแชทที่เชื่อมไว้ (เพจ Facebook — LINE OA เพิ่มคอลัมน์ใน migration_line_channel.sql)
CREATE TABLE IF NOT EXISTS connected_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,           -- Facebook Page ID
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL, -- Page Access Token
  page_picture TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON users;
CREATE POLICY "users_own_data" ON users FOR ALL USING (id = auth.uid()::UUID);
DROP POLICY IF EXISTS "pages_own_data" ON connected_pages;
CREATE POLICY "pages_own_data" ON connected_pages FOR ALL USING (user_id = auth.uid()::UUID);

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
