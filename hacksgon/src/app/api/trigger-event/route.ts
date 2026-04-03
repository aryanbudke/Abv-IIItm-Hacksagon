import { NextRequest, NextResponse } from 'next/server';
import { fireEvent } from '@/lib/workflow/triggers';

export async function POST(req: NextRequest) {
  const { trigger_type, patient_id, metadata } = await req.json();
  if (!trigger_type || !patient_id) {
    return NextResponse.json({ error: 'trigger_type and patient_id required' }, { status: 400 });
  }
  await fireEvent(trigger_type, patient_id, metadata || {});
  return NextResponse.json({ success: true, trigger_type, patient_id });
}
