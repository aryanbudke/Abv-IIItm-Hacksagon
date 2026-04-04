import { createServerClient } from '@/lib/supabase/server';
import { executeWorkflow } from '@/lib/workflow/engine';
import { pollCallResult } from '@/lib/services/elevenLabsService';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const { workflowId, patientId, triggerData = {} } = await req.json();
    
    if (!workflowId || !patientId) {
      return NextResponse.json({ error: 'Missing workflowId or patientId' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 1. Fetch Workflow
    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (wfError || !workflow) {
      console.error('Workflow fetch error:', wfError);
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // 2. Fetch Patient
    const { data: patient, error: pError } = await supabase
      .from('users')
      .select('*')
      .eq('id', patientId)
      .single();

    if (pError || !patient) {
       console.error('Patient fetch error:', pError);
       return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const executionId = uuidv4();
    
    // 3. Create Execution Record
    const { error: insError } = await supabase.from('workflow_executions').insert({
      id: executionId,
      workflow_id: workflowId,
      status: 'RUNNING',
      trigger_type: 'MANUAL',
      trigger_data: { ...triggerData, patient_id: patientId, patientName: patient.name },
    });

    if (insError) {
      console.error('Execution record insert error:', insError);
      return NextResponse.json({ error: 'Failed to create execution record' }, { status: 500 });
    }

    // 4. Run Workflow (Awaiting for the first-pass implementation, can be offloaded to background later)
    const result = await executeWorkflow(workflow, patient, 'MANUAL', triggerData, executionId);

    // 5. Update Execution Record
    const { error: updError } = await supabase.from('workflow_executions').update({
      status: result.callInitiated ? 'running' : result.status.toUpperCase(),
      execution_log: result.steps,
      completed_at: result.callInitiated ? null : new Date().toISOString(),
    }).eq('id', executionId);

    if (updError) {
      console.error('Execution record update error:', updError);
    }

    // 6. If a call was initiated, start background poller to detect confirmation and book appointment
    if (result.callInitiated) {
      pollCallResult(executionId).catch(err =>
        console.error('[Trigger] Background poller error:', err)
      );
    }

    return NextResponse.json({
      success: true,
      executionId,
      status: result.status,
      callInitiated: result.callInitiated
    });

  } catch (error: any) {
    console.error('Workflow trigger fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
