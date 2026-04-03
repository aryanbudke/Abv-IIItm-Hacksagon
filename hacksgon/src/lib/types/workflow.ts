import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeType: string;
  label: string;
  description: string;
  params: Record<string, string>;
}

export type WorkflowReactFlowType =
  | 'trigger'
  | 'action'
  | 'conditional'
  | 'endpoint';

export type TriggerType =
  | 'lab_results_received'
  | 'abnormal_result_detected'
  | 'follow_up_due'
  | 'appointment_missed'
  | 'new_patient_registered'
  | 'prescription_expiring'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'queue_joined'
  | 'patient_called'
  | 'patient_no_show'
  | 'manual';

export type WorkflowNode = RFNode<WorkflowNodeData, WorkflowReactFlowType>;
export type WorkflowEdge = RFEdge & { sourceHandle?: 'true' | 'false' };

export interface Workflow {
  id: string;
  hospital_id: string;
  doctor_id: string | null;
  name: string;
  description?: string;
  category: string;
  status: 'active' | 'inactive' | 'draft' | 'DRAFT' | 'ENABLED' | 'DISABLED';
  trigger_type: TriggerType;
  execution_count?: number;
  last_run_at?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  patient_id: string;
  trigger_type: string;
  status: 'running' | 'completed' | 'failed';
  execution_log: StepLog[];
  conversation_id?: string;
  call_outcome?: string;
  call_transcript?: string;
  patient_confirmed?: boolean;
  confirmed_date?: string;
  confirmed_time?: string;
  started_at: string;
  completed_at?: string;
}

export interface StepLog {
  node_id: string;
  node_type: string;
  label: string;
  status: 'ok' | 'error' | 'skipped';
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface WorkflowContext {
  patient: Record<string, unknown>;
  workflow_id: string;
  workflow_name: string;
  doctor_id: string;
  doctor_name: string;
  execution_id: string;
  trigger_type: string;
  metadata: Record<string, unknown>;
  lab_results?: LabResult[];
  conversation_id?: string;
  _execution_log: StepLog[];
  [key: string]: unknown;
}

export interface LabResult {
  test_name: string;
  value: number | string;
  unit?: string;
  reference_range?: string;
}

export interface NodeBlueprint {
  nodeType: string;
  label: string;
  description: string;
  params: Record<string, string>;
  reactFlowType: WorkflowReactFlowType;
  category: 'triggers' | 'conditions' | 'actions' | 'outputs';
  color: string;
  icon: string;
}
