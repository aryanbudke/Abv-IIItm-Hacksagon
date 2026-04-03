import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Log for debugging in production
  console.log('Supabase client creation:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseServiceKey,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseServiceKey?.length || 0
  });

  // For production, if missing vars, throw clear error
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    
    throw new Error(`Missing Supabase environment variables. URL: ${!!supabaseUrl}, Key: ${!!supabaseServiceKey}`);
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}
