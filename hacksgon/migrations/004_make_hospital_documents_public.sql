-- Migration 004: Make hospital-documents bucket public so license URLs are accessible

UPDATE storage.buckets SET public = true WHERE id = 'hospital-documents';
