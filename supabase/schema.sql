-- ============================================
-- FB Ads AI Manager - Supabase Schema
-- รัน SQL นี้ใน Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ตาราง Users (sync กับ NextAuth)
CREATE TABLE users (
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

-- ตาราง Facebook Pages ที่เชื่อมต่อ
CREATE TABLE connected_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,          -- Facebook Page ID
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,-- Page Access Token (ไม่หมดอายุ)
  page_picture TEXT,
  ad_account_id TEXT,             -- Facebook Ad Account ID (act_xxx)
  currency TEXT DEFAULT 'THB',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

-- ตาราง Ad Campaigns ที่สร้าง
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  page_id UUID REFERENCES connected_pages(id) ON DELETE CASCADE,
  
  -- Facebook IDs
  fb_campaign_id TEXT,            -- Facebook Campaign ID
  fb_adset_id TEXT,               -- Facebook Ad Set ID
  fb_ad_id TEXT,                  -- Facebook Ad ID
  fb_post_id TEXT NOT NULL,       -- Post ที่ boost
  
  -- ข้อมูล Campaign
  campaign_name TEXT NOT NULL,
  post_message TEXT,              -- ข้อความโพสต์
  post_image TEXT,                -- รูปโพสต์
  
  -- Budget & Schedule
  daily_budget NUMERIC(10,2),     -- งบต่อวัน (หน่วย: บาท)
  lifetime_budget NUMERIC(10,2),  -- งบรวม
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  
  -- Targeting
  target_age_min INTEGER DEFAULT 18,
  target_age_max INTEGER DEFAULT 65,
  target_genders TEXT[] DEFAULT '{}',  -- ['1','2'] = ชาย,หญิง
  target_locations JSONB DEFAULT '[]', -- [{country:'TH',cities:[...]}]
  target_interests JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','error')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง Ad Performance (เก็บ metrics ทุก 6 ชั่วโมง)
CREATE TABLE ad_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  
  -- Facebook Metrics
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  cpm NUMERIC(10,4),              -- Cost per 1000 impressions
  cpc NUMERIC(10,4),              -- Cost per click
  ctr NUMERIC(10,4),              -- Click through rate %
  frequency NUMERIC(10,4),        -- ความถี่ที่เห็นโฆษณา
  
  -- Engagement
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reactions INTEGER DEFAULT 0,
  
  -- Advanced
  unique_clicks INTEGER DEFAULT 0,
  post_engagement INTEGER DEFAULT 0,
  
  -- Budget remaining
  budget_remaining NUMERIC(10,2),
  
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง AI Analysis (ผล AI วิเคราะห์)
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  
  -- AI Recommendation
  recommendation TEXT CHECK (recommendation IN (
    'increase_budget',    -- เพิ่มงบ
    'decrease_budget',    -- ลดงบ
    'change_targeting',   -- เปลี่ยน targeting
    'pause_ad',           -- หยุดโฆษณา
    'keep_running',       -- ปล่อยต่อ
    'extend_duration'     -- ต่อเวลา
  )),
  confidence_score NUMERIC(3,2),   -- 0.00-1.00
  
  -- AI Analysis Detail
  summary TEXT NOT NULL,           -- สรุปภาษาไทย
  reasoning TEXT,                  -- เหตุผล
  action_items JSONB DEFAULT '[]', -- ขั้นตอนที่แนะนำ
  
  -- Performance snapshot ตอน analyze
  performance_snapshot JSONB,
  
  -- Action taken
  action_taken BOOLEAN DEFAULT FALSE,
  action_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  type TEXT NOT NULL,              -- 'ai_alert','budget_warning','campaign_ended'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_campaigns_user ON ad_campaigns(user_id);
CREATE INDEX idx_campaigns_status ON ad_campaigns(status);
CREATE INDEX idx_performance_campaign ON ad_performance(campaign_id);
CREATE INDEX idx_performance_fetched ON ad_performance(fetched_at);
CREATE INDEX idx_analyses_campaign ON ai_analyses(campaign_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: users เห็นแค่ข้อมูลตัวเอง
CREATE POLICY "users_own_data" ON users FOR ALL USING (id = auth.uid()::UUID);
CREATE POLICY "pages_own_data" ON connected_pages FOR ALL USING (user_id = auth.uid()::UUID);
CREATE POLICY "campaigns_own_data" ON ad_campaigns FOR ALL USING (user_id = auth.uid()::UUID);
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid()::UUID);

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON ad_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
