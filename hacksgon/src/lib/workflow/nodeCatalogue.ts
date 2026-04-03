import type { NodeBlueprint } from '@/lib/types/workflow';

export const NODE_CATALOGUE: Record<string, NodeBlueprint> = {
  // ── TRIGGERS ────────────────────────────────────────────────────────────
  manual: {
    nodeType: 'manual',
    label: 'Manual Run',
    description: 'Run this workflow from the builder for a selected patient',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  lab_results_received: {
    nodeType: 'lab_results_received',
    label: 'Lab Results Received',
    description: 'Triggered when lab results arrive for a patient',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  abnormal_result_detected: {
    nodeType: 'abnormal_result_detected',
    label: 'Abnormal Result',
    description: 'Triggered when an abnormal lab value is detected',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  follow_up_due: {
    nodeType: 'follow_up_due',
    label: 'Follow-Up Due',
    description: 'Triggered when a patient is due for a follow-up visit',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  appointment_missed: {
    nodeType: 'appointment_missed',
    label: 'Appointment Missed',
    description: 'Triggered when a patient misses a scheduled appointment',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  new_patient_registered: {
    nodeType: 'new_patient_registered',
    label: 'New Patient Registered',
    description: 'Triggered when a new patient is registered in the system',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  prescription_expiring: {
    nodeType: 'prescription_expiring',
    label: 'Prescription Expiring',
    description: 'Triggered when a patient prescription is about to expire',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  appointment_confirmed: {
    nodeType: 'appointment_confirmed',
    label: 'Appointment Confirmed',
    description: 'Starts when an appointment is confirmed',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  appointment_cancelled: {
    nodeType: 'appointment_cancelled',
    label: 'Appointment Cancelled',
    description: 'Starts when an appointment is cancelled',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  queue_joined: {
    nodeType: 'queue_joined',
    label: 'Queue Joined',
    description: 'Starts when a patient joins the queue',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  patient_called: {
    nodeType: 'patient_called',
    label: 'Patient Called',
    description: 'Starts when a patient is called from the queue',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },
  patient_no_show: {
    nodeType: 'patient_no_show',
    label: 'Patient No-Show',
    description: 'Starts when a patient does not show up',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: 'zap',
  },

  // ── CONDITIONS ───────────────────────────────────────────────────────────
  check_patient_age: {
    nodeType: 'check_patient_age',
    label: 'Check Patient Age',
    description: 'Branch based on patient age',
    params: { operator: 'greater_than', threshold: '60', threshold_max: '120' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: 'git-branch',
  },
  check_insurance: {
    nodeType: 'check_insurance',
    label: 'Check Insurance',
    description: 'Branch based on insurance status',
    params: { operator: 'any', insurance_type: '' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: 'git-branch',
  },
  check_appointment_history: {
    nodeType: 'check_appointment_history',
    label: 'Check Appointment History',
    description: 'Branch based on how long since the last appointment',
    params: { days_since_last: '90' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: 'git-branch',
  },
  check_result_values: {
    nodeType: 'check_result_values',
    label: 'Check Result Values',
    description: 'Branch based on whether lab results meet a threshold',
    params: { test_name: '', operator: 'greater_than', threshold: '', threshold_max: '' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: 'git-branch',
  },
  check_medication_list: {
    nodeType: 'check_medication_list',
    label: 'Check Medications',
    description: 'Is patient on specific medication?',
    params: { medication: '' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: 'git-branch',
  },

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  call_patient: {
    nodeType: 'call_patient',
    label: 'Call Patient',
    description: 'Place an AI-powered outbound call to the patient via ElevenLabs + Twilio',
    params: {
      message: '',
      call_reason: '',
      lab_result_summary: '',
      available_slots: 'Monday at 10:00 AM, Wednesday at 2:00 PM, Friday at 9:00 AM',
      facility_name: '',
      facility_address: '',
      facility_phone_number: '',
    },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  send_sms: {
    nodeType: 'send_sms',
    label: 'Send SMS',
    description: 'Send an SMS message to the patient via Twilio',
    params: { message: '' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  schedule_appointment: {
    nodeType: 'schedule_appointment',
    label: 'Schedule Appointment',
    description: 'Schedule a follow-up appointment',
    params: { date: '', time_slot: '' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  send_notification: {
    nodeType: 'send_notification',
    label: 'Send Notification',
    description: 'Send an internal notification to staff members',
    params: { message: '', recipient: 'staff', priority: 'normal' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  create_lab_order: {
    nodeType: 'create_lab_order',
    label: 'Create Lab Order',
    description: 'Order a lab test for the patient',
    params: { test_type: '', priority: 'routine', notes: '' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  create_referral: {
    nodeType: 'create_referral',
    label: 'Create Referral',
    description: 'Refer patient to a specialist',
    params: { specialty: '', reason: '', urgency: 'routine' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  assign_to_staff: {
    nodeType: 'assign_to_staff',
    label: 'Assign to Staff',
    description: 'Assign the patient to a staff member for follow-up',
    params: { staff_id: '', task_type: 'follow_up', due_date: '' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },
  update_patient_record: {
    nodeType: 'update_patient_record',
    label: 'Update Patient Record',
    description: 'Update specific fields on the patient record',
    params: { risk_level: '', notes: '' },
    reactFlowType: 'action', category: 'actions', color: 'teal', icon: 'play',
  },

  // ── OUTPUTS ──────────────────────────────────────────────────────────────
  send_summary_to_doctor: {
    nodeType: 'send_summary_to_doctor',
    label: 'Send Summary to Doctor',
    description: 'Send the workflow execution summary to the doctor',
    params: { message: '' },
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: 'check-circle',
  },
  generate_transcript: {
    nodeType: 'generate_transcript',
    label: 'Generate Transcript',
    description: 'Fetch and store the AI call transcript from ElevenLabs',
    params: {},
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: 'check-circle',
  },
  create_report: {
    nodeType: 'create_report',
    label: 'Create Report',
    description: 'Generate a structured execution report for review',
    params: { title: '' },
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: 'check-circle',
  },
  log_completion: {
    nodeType: 'log_completion',
    label: 'Log Completion',
    description: 'Log that the workflow completed successfully',
    params: { message: 'Workflow completed successfully' },
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: 'check-circle',
  },
};

export const TRIGGER_TYPES    = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'triggers');
export const CONDITION_TYPES  = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'conditions');
export const ACTION_TYPES     = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'actions');
export const OUTPUT_TYPES     = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'outputs');
