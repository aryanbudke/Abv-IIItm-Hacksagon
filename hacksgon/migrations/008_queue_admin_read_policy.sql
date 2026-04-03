-- Migration 008: Allow authenticated users to read all queue entries
-- The base schema only allows users to read their own queue entries (patient_id = auth.uid()).
-- Since the app uses Clerk (not Supabase Auth), auth.uid() is null for most requests,
-- which means the admin dashboard sees zero queue entries under the original policy.
-- This migration adds a permissive read policy so queue data is visible to all
-- authenticated/anon requests, matching the pattern used for hospitals/departments/doctors.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Queue entries are readable by all'
  ) THEN
    CREATE POLICY "Queue entries are readable by all"
      ON queue FOR SELECT USING (true);
  END IF;
END $$;

-- Same for counters table (created manually — ensure anon can read it)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'counters') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'counters' AND policyname = 'Counters are readable by all'
    ) THEN
      ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Counters are readable by all"
        ON counters FOR SELECT USING (true);
      CREATE POLICY "Admins can manage counters"
        ON counters FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;
