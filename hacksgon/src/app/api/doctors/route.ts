import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json({ error: 'departmentId is required', data: [] }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('doctors')
      .select('id, name, specialization, average_treatment_time, is_on_leave, department_id, hospital_id')
      .eq('department_id', departmentId)
      .eq('is_on_leave', false)


    if (error) {
      console.error('Error fetching doctors:', error);
      return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }
}
