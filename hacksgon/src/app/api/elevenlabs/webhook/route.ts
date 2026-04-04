import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { extractDCRValue, formatTranscript, resolveDate, resolveTime } from '@/lib/services/elevenLabsService';
import { createWorkflowAppointment } from '@/lib/services/workflowAppointmentService';

export async function POST(request: NextRequest) {
  // Verify ElevenLabs webhook signature
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get('ElevenLabs-Signature') || '';
    const rawBody = await request.text();

    // ElevenLabs signs as: HMAC-SHA256(secret, timestamp + '.' + body)
    const timestamp = signature.split(',').find(p => p.startsWith('t='))?.slice(2) || '';
    const sigValue = signature.split(',').find(p => p.startsWith('v0='))?.slice(3) || '';

    const { createHmac } = await import('crypto');
    const expected = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (expected !== sigValue) {
      return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    return handleWebhook(payload);
  }

  const payload = await request.json();
  return handleWebhook(payload);
}

async function handleWebhook(payload: Record<string, unknown>) {
  const conversationId = (payload.conversation_id || (payload.data as Record<string,unknown>)?.conversation_id) as string | undefined;
  if (!conversationId) return NextResponse.json({ success: false, error: 'missing conversation_id' });

  const data = (payload.data || {}) as Record<string, unknown>;
  const analysis = (data.analysis || {}) as Record<string, unknown>;
  const dcr = (analysis.data_collection_results || {}) as Record<string, unknown>;
  const callOutcome = extractDCRValue(dcr.call_outcome as never);
  const patientConfirmed = ['true','yes','1'].includes(extractDCRValue(dcr.patient_confirmed as never).toLowerCase());
  const confirmedDate = resolveDate(extractDCRValue(dcr.confirmed_date as never));
  const confirmedTime = resolveTime(extractDCRValue(dcr.confirmed_time as never));
  const appointmentReason = extractDCRValue(dcr.appointment_reason as never);
  const selectedHospitalKey = extractDCRValue(dcr.selected_hospital as never);
  const transcript = formatTranscript(data.transcript);

  const supabase = createServerClient();

  // ── Path A: patient_call_requests (Method A — patient-initiated callback) ──
  const { data: callRequest } = await supabase
    .from('patient_call_requests')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (callRequest) {
    // Resolve DTMF hospital selection from hospital_map stored in notes
    let resolvedHospitalId: string | null = callRequest.hospital_id || null;
    if (selectedHospitalKey) {
      try {
        const meta = JSON.parse(callRequest.notes || '{}');
        const map: Record<string, string> = meta.hospital_map || {};
        if (map[selectedHospitalKey]) resolvedHospitalId = map[selectedHospitalKey];
      } catch { /* notes not JSON or no map */ }
    }

    await supabase.from('patient_call_requests').update({
      status: patientConfirmed ? 'completed' : 'failed',
      call_transcript: transcript.slice(0, 10000),
      notes: callRequest.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', callRequest.id);

    if (patientConfirmed && confirmedDate && resolvedHospitalId) {
      try {
        const booking = await createWorkflowAppointment({
          supabase,
          patientId: callRequest.patient_id,
          doctorId: callRequest.doctor_id || null,
          hospitalId: resolvedHospitalId,
          date: confirmedDate,
          timeSlot: confirmedTime,
          source: 'call_confirmation',
          appointmentReason,
        });

        await supabase.from('patient_call_requests').update({
          appointment_id: booking.appointmentId,
        }).eq('id', callRequest.id);
      } catch (err) {
        console.error('[Webhook] patient_call_requests appointment creation failed:', err);
      }
    }

    return NextResponse.json({ success: true, source: 'patient_call_request', patient_confirmed: patientConfirmed });
  }

  // ── Path B: workflow_executions (workflow-triggered call) ──
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

  const log: Record<string, unknown>[] = [...(matched.execution_log || [])];

  // Resolve DTMF hospital selection using hospital_map stored in call step log
  const hospitalMapStr = log.find(s => s.hospital_map)?.hospital_map as string | undefined;
  const hospitalMap: Record<string, string> = hospitalMapStr ? JSON.parse(String(hospitalMapStr)) : {};
  const selectedHospitalId = selectedHospitalKey && hospitalMap[selectedHospitalKey]
    ? hospitalMap[selectedHospitalKey]
    : undefined;

  log.push({
    node_id: 'webhook', node_type: 'webhook', label: 'ElevenLabs Webhook',
    status: 'ok',
    message: `Outcome: ${callOutcome}. Confirmed: ${patientConfirmed}.${appointmentReason ? ` Reason: ${appointmentReason}.` : ''}`,
    timestamp: new Date().toISOString(), conversation_id: conversationId,
    call_outcome: callOutcome, patient_confirmed: patientConfirmed,
    confirmed_date: confirmedDate, confirmed_time: confirmedTime,
    appointment_reason: appointmentReason || null,
    selected_hospital_key: selectedHospitalKey || null,
    selected_hospital_id: selectedHospitalId || null,
  });

  await supabase.from('workflow_executions').update({
    status: 'completed', completed_at: new Date().toISOString(), execution_log: log,
    conversation_id: conversationId, call_outcome: callOutcome,
    call_transcript: transcript.slice(0,10000), patient_confirmed: patientConfirmed,
    confirmed_date: confirmedDate || null, confirmed_time: confirmedTime || null,
  }).eq('id', matched.id);

  if (patientConfirmed && confirmedDate) {
    const { data: wf } = await supabase.from('workflows').select('hospital_id,doctor_id').eq('id', matched.workflow_id).single();
    if (wf) {
      const resolvedHospitalId = selectedHospitalId || wf.hospital_id || null;
      try {
        const booking = await createWorkflowAppointment({
          supabase,
          patientId: matched.patient_id as string,
          doctorId: wf.doctor_id || null,
          hospitalId: resolvedHospitalId,
          date: confirmedDate,
          timeSlot: confirmedTime,
          source: 'call_confirmation',
          appointmentReason,
          executionId: matched.id as string,
        });

        log.push({
          node_id: 'appt_webhook', node_type: 'schedule_appointment',
          label: 'Appointment Created via Webhook', status: 'ok',
          message: `Appointment booked: ${confirmedDate} at ${confirmedTime}`,
          timestamp: new Date().toISOString(),
          appointment_id: booking.appointmentId,
        });
        await supabase.from('workflow_executions').update({ execution_log: log }).eq('id', matched.id);
      } catch (err) {
        console.error('[Webhook] Appointment creation failed:', err);
      }
    }
  }

  return NextResponse.json({ success: true, execution_id: matched.id, patient_confirmed: patientConfirmed });
}
