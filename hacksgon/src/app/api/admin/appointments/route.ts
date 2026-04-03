import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  let query = supabase.from('appointments')
    .select('*, users(name, email), doctors(name), hospitals(name)')
    .order('date', { ascending: false });
  if (searchParams.get('status')) query = query.eq('status', searchParams.get('status')!);
  if (searchParams.get('hospital_id')) query = query.eq('hospital_id', searchParams.get('hospital_id')!);
  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const supabase = createServerClient();
  const { appointment_id, status } = await req.json();
  if (!appointment_id || !status) return NextResponse.json({ error: 'appointment_id and status required' }, { status: 400 });
  const { data, error } = await supabase.from('appointments').update({ status }).eq('id', appointment_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
