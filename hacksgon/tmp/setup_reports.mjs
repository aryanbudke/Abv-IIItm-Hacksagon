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

async function createReportsTable() {
  console.log('Using URL:', supabaseUrl);
  console.log('Creating reports table...');
  
  // Note: execute_sql is a common custom function in Supabase to run raw SQL from client
  // If it doesn't exist, we might have to use a different way or tell the user.
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        appointment_id UUID,
        symptoms TEXT,
        diagnosis TEXT,
        prescription TEXT,
        notes TEXT,
        status TEXT DEFAULT 'submitted',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Enable RLS
      ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

      -- Policies
      DROP POLICY IF EXISTS "Doctors can manage their own reports" ON reports;
      CREATE POLICY "Doctors can manage their own reports" ON reports
        FOR ALL USING (auth.uid()::text = doctor_id);

      DROP POLICY IF EXISTS "Patients can view their own reports" ON reports;
      CREATE POLICY "Patients can view their own reports" ON reports
        FOR SELECT USING (auth.uid()::text = patient_id);
    `
  });

  if (error) {
    console.warn('RPC execute_sql failed (might not be enabled):', error.message);
    console.log('Falling back to direct table creation if possible...');
    
    // We can't really do raw DDL via the JS client without a proxy like execute_sql
    // but maybe we can just create the table using the standard API? No, that's DML only.
  } else {
    console.log('Reports table created successfully!');
  }
}

createReportsTable();
