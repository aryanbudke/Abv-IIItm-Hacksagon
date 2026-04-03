-- Migration 003: Create storage bucket for hospital license documents

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hospital-documents',
  'hospital-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Allow authenticated uploads to hospital-documents'
  ) THEN
    CREATE POLICY "Allow authenticated uploads to hospital-documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'hospital-documents');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Allow authenticated reads from hospital-documents'
  ) THEN
    CREATE POLICY "Allow authenticated reads from hospital-documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'hospital-documents');
  END IF;
END $$;
