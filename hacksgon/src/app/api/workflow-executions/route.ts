import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { executeWorkflow } from '@/lib/workflow/engine';
import { pollCallResult, syncExecutionCallStatus } from '@/lib/services/elevenLabsService';
import { v4 as uuidv4 } from 'uuid';

function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  const compact = raw.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\D/g, '')}`;
  }

  if (compact.startsWith('00')) {
    return `+${compact.slice(2).replace(/\D/g, '')}`;
  }

  const digits = compact.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const buildQuery = () => {
    let query = supabase.from('workflow_executions').select('*');
    if (searchParams.get('workflow_id')) query = query.eq('workflow_id', searchParams.get('workflow_id')!);
    if (searchParams.get('patient_id'))  query = query.eq('patient_id',  searchParams.get('patient_id')!);
    if (searchParams.get('status'))      query = query.eq('status',      searchParams.get('status')!);
    return query.limit(100);
  };

  const { data, error } = await buildQuery();
  if (error) {
    console.error('[WorkflowExecutions][GET] Query failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runningExecutions = (data || []).filter(ex => {
    const status = String(ex.status || '').toLowerCase();
    return status === 'running' || status === 'in_progress' || status === 'in-progress';
  });

  if (runningExecutions.length > 0) {
    console.log('[WorkflowExecutions][GET] Syncing running call executions:', runningExecutions.map(ex => ex.id));
    await Promise.allSettled(
      runningExecutions.slice(0, 8).map(ex => syncExecutionCallStatus(String(ex.id)))
    );
  }

  const { data: latestData, error: latestError } = await buildQuery();
  if (latestError) {
    console.error('[WorkflowExecutions][GET] Query failed after sync:', {
      message: latestError.message,
      details: latestError.details,
      hint: latestError.hint,
      code: latestError.code,
    });
    return NextResponse.json({ error: latestError.message }, { status: 500 });
  }

  const sorted = (latestData || []).sort((a, b) => {
    const aTs = new Date(String(a.started_at || a.created_at || a.completed_at || 0)).getTime();
    const bTs = new Date(String(b.started_at || b.created_at || b.completed_at || 0)).getTime();
    return bTs - aTs;
  });
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { workflow_id, patient_id, trigger_type, metadata } = await req.json();
  console.log('[WorkflowExecutions][POST] Received request:', {
    workflow_id,
    patient_id,
    trigger_type: trigger_type || 'manual',
    has_lab_results: Array.isArray(metadata?.lab_results) && metadata.lab_results.length > 0,
    has_phone_override: !!metadata?.phone_override,
  });

  const { data: workflow, error: workflowError } = await supabase.from('workflows').select('*').eq('id', workflow_id).single();
  if (workflowError) {
    console.error('[WorkflowExecutions][POST] Workflow fetch failed:', workflowError);
  }
  if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

  const { data: patient, error: patientError } = await supabase.from('users').select('*').eq('id', patient_id).single();
  if (patientError) {
    console.error('[WorkflowExecutions][POST] Patient fetch failed:', patientError);
  }
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const phoneOverride = normalizePhone((metadata as Record<string, unknown> | undefined)?.phone_override);
  const patientForRun = phoneOverride
    ? { ...patient, mobile: phoneOverride, phone: phoneOverride }
    : patient;
  console.log('[WorkflowExecutions][POST] Patient context prepared:', {
    patient_id: patientForRun.id,
    patient_name: patientForRun.name,
    patient_phone: patientForRun.phone || patientForRun.mobile || null,
  });

  const executionId = uuidv4();
  const { error: insertError } = await supabase.from('workflow_executions').insert({
    id: executionId, workflow_id, patient_id,
    trigger_type: trigger_type || 'manual', status: 'running',
  });
  if (insertError) {
    console.error('[WorkflowExecutions][POST] Failed to create execution row:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const result = await executeWorkflow(workflow, patientForRun, trigger_type || 'manual', metadata || {}, executionId);
  console.log('[WorkflowExecutions][POST] executeWorkflow result:', {
    executionId,
    status: result.status,
    callInitiated: result.callInitiated,
    stepCount: result.steps.length,
    hasStepError: result.steps.some(step => step.status === 'error'),
  });

  const { error: updateError } = await supabase.from('workflow_executions').update({
    status: result.callInitiated ? 'running' : result.status,
    execution_log: result.steps,
    ...(!result.callInitiated && { completed_at: new Date().toISOString() }),
  }).eq('id', executionId);
  if (updateError) {
    console.error('[WorkflowExecutions][POST] Failed to update execution row:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (result.callInitiated) {
    console.log('[WorkflowExecutions][POST] Call initiated, starting poller:', executionId);
    pollCallResult(executionId).catch(console.error);
  }

  return NextResponse.json({
    execution_id: executionId,
    status: result.callInitiated ? 'running' : result.status,
    steps: result.steps,
    call_initiated: result.callInitiated,
    message: result.callInitiated
      ? 'Call initiated — polling for result in background'
      : 'Workflow executed',
  }, { status: 201 });
}
