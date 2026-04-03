import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  let query = supabase.from('workflows').select('*').order('created_at', { ascending: false });
  if (searchParams.get('hospital_id')) query = query.eq('hospital_id', searchParams.get('hospital_id')!);
  if (searchParams.get('doctor_id'))   query = query.eq('doctor_id',   searchParams.get('doctor_id')!);
  if (searchParams.get('status'))      query = query.eq('status',      searchParams.get('status')!);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const { data, error } = await supabase.from('workflows').insert({
    hospital_id: body.hospital_id, doctor_id: body.doctor_id || null,
    name: body.name, description: body.description || null,
    category: body.category || 'Ungrouped', status: body.status || 'DRAFT',
    nodes: body.nodes || [], edges: body.edges || [],
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
