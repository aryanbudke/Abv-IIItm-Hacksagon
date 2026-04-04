# MediQueue Pro — Master Implementation Plan
### Doctor Side · Admin Side · Workflow Engine · ElevenLabs AI Calls

> One document. Everything you need to build, in order, with exact file paths, exact code, and zero ambiguity.

---

## SECTION 0 — WHAT EXISTS TODAY

### Tech Stack
| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | TailwindCSS 4, shadcn/ui, Framer Motion |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Clerk (JWT, `publicMetadata.role`) |
| Email | Nodemailer (Gmail SMTP) |
| QR Codes | `qrcode` npm library |

### Three Roles
| Role | How identified |
|------|---------------|
| **Patient** | Auto-created on signup |
| **Doctor** | Admin registers them; email must match `doctors` table |
| **Admin** | Manually set via `/api/set-role` |

### Current Database Tables (already exist)
```
users            — patient_id, name, email, mobile, dob, insurance, hospital_visited[]
hospitals        — name, address, city, state, phone, email, is_active
departments      — hospital_id, name, floor, counter_numbers[]
doctors          — hospital_id, department_id, name, email, phone, specialization,
                   qualification, experience, rating, is_on_leave, leave_from/to,
                   average_treatment_time
appointments     — patient_id, hospital_id, department_id, doctor_id, date, time_slot,
                   status (pending|confirmed|completed|cancelled), otp_verified
queue            — token_number, patient_id, hospital_id, department_id, doctor_id,
                   date, time, treatment_type, is_emergency, qr_code,
                   status (waiting|in-treatment|completed|cancelled),
                   position, counter_number, estimated_wait_time
emergency_queue  — token_number, patient_id, hospital_id, department_id,
                   emergency_type, severity (critical|high|medium), status
ratings          — patient_id, doctor_id, hospital_id, appointment_id,
                   rating (1-5), feedback, treatment_success
historical_data  — hospital_id, department_id, date, hour, patient_count, average_wait_time
notifications    — user_id, title, message, type, read (boolean)
```

### What Works Right Now ✅
**Patients:** signup, join queue (QR + token), book appointment (OTP), cancel/reschedule, waitlist, emergency trigger, medical records upload, dashboard
**Doctors:** live queue view, call-next/complete, appointments view, patient history, treatment reports, analytics, calendar
**Admins:** hospital CRUD, doctor CRUD + auto role-assign, user management, live dashboard stats + AI alerts

### What's Missing ❌
- Workflow automation system (zero exists)
- ElevenLabs AI voice calls
- Doctor: skip/transfer buttons, notification bell, leave management, ratings
- Admin: queue management page, appointments page, analytics charts, departments page, settings, audit logs

---

## SECTION 1 — ENVIRONMENT VARIABLES

Add all of these to `.env` and to Vercel dashboard:

```env
# ── Already configured ─────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# ── NEW: Add these ─────────────────────────────────
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_PHONE_NUMBER_ID=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## SECTION 2 — EXTERNAL SERVICE SETUP

### 2.1 ElevenLabs (the AI voice)

1. Sign up at **elevenlabs.io**
2. Go to **Conversational AI → Agents → Create Agent**
3. Paste this **System Prompt**:
```
You are a medical receptionist calling on behalf of {{doctor_name}} at {{facility_name}}.
You are calling {{patient_name}} regarding {{call_reason}}.

{{lab_result_summary}}

Your goal:
1. Confirm you are speaking with {{patient_name}}
2. Explain briefly why you are calling
3. Offer these available slots: {{available_slots}}
4. Confirm which slot the patient prefers
5. Repeat the confirmed date and time back clearly
6. Thank them and end professionally

Facility phone: {{facility_phone_number}}
Facility address: {{facility_address}}
```
4. Under **Data Collection**, add these exact field names:
   - `call_outcome`
   - `patient_confirmed` (boolean)
   - `confirmed_date`
   - `confirmed_time`
   - `patient_availability_notes`
5. Save → copy **Agent ID** to `ELEVENLABS_AGENT_ID`
6. Copy **API Key** to `ELEVENLABS_API_KEY`

### 2.2 Twilio (the phone network)

1. Sign up at **twilio.com** (get $15 free credit)
2. Buy a phone number (~$1.15/month)
3. Copy **Account SID** → `TWILIO_ACCOUNT_SID`
4. Copy **Auth Token** → `TWILIO_AUTH_TOKEN`
5. Copy **Phone Number** (format `+15551234567`) → `TWILIO_PHONE_NUMBER`

### 2.3 Connect Twilio → ElevenLabs

1. In ElevenLabs → **Phone Numbers → Import from Twilio**
2. Enter Twilio SID + Auth Token
3. Select your phone number
4. Copy **Phone Number ID** → `ELEVENLABS_PHONE_NUMBER_ID`

### 2.4 Webhook

In ElevenLabs → Agent Settings → Webhooks:
- URL: `https://your-app.vercel.app/api/elevenlabs/webhook`

For local dev: use `ngrok http 3000` and paste the ngrok URL instead.

---

## SECTION 3 — ALL DATABASE MIGRATIONS

Run all of these in Supabase SQL editor (Dashboard → SQL Editor).

### Migration 009 — Workflow Tables

```sql
-- ── workflows: stores the visual graph (nodes + edges as JSONB) ──────────
CREATE TABLE IF NOT EXISTS workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id   UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
  doctor_id     UUID REFERENCES doctors(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'Ungrouped',
  status        TEXT NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'ENABLED', 'DISABLED')),
  nodes         JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflows_hospital ON workflows(hospital_id);
CREATE INDEX idx_workflows_doctor   ON workflows(doctor_id);
CREATE INDEX idx_workflows_status   ON workflows(status);

-- ── workflow_executions: one row per workflow run ────────────────────────
CREATE TABLE IF NOT EXISTS workflow_executions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id      UUID REFERENCES workflows(id) ON DELETE CASCADE NOT NULL,
  patient_id       TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  trigger_type     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'completed', 'failed')),
  execution_log    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- ElevenLabs call result columns
  conversation_id  TEXT,
  call_outcome     TEXT,
  call_transcript  TEXT,
  patient_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_date   DATE,
  confirmed_time   TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);
CREATE INDEX idx_executions_workflow        ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_patient         ON workflow_executions(patient_id);
CREATE INDEX idx_executions_status          ON workflow_executions(status);
CREATE INDEX idx_executions_conversation_id ON workflow_executions(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ── lab_orders: created by workflow action or manually ───────────────────
CREATE TABLE IF NOT EXISTS lab_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  hospital_id   UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
  doctor_id     UUID REFERENCES doctors(id) ON DELETE SET NULL,
  test_type     TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'routine'
                  CHECK (priority IN ('routine', 'urgent', 'stat')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ── referrals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  doctor_id     UUID REFERENCES doctors(id) ON DELETE SET NULL,
  specialty     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  urgency       TEXT NOT NULL DEFAULT 'routine'
                  CHECK (urgency IN ('routine', 'urgent', 'emergent')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ── staff_assignments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  assigned_to   TEXT NOT NULL,
  task_type     TEXT NOT NULL,
  details       TEXT,
  due_date      DATE,
  status        TEXT NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned', 'in_progress', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ── audit_logs: every admin action ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   TEXT NOT NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  old_value       JSONB,
  new_value       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_admin   ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ── system_settings: configurable thresholds ─────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO system_settings (key, value, description) VALUES
  ('queue_alert_threshold', '10',  'Max patients before admin alert fires'),
  ('default_treatment_time','15',  'Default minutes per patient'),
  ('waitlist_expiry_hours', '2',   'Hours before waitlist slot expires'),
  ('emergency_priority_boost','5', 'Positions to boost emergency patients')
ON CONFLICT (key) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE workflows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_all"            ON workflows           FOR ALL USING (true);
CREATE POLICY "workflow_executions_all"  ON workflow_executions FOR ALL USING (true);
CREATE POLICY "lab_orders_all"           ON lab_orders          FOR ALL USING (true);
CREATE POLICY "referrals_all"            ON referrals           FOR ALL USING (true);
CREATE POLICY "staff_assignments_all"    ON staff_assignments   FOR ALL USING (true);
```

---

## SECTION 4 — PACKAGES TO INSTALL

```bash
npm install @xyflow/react dagre @types/dagre
```

Everything else (uuid, supabase, zod, nodemailer) is already installed.

---

## SECTION 5 — ALL NEW FILES TO CREATE

### Complete file map — create every one of these:

```
src/
├── lib/
│   ├── types/
│   │   └── workflow.ts                          ← TypeScript interfaces
│   ├── workflow/
│   │   ├── nodeCatalogue.ts                     ← all 21 node definitions
│   │   ├── engine.ts                            ← BFS execution engine
│   │   └── triggers.ts                          ← fireEvent() system
│   └── services/
│       └── elevenLabsService.ts                 ← ElevenLabs + call poller
├── app/
│   ├── api/
│   │   ├── workflows/
│   │   │   ├── route.ts                         ← GET list / POST create
│   │   │   └── [id]/
│   │   │       └── route.ts                     ← GET / PUT / DELETE single
│   │   ├── workflow-executions/
│   │   │   └── route.ts                         ← GET list / POST execute
│   │   ├── elevenlabs/
│   │   │   ├── webhook/
│   │   │   │   └── route.ts                     ← ElevenLabs posts here
│   │   │   └── debug/[conversationId]/
│   │   │       └── route.ts                     ← debug raw call data
│   │   ├── trigger-event/
│   │   │   └── route.ts                         ← fire event manually
│   │   ├── admin/
│   │   │   ├── users/route.ts                   ← already exists
│   │   │   ├── queues/route.ts                  ← NEW: admin queue ops
│   │   │   └── appointments/route.ts            ← NEW: admin appt mgmt
│   │   └── departments/route.ts                 ← NEW: dept CRUD
│   ├── workflows/
│   │   ├── page.tsx                             ← workflow list
│   │   └── [id]/
│   │       └── page.tsx                         ← workflow builder
│   ├── workflow-executions/
│   │   └── page.tsx                             ← execution history
│   └── admin/
│       ├── queue-management/
│       │   └── page.tsx                         ← NEW: admin queue panel
│       ├── appointments/
│       │   └── page.tsx                         ← NEW: admin appt panel
│       ├── analytics/
│       │   └── page.tsx                         ← NEW: charts
│       ├── departments/
│       │   └── page.tsx                         ← NEW: dept CRUD
│       └── settings/
│           └── page.tsx                         ← NEW: system config
└── components/
    └── workflow/
        ├── TriggerNode.tsx
        ├── ActionNode.tsx
        ├── ConditionalNode.tsx
        ├── EndpointNode.tsx
        ├── NodePalette.tsx
        ├── PropertiesPanel.tsx
        └── ExecutionLog.tsx
```

---

## SECTION 6 — FILE CONTENTS

### FILE 1: `/src/lib/types/workflow.ts`

```typescript
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeType: string;
  label: string;
  description: string;
  params: Record<string, string>;
}

export type WorkflowNode = RFNode<WorkflowNodeData, 'trigger' | 'action' | 'conditional' | 'endpoint'>;
export type WorkflowEdge = RFEdge & { sourceHandle?: 'true' | 'false' };

export interface Workflow {
  id: string;
  hospital_id: string;
  doctor_id: string | null;
  name: string;
  description?: string;
  category: string;
  status: 'DRAFT' | 'ENABLED' | 'DISABLED';
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
  reactFlowType: 'trigger' | 'action' | 'conditional' | 'endpoint';
  category: 'triggers' | 'conditions' | 'actions' | 'outputs';
  color: string;
  icon: string;
}
```

---

### FILE 2: `/src/lib/workflow/nodeCatalogue.ts`

```typescript
import type { NodeBlueprint } from '@/lib/types/workflow';

export const NODE_CATALOGUE: Record<string, NodeBlueprint> = {
  // ── TRIGGERS ────────────────────────────────────────────────────────────
  appointment_missed: {
    nodeType: 'appointment_missed',
    label: 'Appointment Missed',
    description: 'Patient did not show up',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },
  new_patient_registered: {
    nodeType: 'new_patient_registered',
    label: 'New Patient Registered',
    description: 'A new patient account was created',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },
  follow_up_due: {
    nodeType: 'follow_up_due',
    label: 'Follow-up Due',
    description: 'Patient has not visited in a while',
    params: { days_since_last: '90' },
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },
  queue_completed: {
    nodeType: 'queue_completed',
    label: 'Queue Visit Completed',
    description: 'Patient finished their queue visit',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },
  prescription_expiring: {
    nodeType: 'prescription_expiring',
    label: 'Prescription Expiring',
    description: 'Prescription about to expire',
    params: { days_before: '7' },
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },
  lab_results_received: {
    nodeType: 'lab_results_received',
    label: 'Lab Results Received',
    description: 'New lab results available for patient',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },
  abnormal_result_detected: {
    nodeType: 'abnormal_result_detected',
    label: 'Abnormal Result Detected',
    description: 'A lab value is outside normal range',
    params: {},
    reactFlowType: 'trigger', category: 'triggers', color: 'blue', icon: '⚡',
  },

  // ── CONDITIONS ───────────────────────────────────────────────────────────
  check_patient_age: {
    nodeType: 'check_patient_age',
    label: 'Check Patient Age',
    description: 'Branch based on patient age',
    params: { operator: 'greater_than', threshold: '60', threshold_max: '120' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: '◇',
  },
  check_insurance: {
    nodeType: 'check_insurance',
    label: 'Check Insurance',
    description: 'Branch based on insurance status',
    params: { operator: 'any', insurance_type: '' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: '◇',
  },
  check_appointment_history: {
    nodeType: 'check_appointment_history',
    label: 'Check Visit History',
    description: 'Has patient visited recently?',
    params: { days_since_last: '90' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: '◇',
  },
  check_result_values: {
    nodeType: 'check_result_values',
    label: 'Check Lab Values',
    description: 'Is a lab result above/below threshold?',
    params: { test_name: '', operator: 'greater_than', threshold: '0', threshold_max: '999' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: '◇',
  },
  check_medication_list: {
    nodeType: 'check_medication_list',
    label: 'Check Medications',
    description: 'Is patient on specific medication?',
    params: { medication: '' },
    reactFlowType: 'conditional', category: 'conditions', color: 'amber', icon: '◇',
  },

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  call_patient: {
    nodeType: 'call_patient',
    label: 'Call Patient (AI)',
    description: 'Initiate AI voice call via ElevenLabs + Twilio',
    params: {
      call_reason: '',
      lab_result_summary: '',
      available_slots: 'Monday at 10:00 AM, Wednesday at 2:00 PM, Friday at 9:00 AM',
      facility_name: '',
      facility_address: '',
      facility_phone_number: '',
    },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },
  send_sms: {
    nodeType: 'send_sms',
    label: 'Send SMS',
    description: 'Send SMS to patient via Twilio',
    params: { message: '' },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },
  send_notification: {
    nodeType: 'send_notification',
    label: 'Send Notification',
    description: 'Create in-app notification',
    params: { message: '', recipient: 'doctor' },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },
  create_lab_order: {
    nodeType: 'create_lab_order',
    label: 'Create Lab Order',
    description: 'Order a lab test for the patient',
    params: { test_type: '', priority: 'routine', notes: '' },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },
  create_referral: {
    nodeType: 'create_referral',
    label: 'Create Referral',
    description: 'Refer patient to a specialist',
    params: { specialty: '', reason: '', urgency: 'routine' },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },
  assign_to_staff: {
    nodeType: 'assign_to_staff',
    label: 'Assign to Staff',
    description: 'Create a task for staff',
    params: { task_type: '', details: '', due_date: '' },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },
  update_patient_record: {
    nodeType: 'update_patient_record',
    label: 'Update Patient Record',
    description: 'Update a field in the patient record',
    params: { field: 'notes', value: '' },
    reactFlowType: 'action', category: 'actions', color: 'purple', icon: '⚙',
  },

  // ── OUTPUTS ──────────────────────────────────────────────────────────────
  send_summary_to_doctor: {
    nodeType: 'send_summary_to_doctor',
    label: 'Notify Doctor',
    description: 'Send workflow summary to doctor',
    params: { message: '' },
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: '■',
  },
  generate_transcript: {
    nodeType: 'generate_transcript',
    label: 'Get Call Transcript',
    description: 'Save full call transcript from ElevenLabs',
    params: {},
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: '■',
  },
  create_report: {
    nodeType: 'create_report',
    label: 'Create Report',
    description: 'Save a structured execution report',
    params: { title: '' },
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: '■',
  },
  log_completion: {
    nodeType: 'log_completion',
    label: 'Log Completion',
    description: 'Mark workflow as complete',
    params: { message: 'Workflow completed successfully' },
    reactFlowType: 'endpoint', category: 'outputs', color: 'gray', icon: '■',
  },
};

export const TRIGGER_TYPES    = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'triggers');
export const CONDITION_TYPES  = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'conditions');
export const ACTION_TYPES     = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'actions');
export const OUTPUT_TYPES     = Object.keys(NODE_CATALOGUE).filter(k => NODE_CATALOGUE[k].category === 'outputs');
```

---

### FILE 3: `/src/lib/services/elevenLabsService.ts`

```typescript
/**
 * ElevenLabs Conversational AI + Twilio call poller.
 * Handles: initiating calls, polling results, date/time parsing,
 * transcript analysis, and appointment creation on confirmation.
 */
import { createClient } from '@/lib/supabase/server';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Initiate outbound call ─────────────────────────────────────────────────

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

  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.success === false) throw new Error(`ElevenLabs setup failure: ${data.message}`);
  return data;
}

// ── Get conversation data ──────────────────────────────────────────────────

export async function getConversation(conversationId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

  const res = await fetch(`${ELEVENLABS_BASE}/convai/conversations/${conversationId}`, {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Background poller ──────────────────────────────────────────────────────

export async function pollCallResult(executionId: string): Promise<void> {
  console.log(`[Poller] Starting for execution ${executionId}`);
  await sleep(15_000); // wait for call to connect

  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      const supabase = await createClient();
      const { data: exec } = await supabase
        .from('workflow_executions').select('*').eq('id', executionId).single();

      if (!exec) { console.warn('[Poller] Execution not found'); return; }
      if (exec.status === 'completed') { console.log('[Poller] Already completed'); return; }

      // Find conversation_id in execution_log
      const log: Record<string, unknown>[] = exec.execution_log || [];
      const conversationId = log.find(s => s.conversation_id)?.conversation_id as string | undefined;

      if (!conversationId) {
        console.log(`[Poller] Attempt ${attempt}: no conversation_id yet`);
        await sleep(30_000); continue;
      }

      const conversation = await getConversation(conversationId);
      const status = conversation.status;
      console.log(`[Poller] Attempt ${attempt}: status=${status}`);

      if (['in_progress','processing','initiated'].includes(status)) {
        await sleep(30_000); continue;
      }

      // ── Extract results ──────────────────────────────────────────────────
      const analysis = conversation.analysis || {};
      const dcr = analysis.data_collection_results || {};
      const summary = analysis.transcript_summary || '';
      const transcript = formatTranscript(conversation.transcript);

      let callOutcome = extractDCRValue(dcr.call_outcome);
      let confirmedDate = resolveDate(extractDCRValue(dcr.confirmed_date));
      let confirmedTime = resolveTime(extractDCRValue(dcr.confirmed_time));
      let patientConfirmed = ['true','yes','1'].includes(extractDCRValue(dcr.patient_confirmed).toLowerCase());

      // Fallbacks
      if (!patientConfirmed && summary) {
        patientConfirmed = ['confirmed','chose','selected','booked','scheduled','agreed'].some(p => summary.toLowerCase().includes(p));
      }
      if (!patientConfirmed && transcript) patientConfirmed = detectConfirmation(transcript);
      if (patientConfirmed && !confirmedDate) {
        [confirmedDate, confirmedTime] = extractDateTimeFromText(summary || transcript, confirmedTime);
      }
      if (!callOutcome) callOutcome = patientConfirmed ? 'confirmed' : 'completed';

      console.log(`[Poller] confirmed=${patientConfirmed}, date=${confirmedDate}, time=${confirmedTime}`);

      // ── Update execution ─────────────────────────────────────────────────
      log.push({
        node_id: 'auto_poll', node_type: 'poll_result',
        label: 'ElevenLabs Call Completed',
        status: 'ok',
        message: `Outcome: ${callOutcome}. Patient confirmed: ${patientConfirmed}.`,
        timestamp: new Date().toISOString(),
        conversation_id: conversationId, call_outcome: callOutcome,
        patient_confirmed: patientConfirmed, confirmed_date: confirmedDate, confirmed_time: confirmedTime,
        transcript_preview: transcript.slice(0, 300),
      });

      await supabase.from('workflow_executions').update({
        status: 'completed', completed_at: new Date().toISOString(),
        execution_log: log, conversation_id: conversationId,
        call_outcome: callOutcome, call_transcript: transcript.slice(0,10000),
        patient_confirmed: patientConfirmed,
        confirmed_date: confirmedDate || null, confirmed_time: confirmedTime || null,
      }).eq('id', executionId);

      // ── Create appointment ────────────────────────────────────────────────
      if (patientConfirmed && confirmedDate) {
        await createAppointmentFromCall(exec, confirmedDate, confirmedTime, callOutcome, log, executionId, supabase);
      }

      return;
    } catch (err) {
      console.warn(`[Poller] Attempt ${attempt} error:`, err);
      await sleep(30_000);
    }
  }
  console.warn(`[Poller] Max attempts reached for ${executionId}`);
}

async function createAppointmentFromCall(
  exec: Record<string, unknown>,
  confirmedDate: string,
  confirmedTime: string,
  callOutcome: string,
  log: Record<string, unknown>[],
  executionId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  try {
    const { data: workflow } = await supabase
      .from('workflows').select('hospital_id,doctor_id').eq('id', exec.workflow_id).single();
    const { data: patient } = await supabase
      .from('users').select('name,email').eq('id', exec.patient_id).single();
    if (!workflow || !patient) throw new Error('Could not fetch workflow/patient');

    const { data: appt } = await supabase.from('appointments').insert({
      patient_id: exec.patient_id,
      patient_name: patient.name,
      hospital_id: workflow.hospital_id,
      doctor_id: workflow.doctor_id,
      date: confirmedDate,
      time_slot: confirmedTime,
      status: 'confirmed',
      otp_verified: true,
    }).select('id').single();

    log.push({
      node_id: 'appt_auto', node_type: 'schedule_appointment',
      label: 'Appointment Auto-Created', status: 'ok',
      message: `Appointment booked: ${confirmedDate} at ${confirmedTime}`,
      timestamp: new Date().toISOString(), appointment_id: appt?.id,
    });

    // Notify patient
    await supabase.from('notifications').insert({
      user_id: exec.patient_id, title: 'Appointment Confirmed',
      message: `Your appointment is confirmed for ${confirmedDate} at ${confirmedTime}.`,
      type: 'appointment', read: false,
    });
    // Notify doctor
    if (workflow.doctor_id) {
      await supabase.from('notifications').insert({
        user_id: workflow.doctor_id, title: 'New Appointment via Workflow',
        message: `${patient.name} confirmed for ${confirmedDate} at ${confirmedTime}. Outcome: ${callOutcome}.`,
        type: 'appointment', read: false,
      });
    }
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
```

---

### FILE 4: `/src/lib/workflow/engine.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowContext, StepLog } from '@/lib/types/workflow';
import { CONDITION_TYPES } from './nodeCatalogue';
import { initiateOutboundCall } from '@/lib/services/elevenLabsService';

// ── Main entry ─────────────────────────────────────────────────────────────

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

  // Fetch doctor name
  if (workflow.doctor_id) {
    const supabase = await createClient();
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

// ── Graph ──────────────────────────────────────────────────────────────────

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

// ── Dispatcher ─────────────────────────────────────────────────────────────

async function dispatch(
  node: WorkflowNode, ctx: WorkflowContext
): Promise<{ step: StepLog; conditionResult?: boolean }> {
  const ts = () => new Date().toISOString();
  const { nodeType } = node.data;

  if (node.type === 'trigger') {
    return { step: mkStep(node, 'ok', `Trigger: ${nodeType} fired`, ts()) };
  }

  // Conditions
  if (CONDITION_TYPES.includes(nodeType)) {
    return handleCondition(node, ctx);
  }

  // Actions & Outputs
  switch (nodeType) {
    case 'call_patient':            return handleCallPatient(node, ctx);
    case 'send_sms':                return handleSendSms(node, ctx);
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

// ── Condition Handlers ─────────────────────────────────────────────────────

async function handleCondition(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const { nodeType, params } = node.data;
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
      const supabase = await createClient();
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
      const supabase = await createClient();
      const terms = (params.medication||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      if (!terms.length) return { step: mkStep(node, 'error', 'No medication name configured', ts), conditionResult: false };
      // query a patient_medications table if it exists, else check users.notes
      const { data: meds } = await supabase.from('patient_medications').select('name,status').eq('patient_id', patient.id as string).eq('status','active');
      const matched = (meds || []).filter(m => terms.some(t => m.name?.toLowerCase().includes(t))).map(m => m.name);
      const passed = matched.length > 0;
      return { step: mkStep(node, passed?'ok':'skipped', passed?`Found: ${matched.join(', ')}`:`No active meds matching: ${terms.join(', ')}`, ts, { matched }), conditionResult: passed };
    }
    default:
      return { step: mkStep(node, 'skipped', `No condition handler for ${nodeType}`, ts), conditionResult: false };
  }
}

// ── Action Handlers ────────────────────────────────────────────────────────

async function handleCallPatient(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const phone = ctx.patient.phone as string || ctx.patient.mobile as string;
  if (!phone) return { step: mkStep(node, 'error', 'No patient phone number', ts) };

  const { params } = node.data;
  try {
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
    return { step: mkStep(node, 'ok', `Call initiated — conversation_id: ${result.conversation_id}`, ts, { conversation_id: result.conversation_id }) };
  } catch (err) {
    return { step: mkStep(node, 'error', `Call failed: ${err}`, ts) };
  }
}

async function handleSendSms(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const phone = ctx.patient.phone as string || ctx.patient.mobile as string;
  if (!phone) return { step: mkStep(node, 'error', 'No patient phone number', ts) };
  const { message } = node.data.params;

  try {
    // Twilio SMS
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
  const supabase = await createClient();
  const { message, recipient } = node.data.params;
  const recipientId = recipient === 'doctor' ? ctx.doctor_id : ctx.patient.id as string;

  const { data, error } = await supabase.from('notifications').insert({
    user_id: recipientId, title: 'Workflow Notification',
    message: message || `Automated notification for patient ${ctx.patient.name}`,
    type: 'general', read: false,
  }).select('id').single();
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Notification sent`, ts, { notification_id: data?.id }) };
}

async function handleCreateLabOrder(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { task_type, details, due_date } = node.data.params;
  const { data, error } = await supabase.from('staff_assignments').insert({
    patient_id: ctx.patient.id as string, assigned_to: ctx.doctor_id,
    task_type: task_type || 'Follow-up', details: details || null,
    due_date: due_date || null, status: 'assigned',
  }).select('id').single();
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Task assigned: ${task_type}`, ts, { assignment_id: data?.id }) };
}

async function handleUpdatePatient(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  const { field, value } = node.data.params;
  const allowed = ['notes','risk_level','primary_physician','insurance','last_visit'];
  if (!allowed.includes(field)) return { step: mkStep(node, 'error', `Field "${field}" not allowed`, ts) };
  const supabase = await createClient();
  const { error } = await supabase.from('users').update({ [field]: value }).eq('id', ctx.patient.id as string);
  if (error) throw error;
  return { step: mkStep(node, 'ok', `Patient.${field} = "${value}"`, ts) };
}

async function handleSendSummary(node: WorkflowNode, ctx: WorkflowContext) {
  const ts = new Date().toISOString();
  if (!ctx.doctor_id) return { step: mkStep(node, 'error', 'No doctor_id in context', ts) };
  const supabase = await createClient();
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

// ── Helpers ────────────────────────────────────────────────────────────────

function mkStep(node: WorkflowNode, status: 'ok'|'error'|'skipped', message: string, timestamp: string, extra?: Record<string,unknown>): StepLog {
  return { node_id: node.id, node_type: node.data.nodeType, label: node.data.label, status, message, timestamp, ...(extra||{}) };
}

function errStep(nodeId: string, message: string): StepLog {
  return { node_id: nodeId, node_type: 'error', label: 'Error', status: 'error', message, timestamp: new Date().toISOString() };
}
```

---

### FILE 5: `/src/lib/workflow/triggers.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { executeWorkflow } from './engine';
import { pollCallResult } from '@/lib/services/elevenLabsService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Call this anywhere in the app when something happens.
 * It finds all ENABLED workflows with a matching trigger and runs them.
 *
 * Usage:
 *   await fireEvent('appointment_missed', patientId, { appointmentId, doctorId })
 *   await fireEvent('queue_completed',    patientId, { queueId })
 *   await fireEvent('new_patient_registered', patientId, { email })
 */
export async function fireEvent(
  triggerType: string,
  patientId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = await createClient();

  const { data: patient } = await supabase.from('users').select('*').eq('id', patientId).single();
  if (!patient) return;

  const { data: workflows } = await supabase.from('workflows').select('*').eq('status', 'ENABLED');
  if (!workflows?.length) return;

  const matching = workflows.filter(wf => {
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
        // Fire-and-forget background polling
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
```

---

### FILE 6: `/src/app/api/workflows/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  let query = supabase.from('workflows').select('*').order('created_at', { ascending: false });
  if (searchParams.get('hospital_id')) query = query.eq('hospital_id', searchParams.get('hospital_id')!);
  if (searchParams.get('doctor_id'))   query = query.eq('doctor_id',   searchParams.get('doctor_id')!);
  if (searchParams.get('status'))      query = query.eq('status',      searchParams.get('status')!);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('workflows').insert({
    hospital_id: body.hospital_id, doctor_id: body.doctor_id || null,
    name: body.name, description: body.description || null,
    category: body.category || 'Ungrouped', status: body.status || 'DRAFT',
    nodes: body.nodes || [], edges: body.edges || [],
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

---

### FILE 7: `/src/app/api/workflows/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('workflows').select('*').eq('id', params.id).single();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('workflows')
    .update({ ...body, updated_at: new Date().toISOString() }).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { error } = await supabase.from('workflows').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

---

### FILE 8: `/src/app/api/workflow-executions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { executeWorkflow } from '@/lib/workflow/engine';
import { pollCallResult } from '@/lib/services/elevenLabsService';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  let query = supabase.from('workflow_executions').select('*').order('started_at', { ascending: false });
  if (searchParams.get('workflow_id')) query = query.eq('workflow_id', searchParams.get('workflow_id')!);
  if (searchParams.get('patient_id'))  query = query.eq('patient_id',  searchParams.get('patient_id')!);
  if (searchParams.get('status'))      query = query.eq('status',      searchParams.get('status')!);
  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { workflow_id, patient_id, trigger_type, metadata } = await req.json();

  const { data: workflow } = await supabase.from('workflows').select('*').eq('id', workflow_id).single();
  if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

  const { data: patient } = await supabase.from('users').select('*').eq('id', patient_id).single();
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const executionId = uuidv4();
  await supabase.from('workflow_executions').insert({
    id: executionId, workflow_id, patient_id,
    trigger_type: trigger_type || 'manual', status: 'running',
  });

  const result = await executeWorkflow(workflow, patient, trigger_type || 'manual', metadata || {}, executionId);

  await supabase.from('workflow_executions').update({
    status: result.callInitiated ? 'running' : result.status,
    execution_log: result.steps,
    ...(!result.callInitiated && { completed_at: new Date().toISOString() }),
  }).eq('id', executionId);

  if (result.callInitiated) {
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
```

---

### FILE 9: `/src/app/api/elevenlabs/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();

  // Find matching execution
  const { data: executions } = await supabase
    .from('workflow_executions').select('*').eq('status','running')
    .order('started_at', { ascending: false }).limit(50);

  let matched = executions?.find(e =>
    (e.execution_log || []).some((s: Record<string,unknown>) => s.conversation_id === conversationId)
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
```

---

### FILE 10: `/src/app/api/trigger-event/route.ts`

```typescript
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
```

---

## SECTION 7 — WIRE TRIGGERS INTO EXISTING SERVICES

### In `/src/lib/services/queueService.ts`
Find where queue status changes to `completed`. Add after the DB update:
```typescript
import { fireEvent } from '@/lib/workflow/triggers';

// After updating queue status to 'completed':
await fireEvent('queue_completed', patientId, { queue_id: queueId, doctor_id: doctorId });
```

### In `/src/lib/services/appointmentService.ts`
Find where appointment is marked cancelled or missed:
```typescript
import { fireEvent } from '@/lib/workflow/triggers';

// After marking appointment as missed/no-show:
await fireEvent('appointment_missed', patientId, { appointment_id: appointmentId, doctor_id: doctorId });
```

### In `/src/lib/services/authService.ts`
After new user row is created:
```typescript
import { fireEvent } from '@/lib/workflow/triggers';

// After creating the user record:
await fireEvent('new_patient_registered', newUser.id, { email: newUser.email });
```

---

## SECTION 8 — DOCTOR SIDE QUICK FIXES

These are small wires to complete already-started features.

### Add Skip + Transfer buttons to doctor queue UI
In `/src/app/doctor/page.tsx`, add buttons that call the existing APIs:
```typescript
// Skip button
await fetch('/api/queue/skip', { method: 'POST', body: JSON.stringify({ queue_id }) });

// Transfer button — show modal to pick target doctor
await fetch('/api/queue/transfer', { method: 'POST', body: JSON.stringify({ queue_id, target_doctor_id }) });
```

### Add notification bell
Query `notifications` table where `user_id = doctorId`, show unread count badge, mark as read on click.

### Add leave management
```typescript
// PUT /api/doctors/me/leave
const { error } = await supabase.from('doctors')
  .update({ is_on_leave: true, leave_from: fromDate, leave_to: toDate })
  .eq('id', doctorId);
```

### Rating collection
After marking appointment `completed`, show a modal:
```typescript
// POST /api/ratings
await supabase.from('ratings').insert({ patient_id, doctor_id, hospital_id, appointment_id, rating, feedback });
// Update doctor average
const { data: allRatings } = await supabase.from('ratings').select('rating').eq('doctor_id', doctor_id);
const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
await supabase.from('doctors').update({ rating: avg, total_ratings: allRatings.length }).eq('id', doctor_id);
```

---

## SECTION 9 — ADMIN SIDE MISSING PAGES

### `/src/app/admin/queue-management/page.tsx`
Query:
```typescript
const { data } = await supabase.from('queue')
  .select('*, users(name), doctors(name), hospitals(name), departments(name)')
  .eq('status', 'waiting')
  .order('position');
```
Actions:
- Force complete: `UPDATE queue SET status='completed'`
- Force cancel: `UPDATE queue SET status='cancelled'`
- Reassign: `UPDATE queue SET doctor_id = newDoctorId`

### `/src/app/admin/appointments/page.tsx`
Query:
```typescript
const { data } = await supabase.from('appointments')
  .select('*, users(name), doctors(name), hospitals(name)')
  .order('date', { ascending: false });
```
Actions: change status, cancel, confirm

### `/src/app/admin/departments/page.tsx`
Full CRUD on `departments` table. Group by hospital.

### `/src/app/admin/analytics/page.tsx`
Install `recharts`:
```bash
npm install recharts
```
5 charts:
- Queue volume over time (line chart from `historical_data`)
- Wait times by hospital (bar chart)
- Doctor performance (table: patients served, avg time, rating)
- Peak hours heatmap (7×24 grid from `historical_data`)
- Appointment completion rate (pie chart)

### `/src/app/admin/settings/page.tsx`
Read/write `system_settings` table. Fields: queue alert threshold, default treatment time, etc.

---

## SECTION 10 — COMPLETE BUILD ORDER

Build in this exact order — each step depends on the previous:

```
PHASE 1 — Foundation (Day 1)
□ Run migration SQL in Supabase
□ Install: npm install @xyflow/react dagre @types/dagre recharts
□ Add all env vars to .env
□ Create /src/lib/types/workflow.ts
□ Create /src/lib/workflow/nodeCatalogue.ts

PHASE 2 — Engine (Day 1-2)
□ Create /src/lib/services/elevenLabsService.ts
□ Create /src/lib/workflow/engine.ts
□ Create /src/lib/workflow/triggers.ts

PHASE 3 — API Routes (Day 2)
□ Create /src/app/api/workflows/route.ts
□ Create /src/app/api/workflows/[id]/route.ts
□ Create /src/app/api/workflow-executions/route.ts
□ Create /src/app/api/elevenlabs/webhook/route.ts
□ Create /src/app/api/trigger-event/route.ts

PHASE 4 — Wire Triggers (Day 2)
□ Add fireEvent() calls to queueService.ts
□ Add fireEvent() calls to appointmentService.ts
□ Add fireEvent() calls to authService.ts

PHASE 5 — React Flow Frontend (Day 3-4)
□ Create /src/components/workflow/TriggerNode.tsx
□ Create /src/components/workflow/ActionNode.tsx
□ Create /src/components/workflow/ConditionalNode.tsx
□ Create /src/components/workflow/EndpointNode.tsx
□ Create /src/components/workflow/NodePalette.tsx
□ Create /src/components/workflow/PropertiesPanel.tsx
□ Create /src/components/workflow/ExecutionLog.tsx
□ Create /src/app/workflows/page.tsx
□ Create /src/app/workflows/[id]/page.tsx
□ Create /src/app/workflow-executions/page.tsx

PHASE 6 — Admin Pages (Day 4-5)
□ Build /src/app/admin/queue-management/page.tsx
□ Build /src/app/admin/appointments/page.tsx
□ Build /src/app/admin/departments/page.tsx
□ Build /src/app/admin/analytics/page.tsx
□ Build /src/app/admin/settings/page.tsx

PHASE 7 — Doctor Quick Fixes (Day 5)
□ Add Skip + Transfer buttons to doctor queue UI
□ Add notification bell to doctor header
□ Add leave management toggle
□ Add rating collection modal after appointment complete
```

---

## SECTION 11 — DEPLOYMENT CHECKLIST

```
□ Push to GitHub
□ Connect repo to Vercel
□ Add all env vars in Vercel dashboard (Settings → Environment Variables)
□ Set Clerk webhook URL: https://your-app.vercel.app/api/webhooks/clerk
□ Set ElevenLabs webhook URL: https://your-app.vercel.app/api/elevenlabs/webhook
□ Update main.py CORS (if still running BeyondMinus backend)
□ Run SQL migration in Supabase production project
□ Test: create a workflow, run it on a patient, verify execution log
```

---

## SECTION 12 — COST SUMMARY

| Service | Free Tier | Paid When |
|---------|-----------|-----------|
| Vercel | Unlimited hobby | Never for this scale |
| Supabase | 500MB DB | >500MB data |
| Clerk | 10,000 MAU | >10k users |
| Gmail SMTP | Free | Never |
| ElevenLabs | 10k chars/mo | First real call |
| Twilio | $15 trial credit | After trial |

**Zero cost to build and test. ~$10–30/month once you start making real calls.**

---

*Generated: 2026-03-29 | Target: /Users/aryan/Desktop/hackarean/Hackarena*
