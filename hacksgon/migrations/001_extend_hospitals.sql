-- Migration 001: Extend hospitals table with license and metadata fields
ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS license_expiry DATE,
  ADD COLUMN IF NOT EXISTS license_document_url TEXT,
  ADD COLUMN IF NOT EXISTS hospital_type TEXT CHECK (hospital_type IN ('government', 'private', 'clinic', 'multi-specialty', 'trust')) DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS bed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accreditation TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_hospitals_is_active ON hospitals(is_active);
CREATE INDEX IF NOT EXISTS idx_hospitals_type ON hospitals(hospital_type);
