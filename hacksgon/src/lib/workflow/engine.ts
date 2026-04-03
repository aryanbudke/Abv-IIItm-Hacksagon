import { createServerClient } from '@/lib/supabase/server';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowContext, StepLog } from '@/lib/types/workflow';
import { CONDITION_TYPES } from './nodeCatalogue';
import { initiateOutboundCall } from '@/lib/services/elevenLabsService';
import { createWorkflowAppointment } from '@/lib/services/workflowAppointmentService';

function normalizePhone(value: string | undefined) {
  const raw = (value || '').trim();
  if (!raw) return '';

  const compact = raw.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return `+${compact.slice(1).replace(/\D/g, '')}`;
  if (compact.startsWith('00')) return `+${compact.slice(2).replace(/\D/g, '')}`;

  const digits = compact.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

function normalizeNodeType(nodeType: string) {
  switch (nodeType) {
    case 'ai_call':
      return 'call_patient';
    case 'update_record':
      return 'update_patient_record';
    default:
      return nodeType;
  }
}

export async function executeWorkflow(
  workflow: Workflow,
  patient: Record<string, unknown>,
  triggerType: string,
  metadata: Record<string, unknown> = {},
  executionId: string
): Promise<{ steps: StepLog[]; status: 'completed' | 'failed'; callInitiated: boolean }> {

  const context: WorkflowContext = {
    patient, workflow_id: workflow.id, workflow_name: workflow.name,
    doctor_id: workflow.doctor_id ?? '', doctor_name: '', execution_id: executionId,
    trigger_type: triggerType, metadata,
    lab_results: (metadata.lab_results as never[]) || [],
    _execution_log: [],
  };

  if (workflow.doctor_id) {
    const supabase = createServerClient();
    const { data: doc } = await supabase.from('doctors').select('name').eq('id', workflow.doctor_id).single();
    if (doc) context.doctor_name = doc.name;
  }

  const { nodes, edges } = workflow;
  const adj = buildAdj(edges);
  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) {
    return { steps: [errStep('no_trigger', 'No trigger node')], status: 'failed', callInitiated: false };
  }

  const visited = new Set<string>();
  const queue = [triggerNode.id];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    let condResult: boolean | undefined;
    try {
      const { step, conditionResult } = await dispatch(node, context);
      condResult = conditionResult;
      context._execution_log.push(step);
    } catch (err) {
      context._execution_log.push(errStep(nodeId, `Error in ${node.data.nodeType}: ${err}`));
      continue;
    }

    getSuccessors(nodeId, node, condResult, adj).forEach(id => {
      if (!visited.has(id)) queue.push(id);
    });
  }

  const callInitiated = !!context.conversation_id;
  const status = context._execution_log.some(s => s.status === 'error') ? 'failed' : 'completed';
  return { steps: context._execution_log, status, callInitiated };
}

type AdjMap = Map<string, { target: string; handle?: string }[]>;

function buildAdj(edges: WorkflowEdge[]): AdjMap {
  const m: AdjMap = new Map();
  for (const e of edges) {
    if (!m.has(e.source)) m.set(e.source, []);
    m.get(e.source)!.push({ target: e.target, handle: e.sourceHandle });
  }
  return m;
}

function getSuccessors(nodeId: string, node: WorkflowNode, cond: boolean | undefined, adj: AdjMap): string[] {
  const entries = adj.get(nodeId) ?? [];
  if (CONDITION_TYPES.includes(node.data.nodeType) && cond !== undefined) {
    const h = cond ? 'true' : 'false';
    return entries.filter(e => e.handle === h || (!e.handle && cond)).map(e => e.target);
  }
  return entries.map(e => e.target);
}

async function dispatch(
  node: WorkflowNode, ctx: WorkflowContext
): Promise<{ step: StepLog; conditionResult?: boolean }> {
  const ts = () => new Date().toISOString();
  const nodeType = normalizeNodeType(node.data.nodeType);

  if (node.type === 'trigger') {
    return { step: mkStep(node, 'ok', `Trigger: ${nodeType} fired`, ts()) };
  }

  if (CONDITION_TYPES.includes(nodeType)) {
    return handleCondition(node, ctx);
  }

  switch (nodeType) {
    case 'call_patient':            return handleCallPatient(node, ctx);
    case 'send_sms':                return handleSendSms(node, ctx);
    case 'schedule_appointment':    return handleScheduleAppointment(node, ctx);
    case 'send_notification':       return handleSendNotification(node, ctx);
    case 'create_lab_order':        return handleCreateLabOrder(node, ctx);
    case 'create_referral':         return handleCreateReferral(node, ctx);
    case 'assign_to_staff':         return handleAssignToStaff(node, ctx);
    case 'update_patient_record':   return handleUpdatePatient(node, ctx);
    case 'send_summary_to_doctor':  return handleSendSummary(node, ctx);
    case 'generate_transcript':     return handleGenerateTranscript(node, ctx);
    case 'create_report':           return handleCreateReport(node, ctx);
    case 'log_completion':
      return { step: mkStep(node, 'ok', node.data.params.message || 'Workflow complete', ts()) };
    default:
      return { step: mkStep(node, 'skipped', `No handler for ${nodeType}`, ts()) };
  }
}

async function handleCondition(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const nodeType = normalizeNodeType(node.data.nodeType);
  const { params } = node.data;
  const patient = ctx.patient;

  switch (nodeType) {
    case 'check_patient_age': {
      const dob = patient.dob as string;
      if (!dob) return { step: mkStep(node, 'error', 'No DOB on patient', ts), conditionResult: false };
      const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25*24*60*60*1000));
      const t = parseFloat(params.threshold || '0'), tMax = parseFloat(params.threshold_max || '120');
      const passed = params.operator === 'greater_than' ? age > t
        : params.operator === 'less_than' ? age < t
        : params.operator === 'equal_to' ? age === t
        : age >= t && age <= tMax;
      return { step: mkStep(node, passed ? 'ok' : 'skipped', `Age ${age} ${passed?'PASS':'FAIL'} (${params.operator} ${t})`, ts, { patient_age: age }), conditionResult: passed };
    }
    case 'check_insurance': {
      const ins = (patient.insurance as string) || '';
      const passed = params.operator === 'any' ? !!ins : ins.toLowerCase().includes((params.insurance_type||'').toLowerCase());
      return { step: mkStep(node, passed?'ok':'skipped', `Insurance "${ins}" ${passed?'PASS':'FAIL'}`, ts), conditionResult: passed };
    }
    case 'check_appointment_history': {
      const supabase = createServerClient();
      const days = parseInt(params.days_since_last || '90');
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      const { data } = await supabase.from('appointments').select('id')
        .eq('patient_id', patient.id as string).eq('status','completed')
        .gte('created_at', cutoff.toISOString()).limit(1);
      const passed = !data || data.length === 0;
      return { step: mkStep(node, passed?'ok':'skipped', `Patient ${passed?'IS overdue':'visited recently'} (${days}d window)`, ts), conditionResult: passed };
    }
    case 'check_result_values': {
      const results = (ctx.lab_results || (ctx.metadata?.lab_results as never[])) || [];
      if (!results.length) return { step: mkStep(node, 'error', 'No lab results in context', ts), conditionResult: false };
      const testName = params.test_name || '';
      const match = (results as {test_name:string;value:number}[]).find(r => r.test_name?.toLowerCase().includes(testName.toLowerCase()));
      if (!match) return { step: mkStep(node, 'error', `Test "${testName}" not found`, ts), conditionResult: false };
      const v = parseFloat(String(match.value)), t = parseFloat(params.threshold||'0'), tMax = parseFloat(params.threshold_max||'999');
      const passed = params.operator === 'greater_than' ? v > t
        : params.operator === 'less_than' ? v < t
        : params.operator === 'in_range' ? v >= t && v <= tMax
        : v < t || v > tMax;
      return { step: mkStep(node, passed?'ok':'skipped', `${testName}=${v} ${passed?'PASS':'FAIL'} (${params.operator} ${t})`, ts, { test_name: testName, value: v }), conditionResult: passed };
    }
    case 'check_medication_list': {
      const supabase = createServerClient();
      const terms = (params.medication||'').split(',').map((s: string)=>s.trim().toLowerCase()).filter(Boolean);
      if (!terms.length) return { step: mkStep(node, 'error', 'No medication name configured', ts), conditionResult: false };
      const { data: meds } = await supabase.from('patient_medications').select('name,status').eq('patient_id', patient.id as string).eq('status','active');
      const matched = (meds || []).filter((m: {name:string;status:string}) => terms.some((t: string) => m.name?.toLowerCase().includes(t))).map((m: {name:string}) => m.name);
      const passed = matched.length > 0;
      return { step: mkStep(node, passed?'ok':'skipped', passed?`Found: ${matched.join(', ')}`:`No active meds matching: ${terms.join(', ')}`, ts, { matched }), conditionResult: passed };
    }
    default:
      return { step: mkStep(node, 'skipped', `No condition handler for ${nodeType}`, ts), conditionResult: false };
  }
}

async function handleCallPatient(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const phone = normalizePhone((ctx.patient.phone as string) || (ctx.patient.mobile as string));
  if (!phone) return { step: mkStep(node, 'error', 'No patient phone number', ts) };

  const { params } = node.data;
  try {
    console.log('[WorkflowEngine] Initiating patient call:', {
      execution_id: ctx.execution_id,
      workflow_id: ctx.workflow_id,
      patient_id: ctx.patient.id,
      patient_name: ctx.patient.name,
      to_phone: phone,
    });
    const result = await initiateOutboundCall({
      patientPhone: phone,
      patientName: ctx.patient.name as string || 'Patient',
      doctorName: ctx.doctor_name || 'your doctor',
      labResultSummary: params.lab_result_summary,
      facilityName: params.facility_name,
      facilityAddress: params.facility_address,
      facilityPhoneNumber: params.facility_phone_number,
      callReason: params.call_reason,
      availableSlots: params.available_slots,
      extraContext: { execution_id: ctx.execution_id, workflow_id: ctx.workflow_id },
    });
    ctx.conversation_id = result.conversation_id;
    console.log('[WorkflowEngine] Call initiated successfully:', {
      execution_id: ctx.execution_id,
      conversation_id: result.conversation_id,
      call_sid: result.callSid || null,
    });
    return { step: mkStep(node, 'ok', `Call initiated — conversation_id: ${result.conversation_id}`, ts, { conversation_id: result.conversation_id }) };
  } catch (err) {
    console.error('[WorkflowEngine] Call initiation failed:', err);
    return { step: mkStep(node, 'error', `Call failed: ${err}`, ts) };
  }
}

async function handleSendSms(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const phone = normalizePhone((ctx.patient.phone as string) || (ctx.patient.mobile as string));
  if (!phone) return { step: mkStep(node, 'error', 'No patient phone number', ts) };
  const { message } = node.data.params;

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) throw new Error('Twilio not configured');

    const body = new URLSearchParams({ To: phone, From: from, Body: message || 'Message from your healthcare provider' });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    return { step: mkStep(node, 'ok', `SMS sent (sid: ${data.sid})`, ts, { message_sid: data.sid }) };
  } catch (err) {
    return { step: mkStep(node, 'error', `SMS failed: ${err}`, ts) };
  }
}

async function handleSendNotification(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const supabase = createServerClient();
  const { message, recipient } = node.data.params;
  const recipientId =
    recipient === 'doctor'
      ? ctx.doctor_id
      : recipient === 'patient'
        ? ctx.patient.id as string
        : (node.data.params.staff_id || ctx.metadata?.staff_id || ctx.doctor_id) as string | undefined;

  if (!recipientId) {
    return { step: mkStep(node, 'error', `No recipient available for "${recipient}" notification`, ts) };
  }

  const { data, error } = await supabase.from('notifications').insert({
    user_id: recipientId, title: 'Workflow Notification',
    message: message || `Automated notification for patient ${ctx.patient.name}`,
    type: 'general', read: false,
  }).select('id').single();
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Notification sent`, ts, { notification_id: data?.id }) };
}

async function handleScheduleAppointment(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const { date, time_slot } = node.data.params;

  const scheduleDate =
    (ctx.metadata?.confirmed_date as string | undefined) ||
    (ctx.metadata?.appointment_date as string | undefined) ||
    date;
  const scheduleTime =
    (ctx.metadata?.confirmed_time as string | undefined) ||
    (ctx.metadata?.appointment_time as string | undefined) ||
    time_slot ||
    '09:00';

  if (!scheduleDate) {
    return { step: mkStep(node, 'error', 'No appointment date provided for Schedule Appointment', ts) };
  }

  const booking = await createWorkflowAppointment({
    patientId: ctx.patient.id as string,
    doctorId: ctx.doctor_id || null,
    hospitalId: (ctx.metadata?.hospital_id as string | undefined) || null,
    date: scheduleDate,
    timeSlot: scheduleTime,
    workflowName: ctx.workflow_name,
    executionId: ctx.execution_id,
    source: 'workflow_node',
  });

  return {
    step: mkStep(
      node,
      'ok',
      `Appointment scheduled for ${scheduleDate} at ${scheduleTime}${booking.patientEmail ? booking.patientEmailSent ? ' and confirmation email sent' : ' but confirmation email could not be sent' : ''}`,
      ts,
      {
        appointment_id: booking.appointmentId,
        patient_email: booking.patientEmail,
        patient_email_sent: booking.patientEmailSent,
      }
    ),
  };
}

async function handleCreateLabOrder(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const supabase = createServerClient();
  const { test_type, priority, notes } = node.data.params;
  const { data: doc } = await supabase.from('doctors').select('hospital_id').eq('id', ctx.doctor_id).single();
  const { data, error } = await supabase.from('lab_orders').insert({
    patient_id: ctx.patient.id as string, hospital_id: doc?.hospital_id,
    doctor_id: ctx.doctor_id || null, test_type: test_type || 'General Panel',
    priority: priority || 'routine', notes: notes || null, status: 'pending',
  }).select('id').single();
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Lab order: ${test_type} (${priority})`, ts, { lab_order_id: data?.id }) };
}

async function handleCreateReferral(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const supabase = createServerClient();
  const { specialty, reason, urgency } = node.data.params;
  const { data, error } = await supabase.from('referrals').insert({
    patient_id: ctx.patient.id as string, doctor_id: ctx.doctor_id || null,
    specialty: specialty || 'General', reason: reason || 'Workflow referral',
    urgency: urgency || 'routine', status: 'pending',
  }).select('id').single();
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Referral: ${specialty} (${urgency})`, ts, { referral_id: data?.id }) };
}

async function handleAssignToStaff(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const supabase = createServerClient();
  const { staff_id, task_type, details, due_date } = node.data.params;
  const { data, error } = await supabase.from('staff_assignments').insert({
    patient_id: ctx.patient.id as string,
    assigned_to: staff_id || ctx.doctor_id,
    task_type: task_type || 'follow_up',
    details: details || null,
    due_date: due_date || null, status: 'assigned',
  }).select('id').single();
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Task assigned: ${task_type || 'follow_up'}`, ts, { assignment_id: data?.id }) };
}

async function handleUpdatePatient(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const { field, value, risk_level, notes } = node.data.params;
  const updates: Record<string, string> = {};

  if (field && value) {
    const allowed = ['notes','risk_level','primary_physician','insurance','last_visit'];
    if (!allowed.includes(field)) return { step: mkStep(node, 'error', `Field "${field}" not allowed`, ts) };
    updates[field] = value;
  }

  if (risk_level) updates.risk_level = risk_level;
  if (notes) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return { step: mkStep(node, 'error', 'No patient fields provided to update', ts) };
  }

  const supabase = createServerClient();
  const { error } = await supabase.from('users').update(updates).eq('id', ctx.patient.id as string);
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Updated patient fields: ${Object.keys(updates).join(', ')}`, ts, { updated_fields: Object.keys(updates) }) };
}

async function handleSendSummary(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  if (!ctx.doctor_id) return { step: mkStep(node, 'error', 'No doctor_id in context', ts) };
  const supabase = createServerClient();
  const ok = ctx._execution_log.filter(s => s.status === 'ok').length;
  const { data } = await supabase.from('notifications').insert({
    user_id: ctx.doctor_id, title: `Workflow Complete: ${ctx.workflow_name}`,
    message: node.data.params.message || `Workflow "${ctx.workflow_name}" completed ${ok} steps.`,
    type: 'general', read: false,
  }).select('id').single();
  return { step: mkStep(node, 'ok', `Summary sent to doctor (${ok} steps ok)`, ts, { notification_id: data?.id }) };
}

async function handleGenerateTranscript(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  if (!ctx.conversation_id) return { step: mkStep(node, 'error', 'No conversation_id in context', ts) };
  const { getConversation, formatTranscript } = await import('@/lib/services/elevenLabsService');
  const conv = await getConversation(ctx.conversation_id);
  const transcript = formatTranscript(conv.transcript);
  return { step: mkStep(node, 'ok', `Transcript saved (${transcript.length} chars)`, ts, { transcript_length: transcript.length }) };
}

async function handleCreateReport(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const ok = ctx._execution_log.filter(s => s.status === 'ok').length;
  const failed = ctx._execution_log.filter(s => s.status === 'error').length;
  return { step: mkStep(node, 'ok', `Report: ${ok}/${ctx._execution_log.length} nodes succeeded`, ts, { ok, failed }) };
}

function mkStep(node: WorkflowNode, status: 'ok'|'error'|'skipped', message: string, timestamp: string, extra?: Record<string,unknown>): StepLog {
  return { node_id: node.id, node_type: node.data.nodeType, label: node.data.label, status, message, timestamp, ...(extra||{}) };
}

function errStep(nodeId: string, message: string): StepLog {
  return { node_id: nodeId, node_type: 'error', label: 'Error', status: 'error', message, timestamp: new Date().toISOString() };
}
