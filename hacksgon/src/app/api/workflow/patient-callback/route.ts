/**
 * POST /api/workflow/patient-callback
 *
 * Method A — logged-in patient requests an AI callback to book an appointment.
 * Identity is already known via session; no OTP needed.
 *
 * Body (all optional):
 *   { doctorId?, hospitalId?, departmentId?, availableSlots? }
 *
 * Flow:
 *   1. Auth check → resolve patient record from users table
 *   2. Fetch hospitals (for DTMF keypad menu)
 *   3. Create patient_call_requests record (status: calling)
 *   4. Initiate ElevenLabs outbound call with pre-loaded context
 *   5. Store conversation_id + hospital_map in the call request record
 *   6. Return immediately — webhook at /api/elevenlabs/webhook handles the rest
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/server';
import { initiateOutboundCall } from '@/lib/services/elevenLabsService';

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const compact = raw.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return `+${compact.slice(1)}`;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  const digits = compact.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { doctorId, hospitalId: preferredHospitalId, departmentId, availableSlots } = body;

    const supabase = createServerClient();

    // 1. Resolve patient from DB
    const { data: patient, error: patientError } = await supabase
      .from('users')
      .select('id, name, email, mobile')
      .eq('id', userId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient record not found' }, { status: 404 });
    }

    const phone = normalizePhone(patient.mobile);
    if (!phone) {
      return NextResponse.json(
        { error: 'No mobile number on your profile. Please add one in Profile settings.' },
        { status: 422 }
      );
    }

    // 2. Fetch hospitals for DTMF menu
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('id, name, address, phone')
      .limit(9);

    const hospitalList = (hospitals || []).map(
      (h: { id: string; name: string; address?: string; phone?: string }, i: number) => ({
        dtmf: String(i + 1),
        id: h.id,
        name: h.name,
        address: h.address || '',
        phone: h.phone || '',
      })
    );

    const hospitalMap: Record<string, string> = {};
    hospitalList.forEach(h => { hospitalMap[h.dtmf] = h.id; });

    // Build the DTMF prompt string the agent will read out
    const hospitalOptions =
      hospitalList.length > 1
        ? hospitalList.map(h => `press ${h.dtmf} for ${h.name}`).join(', ')
        : '';

    // If only one hospital, pre-select it
    const singleHospital = hospitalList.length === 1 ? hospitalList[0] : null;
    const resolvedHospitalId: string | null =
      preferredHospitalId ||
      singleHospital?.id ||
      null;

    // Fetch doctor name if provided
    let doctorName = 'an available doctor';
    if (doctorId) {
      const { data: doc } = await supabase
        .from('doctors')
        .select('name')
        .eq('id', doctorId)
        .single();
      if (doc) doctorName = doc.name;
    }

    // 3. Create call request record (status: calling)
    const { data: callReq, error: crError } = await supabase
      .from('patient_call_requests')
      .insert({
        patient_id: userId,
        call_type: 'outbound',
        status: 'calling',
        phone_used: phone,
        hospital_id: resolvedHospitalId,
        department_id: departmentId || null,
        doctor_id: doctorId || null,
        // Store hospital_map in notes so the webhook can resolve DTMF → hospital ID
        notes: JSON.stringify({ hospital_map: hospitalMap }),
      })
      .select('id')
      .single();

    if (crError || !callReq) {
      console.error('[PatientCallback] Failed to create call request:', crError);
      return NextResponse.json({ error: 'Failed to create call request' }, { status: 500 });
    }

    // 4. Initiate the ElevenLabs outbound call
    const slots =
      availableSlots ||
      'Monday 10 AM, Tuesday 2 PM, Wednesday 9 AM, Thursday 3 PM, Friday 11 AM';

    let result: { conversation_id: string; callSid?: string };
    try {
      result = await initiateOutboundCall({
        patientPhone: phone,
        patientName: patient.name || 'there',
        doctorName,
        facilityName: singleHospital?.name || '',
        facilityAddress: singleHospital?.address || '',
        facilityPhoneNumber: singleHospital?.phone || '',
        // call_reason intentionally blank — agent will ask the patient
        callReason: '',
        availableSlots: slots,
        hospitalOptions,
        extraContext: { call_request_id: callReq.id },
      });
    } catch (err) {
      // Mark request as failed if call initiation fails
      await supabase
        .from('patient_call_requests')
        .update({ status: 'failed' })
        .eq('id', callReq.id);
      throw err;
    }

    // 5. Store conversation_id on the call request record
    await supabase
      .from('patient_call_requests')
      .update({ conversation_id: result.conversation_id })
      .eq('id', callReq.id);

    return NextResponse.json({
      success: true,
      message: `You'll receive a call at ${phone} shortly.`,
      callRequestId: callReq.id,
      conversationId: result.conversation_id,
    });
  } catch (error: unknown) {
    console.error('[PatientCallback] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
