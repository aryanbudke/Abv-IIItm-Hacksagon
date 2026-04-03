import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check all environment variables
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'SET' : 'MISSING',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'SET' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    };

    // Test Supabase connection
    let supabaseTest = 'NOT_TESTED';
    try {
      const { createServerClient } = await import('@/lib/supabase/server');
      const supabase = createServerClient();
      const { data, error } = await supabase.from('hospitals').select('count').single();
      supabaseTest = error ? `ERROR: ${error.message}` : `SUCCESS: ${data?.count || 0} hospitals`;
    } catch (error: any) {
      supabaseTest = `EXCEPTION: ${error.message}`;
    }

    return NextResponse.json({
      environment: envVars,
      supabaseTest,
      timestamp: new Date().toISOString(),
      success: true
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      success: false
    }, { status: 500 });
  }
}
