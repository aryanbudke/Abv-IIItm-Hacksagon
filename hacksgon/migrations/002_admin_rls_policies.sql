-- Migration 002: Add admin RLS policies for hospitals, doctors, and departments
-- These allow full management via the service role key used server-side

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hospitals' AND policyname = 'Admins can manage hospitals'
  ) THEN
    CREATE POLICY "Admins can manage hospitals" ON hospitals
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'doctors' AND policyname = 'Admins can manage doctors'
  ) THEN
    CREATE POLICY "Admins can manage doctors" ON doctors
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Admins can manage departments'
  ) THEN
    CREATE POLICY "Admins can manage departments" ON departments
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
