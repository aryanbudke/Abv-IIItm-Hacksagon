-- Add missing updated_at column to users table
-- The trigger update_users_updated_at references NEW.updated_at but the column is absent in the live DB

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
