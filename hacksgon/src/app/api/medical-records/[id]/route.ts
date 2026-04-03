import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/server';

// PATCH /api/medical-records/[id] — update title, notes, record_date
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, notes, record_date } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('medical_records')
      .update({ title, notes, record_date })
      .eq('id', resolvedParams.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ record: data });
  } catch (err: any) {
    console.error('[medical-records PATCH]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/medical-records/[id] — delete record (and optionally its file)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch first so we can clean up storage
    const { data: record } = await supabase
      .from('medical_records')
      .select('file_url, file_name')
      .eq('id', resolvedParams.id)
      .eq('user_id', userId)
      .single();

    if (record?.file_url && record?.file_name) {
      const path = `${userId}/${record.file_name}`;
      await supabase.storage.from('medical-records').remove([path]);
    }

    const { error } = await supabase
      .from('medical_records')
      .delete()
      .eq('id', resolvedParams.id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[medical-records DELETE]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
