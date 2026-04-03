-- Medical Records Module Migration
-- Creates medical_records table and links it to queue entries

-- 1. Medical Records table
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,        -- 'pdf', 'image', etc.
  file_name TEXT,        -- original filename
  title TEXT NOT NULL,
  notes TEXT,
  record_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON medical_records(user_id);

-- 3. Link queue entries to a medical record (optional)
ALTER TABLE queue ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL;

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_medical_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_medical_records_updated_at ON medical_records;
CREATE TRIGGER trigger_update_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_medical_records_updated_at();

-- 5. Row Level Security
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Users can only see their own records
CREATE POLICY "Users can view own medical records"
  ON medical_records FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own medical records"
  ON medical_records FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own medical records"
  ON medical_records FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own medical records"
  ON medical_records FOR DELETE
  USING (user_id = auth.uid()::text);

-- 6. Supabase Storage bucket for medical record files
-- Run via Supabase dashboard or storage API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('medical-records', 'medical-records', false);
