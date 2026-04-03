import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('doctors')
      .select('id, name, specialization, qualification, experience, rating, department_id, departments(name), hospitals(name)')
      .eq('is_on_leave', false)
      .order('rating', { ascending: false })
      .limit(6);

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}
