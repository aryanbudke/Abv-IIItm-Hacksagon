import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

// POST /api/patient-call/request
// Initiates an outbound callback from ElevenLabs to the patient's registered number
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hospitalId, departmentId, doctorId } = await request.json();

    const supabase = createServerClient();

    // 1. Fetch patient data
    const { data: patient, error: pErr } = await supabase
      .from('users')
      .select('id, name, mobile, email')
      .eq('id', userId)
      .single();

    if (pErr || !patient) {
      return NextResponse.json({ error: 'Patient profile not found. Please complete your profile first.' }, { status: 404 });
    }
    if (!patient.mobile) {
      return NextResponse.json({ error: 'No mobile number on file. Please add your phone number in Profile settings.' }, { status: 400 });
    }

    // 2. Fetch context for AI agent (hospitals, doctors, available slots)
    const [hospitalsRes, slotsContext] = await Promise.all([
      supabase.from('hospitals').select('id, name').order('name'),
      doctorId
        ? supabase.from('appointments').select('time_slot').eq('doctor_id', doctorId)
            .eq('date', new Date().toISOString().split('T')[0]).neq('status', 'cancelled')
        : Promise.resolve({ data: [] }),
    ]);

    const hospitals = hospitalsRes.data || [];
    const bookedSlots = new Set(((slotsContext as any).data || []).map((a: any) => a.time_slot));

    const allSlots = ['09:00 AM','10:00 AM','11:00 AM','02:00 PM','03:00 PM','04:00 PM','05:00 PM'];
    const availableSlots = allSlots.filter(s => !bookedSlots.has(s));

    // 3. Create call request record
    const { data: callReq, error: crErr } = await supabase
      .from('patient_call_requests')
      .insert({
        patient_id: userId,
        call_type: 'outbound',
        status: 'pending',
        phone_used: patient.mobile,
        hospital_id: hospitalId || null,
        department_id: departmentId || null,
        doctor_id: doctorId || null,
      })
      .select()
      .single();

    if (crErr || !callReq) {
      return NextResponse.json({ error: 'Failed to create call request' }, { status: 500 });
    }

    // 4. Build dynamic variables for ElevenLabs agent
    const hospitalName = hospitalId
      ? hospitals.find((h: any) => h.id === hospitalId)?.name || 'your selected hospital'
      : 'any available hospital';

    const dynamicVariables: Record<string, string> = {
      patient_name: patient.name || 'Patient',
      patient_id: userId,
      call_request_id: callReq.id,
      hospital_name: hospitalName,
      hospital_list: hospitals.map((h: any, i: number) => `${i + 1}. ${h.name}`).join(', '),
      available_slots: availableSlots.join(', ') || '09:00 AM, 02:00 PM, 04:00 PM',
    };

    // 5. Initiate ElevenLabs outbound call
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

    if (!elevenKey || !agentId || !phoneNumberId) {
      // Mark as failed but return a meaningful response
      await supabase.from('patient_call_requests').update({ status: 'failed', notes: 'ElevenLabs not configured' }).eq('id', callReq.id);
      return NextResponse.json({
        error: 'Calling service not configured. Please contact support.',
        callRequestId: callReq.id,
      }, { status: 503 });
    }

    // Normalize phone number to E.164 format
    let phone = patient.mobile.replace(/\s+/g, '').replace(/-/g, '');
    if (!phone.startsWith('+')) phone = '+91' + phone.replace(/^0/, '');

    const elevenRes = await fetch('https://api.elevenlabs.io/v1/convai/conversations/outbound-call', {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: phone,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: buildSystemPrompt(patient.name, hospitalName, availableSlots, hospitals, callReq.id),
              },
              first_message: `Hello, am I speaking with ${patient.name}? I'm calling from MediQueue Pro to help you book an appointment.`,
              tools: [
                {
                  type: 'webhook',
                  name: 'get_available_slots',
                  description: 'Fetches available time slots for a given date in YYYY-MM-DD format.',
                  url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hackarena.aryanbudke.in'}/api/patient-call/webhook`,
                  method: 'POST',
                  parameters: {
                    type: 'object',
                    properties: {
                      doctor_id: { type: 'string', description: 'The ID of the doctor' },
                      date: { type: 'string', description: 'The date in YYYY-MM-DD format. Use today if not specified.' }
                    },
                    required: ['doctor_id', 'date']
                  }
                },
                {
                  type: 'webhook',
                  name: 'confirm_booking',
                  description: 'Finalizes the appointment booking in the system after patient confirmation.',
                  url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hackarena.aryanbudke.in'}/api/patient-call/webhook`,
                  method: 'POST',
                  parameters: {
                    type: 'object',
                    properties: {
                      call_request_id: { type: 'string', description: 'The ID of the call request session' },
                      doctor_id: { type: 'string', description: 'The ID of the doctor' },
                      date: { type: 'string', description: 'The confirmed date in YYYY-MM-DD format' },
                      time_slot: { type: 'string', description: 'The confirmed time slot (e.g. 10:00 AM)' }
                    },
                    required: ['call_request_id', 'doctor_id', 'date', 'time_slot']
                  }
                }
              ]
            },
          },
        },
      }),
    });

    if (!elevenRes.ok) {
      const errBody = await elevenRes.text();
      await supabase.from('patient_call_requests').update({ status: 'failed', notes: `ElevenLabs error: ${errBody}` }).eq('id', callReq.id);
      return NextResponse.json({ error: 'Failed to initiate call. Please try again.' }, { status: 502 });
    }

    const elevenData = await elevenRes.json();
    const conversationId = elevenData.conversation_id || elevenData.id;

    // 6. Update call request with conversation ID
    await supabase.from('patient_call_requests').update({
      status: 'calling',
      conversation_id: conversationId,
    }).eq('id', callReq.id);

    return NextResponse.json({
      success: true,
      callRequestId: callReq.id,
      conversationId,
      phone: phone.slice(0, 4) + '****' + phone.slice(-4),
      message: 'Call initiated! Please pick up — our AI assistant will help you book your appointment.',
    });

  } catch (err: any) {
    console.error('patient-call/request error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

// GET /api/patient-call/request?patientId=...
// Returns pending/recent call requests for a patient
export async function GET(request: NextRequest) {
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/patient-call/request?id=...
// Cancel a pending call request
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function buildSystemPrompt(patientName: string, hospitalName: string, availableSlots: string[], hospitals: any[], callRequestId: string) {
  const hospitalList = hospitals.map((h, i) => `${i + 1}. ${h.name}`).join('\n');
  const slotList = availableSlots.map((s, i) => `${i + 1}. ${s}`).join(', ');

  return `You are a friendly medical appointment booking assistant for MediQueue Pro.
You are calling ${patientName}. Their identity is ALREADY VERIFIED — do NOT ask for Name/ID.

CALL REQUEST ID: ${callRequestId}

BOOKING FLOW:
1. Greet warmly: "Hi ${patientName.split(' ')[0]}, this is MediQueue Pro calling..."
2. Ask for hospital preference.
   - Current preferred: ${hospitalName}
   - Others: ${hospitalList.replace(/\n/g, ', ')}
3. Ask for appointment date.
   - If they pick a date other than today, use the "get_available_slots" tool to check availability.
4. Offer time slots.
   - Today's slots: ${slotList}
5. Confirm: "I'll book you for [hospital] on [date] at [time]. Confirm with yes?"
6. ON YES: Call the "confirm_booking" tool with the following parameters:
   - call_request_id: "${callRequestId}"
   - doctor_id: [the selected doctor id or from context]
   - date: [YYYY-MM-DD]
   - time_slot: [e.g. 10:00 AM]
   IMPORTANT: ONLY call this tool AFTER they say YES.
7. Say: "Great, I've booked your appointment. You'll see it in your app dashboard. Goodbye!"

IMPORTANT RULES:
- Use "confirm_booking" tool for THE ACTUAL booking — do NOT just say you did it.
- Use "get_available_slots" if they ask for dates other than today.
- Keep responses short. Be polite and efficient.`;
}
