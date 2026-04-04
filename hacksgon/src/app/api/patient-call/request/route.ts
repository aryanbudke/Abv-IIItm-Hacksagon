import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hackarena.aryanbudke.in';

function normalizePhone(raw: string): string {
  const compact = raw.replace(/\s+/g, '').replace(/-/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return '+' + compact.slice(2);
  const digits = compact.replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length >= 11) return '+' + digits;
  return compact;
}

// POST /api/patient-call/request
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hospitalId, departmentId, doctorId } = await request.json().catch(() => ({}));

    const supabase = createServerClient();

    // 1. Fetch patient
    const { data: patient, error: pErr } = await supabase
      .from('users')
      .select('id, name, mobile, email')
      .eq('id', userId)
      .single();

    if (pErr || !patient) {
      return NextResponse.json({ error: 'Patient profile not found. Please complete your profile first.' }, { status: 404 });
    }
    if (!patient.mobile) {
      return NextResponse.json({ error: 'No mobile number on file. Add your phone number in Profile settings.' }, { status: 400 });
    }

    const phone = normalizePhone(patient.mobile);

    // 2. Fetch hospitals for DTMF menu
    const { data: hospitals, error: hospErr } = await supabase
      .from('hospitals')
      .select('id, name, address, phone')
      .order('name')
      .limit(9);

    console.log('[PatientCall] Hospitals query result:', { count: hospitals?.length ?? 0, error: hospErr?.message });

    if (!hospitals || hospitals.length === 0) {
      console.error('[PatientCall] No hospitals found — Supabase query returned empty. Check SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in Vercel env vars.');
      return NextResponse.json({ error: 'No hospitals found. Check database configuration.' }, { status: 500 });
    }

    const hospitalList = (hospitals || []).map(
      (h: { id: string; name: string; address?: string; phone?: string }, i: number) => ({
        dtmf: String(i + 1),
        id: h.id,
        name: h.name,
        address: h.address || '',
        phone: h.phone || '',
      })
    );

    // DTMF hospital map: { "1": "uuid", "2": "uuid" }
    const hospitalMap: Record<string, string> = {};
    hospitalList.forEach(h => { hospitalMap[h.dtmf] = h.id; });

    const hospitalOptions =
      hospitalList.length > 1
        ? hospitalList.map(h => `press ${h.dtmf} for ${h.name}`).join(', ')
        : '';

    // If pre-selected or only one hospital, resolve name for the prompt
    const preselectedHospital =
      hospitalId
        ? hospitalList.find(h => h.id === hospitalId)
        : hospitalList.length === 1
          ? hospitalList[0]
          : null;

    const facilityName = preselectedHospital?.name || '';

    // 3. Fetch available slots (exclude already booked)
    const todayStr = new Date().toISOString().split('T')[0];
    const allSlots = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
    let availableSlots = allSlots;

    if (doctorId) {
      const { data: booked } = await supabase
        .from('appointments')
        .select('time_slot')
        .eq('doctor_id', doctorId)
        .eq('date', todayStr)
        .neq('status', 'cancelled');
      const bookedSet = new Set((booked || []).map((a: { time_slot: string }) => a.time_slot));
      availableSlots = allSlots.filter(s => !bookedSet.has(s));
    }

    const slotsText = availableSlots.join(', ') || '09:00 AM, 02:00 PM, 04:00 PM';

    // 4. Fetch doctors grouped by hospital
    const { data: allDoctors } = await supabase
      .from('doctors')
      .select('id, name, specialization, hospital_id')
      .order('name');

    // Build per-hospital doctor DTMF map: { hospital_dtmf: { doctor_dtmf: doctor_uuid } }
    const doctorMap: Record<string, Record<string, string>> = {};
    // Build human-readable options per hospital number
    const hospitalDoctorLines: string[] = [];

    hospitalList.forEach(h => {
      const docs = (allDoctors || []).filter(
        (d: { id: string; name: string; specialization?: string; hospital_id?: string }) =>
          d.hospital_id === h.id
      );
      if (docs.length === 0) return;

      const perHospDoctorMap: Record<string, string> = {};
      const docOptions = docs.map(
        (d: { id: string; name: string; specialization?: string }, i: number) => {
          const dtmf = String(i + 1);
          perHospDoctorMap[dtmf] = d.id;
          return `press ${dtmf} for Dr. ${d.name}${d.specialization ? ` (${d.specialization})` : ''}`;
        }
      ).join(', ');

      doctorMap[h.dtmf] = perHospDoctorMap;
      hospitalDoctorLines.push(`Hospital ${h.dtmf} (${h.name.trim()}): ${docOptions}`);
    });

    // Variable passed to agent — tells it which doctors to offer per hospital
    const hospitalDoctors = hospitalDoctorLines.length > 0
      ? hospitalDoctorLines.join('\n')
      : 'No doctors available';

    // If doctor was pre-selected, resolve name
    let doctorName = '';
    if (doctorId) {
      const preselDoc = (allDoctors || []).find(
        (d: { id: string; name: string }) => d.id === doctorId
      );
      if (preselDoc) doctorName = `Dr. ${preselDoc.name}`;
    }

    // 5. Create call request — store hospital_map and doctor_map in notes for webhook to use later
    const { data: callReq, error: crErr } = await supabase
      .from('patient_call_requests')
      .insert({
        patient_id: userId,
        call_type: 'outbound',
        status: 'pending',
        phone_used: phone,
        hospital_id: preselectedHospital?.id || hospitalId || null,
        department_id: departmentId || null,
        doctor_id: doctorId || null,
        notes: JSON.stringify({ hospital_map: hospitalMap, doctor_map: doctorMap, hospital_doctors: hospitalDoctorLines }),
      })
      .select()
      .single();

    if (crErr || !callReq) {
      console.error('[PatientCall] Failed to create call request:', crErr);
      return NextResponse.json({ error: 'Failed to create call request' }, { status: 500 });
    }

    // 6. Build full system prompt with real doctor data embedded
    const systemPrompt = buildSystemPrompt({
      patientName: patient.name || 'Patient',
      doctorName,
      facilityName,
      hospitalOptions,
      hospitalDoctors,
      availableSlots: slotsText,
    });

    const firstName = (patient.name || 'Patient').split(' ')[0];

    // 7. Initiate ElevenLabs outbound call — system prompt override embeds real doctor data
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

    if (!elevenKey || !agentId || !phoneNumberId) {
      await supabase.from('patient_call_requests').update({ status: 'failed', notes: 'ElevenLabs not configured' }).eq('id', callReq.id);
      return NextResponse.json({ error: 'Calling service not configured.' }, { status: 503 });
    }

    console.log('[PatientCall] Initiating call to', phone, 'for patient', patient.name);
    console.log('[PatientCall] hospital_doctors value:', hospitalDoctors);

    const webhookUrl = `${APP_URL}/api/patient-call/webhook`;
    console.log('[PatientCall] Webhook URL:', webhookUrl);

    const elevenRes = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: phone,
        // post_call_webhook_url fires when call ends with full transcript + DCR
        post_call_webhook_url: webhookUrl,
        conversation_initiation_client_data: {
          conversation_config_override: {
            agent: {
              prompt: { prompt: systemPrompt },
              first_message: `Hi ${firstName}, this is MediQueue calling. I'm here to help you book a medical appointment. Is now a good time?`,
            },
          },
          dynamic_variables: {
            patient_name: patient.name || 'Patient',
            call_request_id: callReq.id,
          },
        },
      }),
    });

    if (!elevenRes.ok) {
      const errBody = await elevenRes.text();
      console.error('[PatientCall] ElevenLabs error:', elevenRes.status, errBody);
      await supabase.from('patient_call_requests').update({ status: 'failed', notes: `ElevenLabs error: ${errBody}` }).eq('id', callReq.id);
      return NextResponse.json({ error: `Call service error (${elevenRes.status}): ${errBody}` }, { status: elevenRes.status || 502 });
    }

    const elevenData = await elevenRes.json();
    const conversationId = elevenData.conversation_id || elevenData.id;

    console.log('[PatientCall] Call initiated. conversation_id:', conversationId);

    // 8. Store conversation_id and mark as calling
    await supabase.from('patient_call_requests').update({
      status: 'calling',
      conversation_id: conversationId,
    }).eq('id', callReq.id);

    return NextResponse.json({
      success: true,
      callRequestId: callReq.id,
      conversationId,
      phone: phone.slice(0, 4) + '****' + phone.slice(-4),
      message: 'Call initiated! Our AI assistant will help you book your appointment.',
    });

  } catch (err: unknown) {
    console.error('[PatientCall] Fatal error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 });
  }
}

// GET — list recent call requests for the logged-in patient
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerClient();
    const { data } = await supabase
      .from('patient_call_requests')
      .select('*')
      .eq('patient_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({ requests: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

// DELETE — cancel a pending call request
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createServerClient();
    await supabase
      .from('patient_call_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('patient_id', userId)
      .in('status', ['pending', 'calling']);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

function buildSystemPrompt({
  patientName,
  doctorName,
  facilityName,
  hospitalOptions,
  hospitalDoctors,
  availableSlots,
}: {
  patientName: string;
  doctorName: string;
  facilityName: string;
  hospitalOptions: string;
  hospitalDoctors: string;
  availableSlots: string;
}) {
  const firstName = patientName.split(' ')[0];
  const hospitalStep = hospitalOptions
    ? `STEP 2 — HOSPITAL SELECTION:
Say: "To choose your hospital, please press a number on your keypad. ${hospitalOptions}."
Wait for the patient to press a number. Acknowledge their choice.`
    : facilityName
      ? `STEP 2 — HOSPITAL:
The hospital is already set to ${facilityName}. Tell the patient: "Your appointment will be at ${facilityName}."`
      : '';

  return `You are a medical appointment booking assistant for MediQueue. You are calling ${patientName}.

CRITICAL RULES:
- You already know the patient's name: ${patientName}. NEVER ask for their name.
- After the patient says YES to confirm, say goodbye and END THE CALL immediately. Do not keep talking.
- Keep all responses SHORT. This is a phone call, not a chat.
- Speak naturally and clearly.
- ONLY use the doctor names listed in the AVAILABLE DOCTORS section below. NEVER invent or guess doctor names.

BOOKING FLOW — follow these steps in order:

STEP 1 — REASON FOR VISIT:
Ask: "What is the reason for your visit today?"
Listen and remember the answer. This is the appointment_reason.

${hospitalStep}

STEP 3 — DOCTOR SELECTION:
The patient pressed a number for their hospital. That digit is selected_hospital.
Doctor options per hospital are listed below. Find the line starting with "Hospital [selected_hospital]" and read ONLY those doctors.
Say: "For [hospital name], [read exactly the press options listed on that line]."
Wait for keypad press. Record the digit as selected_doctor.

AVAILABLE DOCTORS:
${hospitalDoctors}

STEP 4 — DATE AND TIME:
Say: "What date and time works for you? We have slots available: ${availableSlots}."
Listen. If they say a day name like "Thursday", confirm: "This coming Thursday?"
If they say "3 PM", confirm: "3 in the afternoon, correct?"
This gives you confirmed_date and confirmed_time.

STEP 5 — CONFIRM ALL DETAILS:
Read back everything:
"Let me confirm: [their reason] with [doctor name] at [hospital name] on [date] at [time]. Is that correct?"

If they say YES:
  1. Say exactly: "Perfect! Your appointment is confirmed and a confirmation email will be sent to you shortly. Thank you ${firstName}, have a great day! Goodbye!"
  2. END THE CALL. Do not say anything else after goodbye.

If they say NO or want to change something:
  Go back to the relevant step.

HANDLING EDGE CASES:
- If no response for 5 seconds: "Hello, can you hear me?" Once more, then end call if still no response.
- If they decline: "No problem, feel free to book online. Goodbye!"
- If they ask a medical question: "I can only help with scheduling — please discuss that with your doctor at the appointment."
- If a hospital has no doctors listed in the AVAILABLE DOCTORS section, say: "Sorry, no doctors are available at that hospital. Please choose another."

DATA TO RECORD — fill ALL fields before ending the call:
- appointment_reason: what the patient said (string)
- selected_hospital: the keypad number pressed — "1", "2", "3" etc. Leave blank if hospital was pre-set. (string)
- selected_doctor: the keypad number pressed for doctor — "1", "2", "3" etc. (string)
- confirmed_date: chosen date e.g. "2026-04-10" or "Monday" (string)
- confirmed_time: chosen time e.g. "10:00 AM" or "15:00" (string)
- patient_confirmed: true if patient said yes, false otherwise (boolean)
- call_outcome: "confirmed" / "declined" / "no_answer" (string)`;
}
