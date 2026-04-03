import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  let query = supabase.from('queue')
    .select('*, users(name, email), doctors(name), hospitals(name), departments(name)')
    .order('position');
  if (searchParams.get('status')) query = query.eq('status', searchParams.get('status')!);
  if (searchParams.get('hospital_id')) query = query.eq('hospital_id', searchParams.get('hospital_id')!);
  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const supabase = createServerClient();
  const { queue_id, action, doctor_id } = await req.json();
  if (!queue_id || !action) return NextResponse.json({ error: 'queue_id and action required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (action === 'complete') updates.status = 'completed';
  else if (action === 'cancel') updates.status = 'cancelled';
  else if (action === 'reassign' && doctor_id) updates.doctor_id = doctor_id;
  else return NextResponse.json({ error: 'invalid action' }, { status: 400 });

  const { data, error } = await supabase.from('queue').update(updates).eq('id', queue_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
