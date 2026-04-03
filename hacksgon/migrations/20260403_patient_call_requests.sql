-- Migration: Create patient_call_requests table
-- Tracks outbound/inbound AI call sessions for patient-initiated appointment booking
-- Applied via Supabase MCP on 2026-04-03

CREATE TABLE IF NOT EXISTS public.patient_call_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      TEXT NOT NULL,
  call_type       TEXT NOT NULL DEFAULT 'outbound' CHECK (call_type IN ('outbound','inbound')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','calling','completed','failed','cancelled')),
  phone_used      TEXT,           -- number the call was made to/from
  hospital_id     UUID,           -- pre-selected context for AI
  department_id   UUID,
  doctor_id       UUID,
  conversation_id TEXT,           -- ElevenLabs conversation ID
  appointment_id  UUID,           -- set once appointment is confirmed via call
  call_transcript TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.patient_call_requests ENABLE ROW LEVEL SECURITY;

-- Patients can manage their own call requests; service role bypasses RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'patient_call_requests'
      AND policyname = 'Patients can manage own call requests'
  ) THEN
    CREATE POLICY "Patients can manage own call requests"
      ON public.patient_call_requests
      FOR ALL
      USING (patient_id = auth.uid()::text OR auth.uid() IS NULL);
  END IF;
END $$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pcr_patient_id      ON public.patient_call_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcr_status          ON public.patient_call_requests(status);
CREATE INDEX IF NOT EXISTS idx_pcr_conversation_id ON public.patient_call_requests(conversation_id);
