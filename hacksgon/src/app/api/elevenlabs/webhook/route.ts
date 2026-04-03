import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { extractDCRValue, formatTranscript, resolveDate, resolveTime } from '@/lib/services/elevenLabsService';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const conversationId = payload.conversation_id || payload.data?.conversation_id;
  if (!conversationId) return NextResponse.json({ success: false, error: 'missing conversation_id' });

  const analysis = payload.data?.analysis || {};
  const dcr = analysis.data_collection_results || {};
  const callOutcome = extractDCRValue(dcr.call_outcome);
  const patientConfirmed = ['true','yes','1'].includes(extractDCRValue(dcr.patient_confirmed).toLowerCase());
  const confirmedDate = resolveDate(extractDCRValue(dcr.confirmed_date));
  const confirmedTime = resolveTime(extractDCRValue(dcr.confirmed_time));
  const transcript = formatTranscript(payload.data?.transcript);

  const supabase = createServerClient();

  const { data: executions } = await supabase
    .from('workflow_executions').select('*').eq('status','running')
    .order('started_at', { ascending: false }).limit(50);

  let matched = executions?.find((e: Record<string, unknown>) =>
    (e.execution_log as Record<string,unknown>[] || []).some((s: Record<string,unknown>) => s.conversation_id === conversationId)
  ) || null;

  if (!matched) {
    const { data } = await supabase.from('workflow_executions')
      .select('*').eq('conversation_id', conversationId).single();
    matched = data;
  }

  if (!matched) return NextResponse.json({ success: false, error: 'no matching execution' });

  const log = [...(matched.execution_log || [])];
  log.push({
    node_id: 'webhook', node_type: 'webhook', label: 'ElevenLabs Webhook',
    status: 'ok', message: `Outcome: ${callOutcome}. Confirmed: ${patientConfirmed}.`,
    timestamp: new Date().toISOString(), conversation_id: conversationId,
    call_outcome: callOutcome, patient_confirmed: patientConfirmed,
    confirmed_date: confirmedDate, confirmed_time: confirmedTime,
  });

  await supabase.from('workflow_executions').update({
    status: 'completed', completed_at: new Date().toISOString(), execution_log: log,
    conversation_id: conversationId, call_outcome: callOutcome,
    call_transcript: transcript.slice(0,10000), patient_confirmed: patientConfirmed,
    confirmed_date: confirmedDate || null, confirmed_time: confirmedTime || null,
  }).eq('id', matched.id);

  if (patientConfirmed && confirmedDate) {
    const { data: wf } = await supabase.from('workflows').select('hospital_id,doctor_id').eq('id', matched.workflow_id).single();
    const { data: pat } = await supabase.from('users').select('name').eq('id', matched.patient_id).single();
    if (wf && pat) {
      await supabase.from('appointments').insert({
        patient_id: matched.patient_id, patient_name: pat.name,
        hospital_id: wf.hospital_id, doctor_id: wf.doctor_id,
        date: confirmedDate, time_slot: confirmedTime, status: 'confirmed', otp_verified: true,
      });
    }
  }

  return NextResponse.json({ success: true, execution_id: matched.id, patient_confirmed: patientConfirmed });
}
