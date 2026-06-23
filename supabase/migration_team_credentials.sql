-- ============================================
-- FB Ads AI Manager — Email + Password Auth for Agents
-- รัน SQL นี้ใน Supabase SQL Editor (เพิ่มต่อจาก migration_team_roles.sql)
-- Backward-compatible: ผู้ใช้ FB OAuth เดิมไม่กระทบ
-- รันซ้ำได้ (idempotent)
-- ============================================

-- ────────────────────────────────────────────
-- 1) users: เพิ่ม password_hash + email_lower (เก็บ lowercased ของ email สำหรับ unique lookup)
-- ────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lower TEXT;

-- Backfill email_lower สำหรับ users เดิม (ถ้ามี email)
UPDATE users SET email_lower = LOWER(email) WHERE email IS NOT NULL AND email_lower IS NULL;

-- Unique index เฉพาะ row ที่มี email_lower (allow null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users(email_lower) WHERE email_lower IS NOT NULL;

-- facebook_id ต้อง nullable เพราะ agent ใช้ credentials ไม่มี FB account
ALTER TABLE users ALTER COLUMN facebook_id DROP NOT NULL;

-- ────────────────────────────────────────────
-- 2) team_invitations: เพิ่ม fields สำหรับ credentials method
-- ────────────────────────────────────────────
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'facebook'
  CHECK (auth_method IN ('facebook','credentials'));
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS invitee_email TEXT;
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS invitee_email_lower TEXT;
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS invitee_name TEXT;
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS initial_password_hash TEXT;

-- Index สำหรับ lookup pending invitation ตอน login credentials
CREATE INDEX IF NOT EXISTS idx_invites_pending_credentials
  ON team_invitations(invitee_email_lower, auth_method)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ────────────────────────────────────────────
-- 3) Cleanup: existing users ที่ facebook_id เป็น NOT NULL → ถ้ามี facebook_id ให้คงไว้
-- (ไม่ต้อง backfill อะไรเพิ่ม)
-- ────────────────────────────────────────────
