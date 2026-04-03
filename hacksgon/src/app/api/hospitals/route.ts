import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('hospitals')
      .select('id, name, address, city, phone, email')
      .order('name');

    if (error) {
      console.error('Error fetching hospitals:', error);
      return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], count: data?.length || 0 });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }
}
