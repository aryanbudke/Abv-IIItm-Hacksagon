-- Migration 010: Add chief_complaint to queue table
ALTER TABLE queue
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
