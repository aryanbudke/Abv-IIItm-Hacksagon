/**
 * ElevenLabs Conversational AI + Twilio call poller.
 */
import { createServerClient } from '@/lib/supabase/server';
import { createWorkflowAppointment } from '@/lib/services/workflowAppointmentService';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export interface CallParams {
  patientPhone: string;
  patientName: string;
  doctorName: string;
  labResultSummary?: string;
  facilityName?: string;
  facilityAddress?: string;
  facilityPhoneNumber?: string;
  callReason?: string;
  availableSlots?: string;
  extraContext?: Record<string, string>;
}

interface DCRField {
  value: string | boolean | null;
  rationale?: string;
}

interface TranscriptMsg {
  role: string;
  message: string;
  time_in_call_secs?: number;
}

async function updateExecutionWithFallback(
  supabase: ReturnType<typeof createServerClient>,
  executionId: string,
  fullPayload: Record<string, unknown>
) {
  const attempts: Record<string, unknown>[] = [
    fullPayload,
    {
      status: fullPayload.status,
      completed_at: fullPayload.completed_at,
      execution_log: fullPayload.execution_log,
      conversation_id: fullPayload.conversation_id,
    },
    {
      status: fullPayload.status,
      completed_at: fullPayload.completed_at,
      execution_log: fullPayload.execution_log,
    },
    {
      status: fullPayload.status,
      completed_at: fullPayload.completed_at,
    },
  ];

  let lastError: unknown = null;
  for (const payload of attempts) {
    const { error } = await supabase
      .from('workflow_executions')
      .update(payload)
      .eq('id', executionId);
    if (!error) return;
    lastError = error;
    console.warn('[Poller] Update attempt failed, trying fallback payload:', {
      executionId,
      keys: Object.keys(payload),
      error,
    });
  }

  throw lastError;
}

export async function initiateOutboundCall(params: CallParams): Promise<{ conversation_id: string; callSid?: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');
  if (!agentId) throw new Error('ELEVENLABS_AGENT_ID not configured');
  if (!phoneNumberId) throw new Error('ELEVENLABS_PHONE_NUMBER_ID not configured');

  const dynamicVariables = {
    patient_name: params.patientName,
    doctor_name: params.doctorName,
    lab_result_summary: params.labResultSummary || 'recent lab results',
    facility_name: params.facilityName || 'our medical centre',
    facility_address: params.facilityAddress || '',
    facility_phone_number: params.facilityPhoneNumber || '',
    call_reason: params.callReason || 'a follow-up regarding your health',
    reason: params.callReason || 'a follow-up',
    available_slots: params.availableSlots || 'Monday at 10:00 AM, Wednesday at 2:00 PM, Friday at 9:00 AM',
    ...(params.extraContext || {}),
  };

  const res = await fetch(`${ELEVENLABS_BASE}/convai/twilio/outbound-call`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: params.patientPhone,
      conversation_initiation_client_data: { dynamic_variables: dynamicVariables },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && body.includes('missing_permissions')) {
      throw new Error(
        'ElevenLabs API key is missing ConvAI permissions. Enable at least convai_read and outbound calling permissions for this key, then try again.'
      );
    }
    throw new Error(`ElevenLabs error ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (data.success === false) throw new Error(`ElevenLabs setup failure: ${data.message}`);
  return data;
}

export async function getConversation(conversationId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

  const res = await fetch(`${ELEVENLABS_BASE}/convai/conversations/${conversationId}`, {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && body.includes('missing_permissions')) {
      throw new Error(
        'ElevenLabs API key is missing ConvAI read permission. Enable convai_read for this key.'
      );
    }
    throw new Error(`ElevenLabs error ${res.status}: ${body}`);
  }
  return res.json();
}

export function extractDCRValue(field: DCRField | string | null | undefined): string {
  if (!field) return '';
  if (typeof field === 'object' && 'value' in field) {
    const v = String(field.value ?? '').trim();
    return v.toLowerCase() === 'none' ? '' : v;
  }
  return String(field).trim();
}

export function formatTranscript(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return (raw as TranscriptMsg[])
      .map(m => `${m.time_in_call_secs != null ? `[${m.time_in_call_secs}s] ` : ''}${m.role}: ${m.message}`)
      .join('\n');
  }
  return String(raw || '');
}

export function resolveDate(raw: string): string {
  if (!raw || raw.toLowerCase() === 'none') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const today = new Date();
  const lower = raw.toLowerCase().trim();
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const idx = days.indexOf(lower);
  if (idx !== -1) {
    const diff = ((idx - today.getDay()) + 7) % 7 || 7;
    const d = new Date(today); d.setDate(today.getDate() + diff);
    return d.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') { const d = new Date(today); d.setDate(today.getDate()+1); return d.toISOString().split('T')[0]; }
  if (lower === 'today') return today.toISOString().split('T')[0];

  const m = raw.match(/([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (m) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3] || today.getFullYear()}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return '';
}

export function resolveTime(raw: string): string {
  if (!raw || raw.toLowerCase() === 'none') return '09:00';
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':').map(Number);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (match) {
    let h = parseInt(match[1]); const min = match[2] ? parseInt(match[2]) : 0;
    const mer = match[3]?.toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }
  return '09:00';
}

function detectConfirmation(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return ['yes','that works','sounds good','perfect','confirmed','book that',
    'schedule that',"that's fine",'sure','i would like','please book',
    'appointment confirmed'].some(p => lower.includes(p));
}

function extractDateTimeFromText(text: string, fallbackTime = ''): [string, string] {
  const dayMatch = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i);
  const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/);
  const dateMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s*\d{4})?\b/i);

  const date = resolveDate(dayMatch?.[1] || dateMatch?.[0] || '');
  const time = resolveTime(timeMatch?.[1] || fallbackTime);
  return [date, time];
}

export async function pollCallResult(executionId: string): Promise<void> {
  console.log(`[Poller] Starting for execution ${executionId}`);
  await sleep(15_000);

  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      const sync = await syncExecutionCallStatus(executionId);
      console.log(`[Poller] Attempt ${attempt}: status=${sync.status || sync.reason || 'unknown'}`);
      if (sync.updated || sync.terminal) return;
      await sleep(30_000);
    } catch (err) {
      console.warn(`[Poller] Attempt ${attempt} error:`, err);
      await sleep(30_000);
    }
  }
  console.warn(`[Poller] Max attempts reached for ${executionId}`);
}

export async function syncExecutionCallStatus(executionId: string): Promise<{
  updated: boolean;
  terminal: boolean;
  status?: string;
  reason?: string;
}> {
  const supabase = createServerClient();
  const { data: exec, error: execError } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('id', executionId)
    .single();

  if (execError) {
    console.warn('[CallSync] Failed to load execution:', { executionId, execError });
    return { updated: false, terminal: false, reason: 'execution_fetch_failed' };
  }
  if (!exec) return { updated: false, terminal: true, reason: 'execution_missing' };
  if (['completed', 'failed'].includes(String(exec.status || '').toLowerCase())) {
    return { updated: false, terminal: true, status: String(exec.status || '') };
  }

  const log: Record<string, unknown>[] = Array.isArray(exec.execution_log) ? exec.execution_log : [];
  const conversationId =
    (exec.conversation_id as string | undefined) ||
    (log.find(step => step?.conversation_id)?.conversation_id as string | undefined);

  if (!conversationId) {
    return { updated: false, terminal: false, reason: 'conversation_missing' };
  }

  const conversation = await getConversation(conversationId);
  const rawStatus = String(conversation.status || '');
  const normalizedStatus = rawStatus.toLowerCase().replace(/-/g, '_');
  if (['in_progress', 'processing', 'initiated', 'ringing', 'queued'].includes(normalizedStatus)) {
    return { updated: false, terminal: false, status: normalizedStatus };
  }

  const analysis = conversation.analysis || {};
  const dcr = analysis.data_collection_results || {};
  const summary = analysis.transcript_summary || '';
  const transcript = formatTranscript(conversation.transcript);

  let callOutcome = extractDCRValue(dcr.call_outcome);
  let confirmedDate = resolveDate(extractDCRValue(dcr.confirmed_date));
  let confirmedTime = resolveTime(extractDCRValue(dcr.confirmed_time));
  let patientConfirmed = ['true','yes','1'].includes(extractDCRValue(dcr.patient_confirmed).toLowerCase());

  if (!patientConfirmed && summary) {
    patientConfirmed = ['confirmed','chose','selected','booked','scheduled','agreed'].some(p => summary.toLowerCase().includes(p));
  }
  if (!patientConfirmed && transcript) patientConfirmed = detectConfirmation(transcript);
  if (patientConfirmed && !confirmedDate) {
    [confirmedDate, confirmedTime] = extractDateTimeFromText(summary || transcript, confirmedTime);
  }
  if (!callOutcome) callOutcome = patientConfirmed ? 'confirmed' : 'completed';

  log.push({
    node_id: 'auto_poll',
    node_type: 'poll_result',
    label: 'ElevenLabs Call Completed',
    status: 'ok',
    message: `Outcome: ${callOutcome}. Patient confirmed: ${patientConfirmed}.`,
    timestamp: new Date().toISOString(),
    conversation_id: conversationId,
    call_outcome: callOutcome,
    patient_confirmed: patientConfirmed,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
    transcript_preview: transcript.slice(0, 300),
  });

  await updateExecutionWithFallback(supabase, executionId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    execution_log: log,
    conversation_id: conversationId,
    call_outcome: callOutcome,
    call_transcript: transcript.slice(0, 10000),
    patient_confirmed: patientConfirmed,
    confirmed_date: confirmedDate || null,
    confirmed_time: confirmedTime || null,
  });

  if (patientConfirmed && confirmedDate) {
    await createAppointmentFromCall(exec, confirmedDate, confirmedTime, callOutcome, log, executionId, supabase);
  }

  return { updated: true, terminal: true, status: normalizedStatus };
}

async function createAppointmentFromCall(
  exec: Record<string, unknown>,
  confirmedDate: string,
  confirmedTime: string,
  callOutcome: string,
  log: Record<string, unknown>[],
  executionId: string,
  supabase: ReturnType<typeof createServerClient>
) {
  try {
    const { data: workflow } = await supabase
      .from('workflows').select('hospital_id,doctor_id').eq('id', exec.workflow_id).single();
    if (!workflow) throw new Error('Could not fetch workflow');

    const booking = await createWorkflowAppointment({
      supabase,
      patientId: exec.patient_id as string,
      doctorId: workflow.doctor_id || null,
      hospitalId: workflow.hospital_id || null,
      date: confirmedDate,
      timeSlot: confirmedTime,
      workflowName: String(exec.workflow_name || ''),
      executionId,
      source: 'call_confirmation',
    });

    log.push({
      node_id: 'appt_auto', node_type: 'schedule_appointment',
      label: 'Appointment Auto-Created', status: 'ok',
      message: `Appointment booked: ${confirmedDate} at ${confirmedTime}${booking.patientEmail ? booking.patientEmailSent ? ' and confirmation email sent' : ' but confirmation email could not be sent' : ''}`,
      timestamp: new Date().toISOString(),
      appointment_id: booking.appointmentId,
      patient_email: booking.patientEmail,
      patient_email_sent: booking.patientEmailSent,
    });
    await supabase.from('workflow_executions').update({ execution_log: log }).eq('id', executionId);
  } catch (err) {
    console.error('[Poller] Appointment creation failed:', err);
    log.push({
      node_id: 'appt_auto', node_type: 'schedule_appointment',
      label: 'Appointment Creation Failed', status: 'error',
      message: String(err), timestamp: new Date().toISOString(),
    });
    await supabase.from('workflow_executions').update({ execution_log: log }).eq('id', executionId);
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
