-- Migration: Add foreign key from reports.patient_id to users.id
-- This enables Supabase PostgREST to auto-join user data when querying reports
-- Applied via Supabase MCP on 2026-04-03

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_patient_id_fkey'
  ) THEN
    ALTER TABLE public.reports
    ADD CONSTRAINT reports_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Allow users who have reports to be readable (for patient name joins in history views)
-- Without this, RLS blocks the join since "Users can view own data" restricts to auth.uid() = id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow reading user info for reports'
  ) THEN
    CREATE POLICY "Allow reading user info for reports"
    ON public.users
    FOR SELECT
    USING (id IN (SELECT patient_id FROM public.reports));
  END IF;
END $$;

-- Reload PostgREST schema cache so the new FK is immediately usable for joins
NOTIFY pgrst, 'reload schema';
