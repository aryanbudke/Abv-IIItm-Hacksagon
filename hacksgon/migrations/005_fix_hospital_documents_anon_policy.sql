-- Migration 005: Allow anon role to upload and read hospital-documents
-- Needed because Supabase client uses anon key (auth is handled by Clerk, not Supabase Auth)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Allow anon uploads to hospital-documents'
  ) THEN
    CREATE POLICY "Allow anon uploads to hospital-documents"
      ON storage.objects FOR INSERT TO anon
      WITH CHECK (bucket_id = 'hospital-documents');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Allow anon reads from hospital-documents'
  ) THEN
    CREATE POLICY "Allow anon reads from hospital-documents"
      ON storage.objects FOR SELECT TO anon
      USING (bucket_id = 'hospital-documents');
  END IF;
END $$;
