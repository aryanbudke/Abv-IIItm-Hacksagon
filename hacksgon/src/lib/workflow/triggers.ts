import { createServerClient } from '@/lib/supabase/server';
import { executeWorkflow } from './engine';
import { pollCallResult } from '@/lib/services/elevenLabsService';
import { v4 as uuidv4 } from 'uuid';

export async function fireEvent(
  triggerType: string,
  patientId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createServerClient();

  const { data: patient } = await supabase.from('users').select('*').eq('id', patientId).single();
  if (!patient) return;

  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .in('status', ['ENABLED', 'active', 'ACTIVE']);
  if (!workflows?.length) return;

  const matching = workflows.filter((wf: Record<string, unknown>) => {
    const nodes = wf.nodes as { type: string; data: { nodeType: string } }[];
    return nodes.some(n => n.type === 'trigger' && n.data.nodeType === triggerType);
  });

  for (const workflow of matching) {
    const executionId = uuidv4();

    await supabase.from('workflow_executions').insert({
      id: executionId, workflow_id: workflow.id, patient_id: patientId,
      trigger_type: triggerType, status: 'running',
    });

    try {
      const result = await executeWorkflow(workflow, patient, triggerType, metadata, executionId);

      await supabase.from('workflow_executions').update({
        status: result.callInitiated ? 'running' : result.status,
        execution_log: result.steps,
        ...(!result.callInitiated && { completed_at: new Date().toISOString() }),
      }).eq('id', executionId);

      if (result.callInitiated) {
        pollCallResult(executionId).catch(console.error);
        console.log(`[Trigger] Poller started for execution ${executionId}`);
      }
    } catch (err) {
      await supabase.from('workflow_executions').update({
        status: 'failed', completed_at: new Date().toISOString(),
        execution_log: [{ node_id: 'engine', node_type: 'error', label: 'Engine Error',
          status: 'error', message: String(err), timestamp: new Date().toISOString() }],
      }).eq('id', executionId);
    }
  }
}
