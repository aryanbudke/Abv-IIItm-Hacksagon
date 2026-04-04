import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`${name}=(.*)`));
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createBucket() {
  console.log('Creating "medical-records" storage bucket...');

  const { data, error } = await supabase.storage.createBucket('medical-records', {
    public: false, // private bucket, we use signed URLs
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  });

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate key value')) {
      console.log('Bucket "medical-records" already exists!');
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket "medical-records" created successfully!', data);
  }

  // Also verify/create medical_records table just in case it's missing
  console.log('Verifying medical_records table exists...');
  const { error: rpcError } = await supabase.rpc('execute_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        record_date DATE,
        file_url TEXT,
        file_type TEXT,
        file_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can manage their own records" ON medical_records;
      CREATE POLICY "Users can manage their own records" ON medical_records
        FOR ALL USING (auth.uid()::text = user_id);
    `
  });
  
  if (rpcError) {
    console.warn('Could not run raw DDL for medical_records (RPC missing). Please ensure the table is created manually if not present.', rpcError.message);
  } else {
    console.log('medical_records table verified/created successfully.');
  }
}

createBucket();
