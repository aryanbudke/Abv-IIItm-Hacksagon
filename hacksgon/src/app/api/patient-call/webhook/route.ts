import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { emailService } from '@/lib/services/emailService';

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDCR(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const v = String((value as Record<string, unknown>).value ?? '').trim();
    return v.toLowerCase() === 'none' ? '' : v;
  }
  return String(value).trim();
}

function resolveDate(raw: string): string {
  if (!raw || raw.toLowerCase() === 'none') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const today = new Date();
  const lower = raw.toLowerCase().trim();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = days.indexOf(lower);
  if (idx !== -1) {
    const diff = ((idx - today.getDay()) + 7) % 7 || 7;
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    return d.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') {
    const d = new Date(today);
    d.setDate(today.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (lower === 'today') return today.toISOString().split('T')[0];

  const m = raw.match(/([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (m) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3] || today.getFullYear()}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return raw; // return as-is if we can't parse
}

function resolveTime(raw: string): string {
  if (!raw || raw.toLowerCase() === 'none') return '09:00 AM';
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(raw)) return raw;

  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  };

  const lower = raw.toLowerCase();
  const isAfternoon = /afternoon|evening|pm/.test(lower);
  const isMorning = /morning|am/.test(lower);

  // Replace word numbers with digits
  let normalized = lower.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
    (w) => String(wordToNum[w] || w));

  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    const [h, m] = normalized.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }

  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?/);
  if (match) {
    let h = parseInt(match[1]);
    const min = match[2] ? parseInt(match[2]) : 0;
    if (isAfternoon && h < 12) h += 12;
    if (isMorning && h === 12) h = 0;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
  }

  return raw;
}

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ElevenLabs post-call webhook sends data nested under body.data or at the top level
    const data = (body.data || body) as Record<string, unknown>;
    const conversationId: string = (body.conversation_id || data.conversation_id || '') as string;
    const callStatus: string = (body.status || data.status || '') as string;

    const analysis = ((data.analysis || body.analysis || {}) as Record<string, unknown>);
    const dcr = ((analysis.data_collection_results || {}) as Record<string, unknown>);

    console.log('[PatientCallWebhook] ── Incoming ──', {
      conversation_id: conversationId,
      status: callStatus,
      has_analysis: !!analysis,
      dcr_keys: Object.keys(dcr),
    });

    if (!conversationId) {
      console.warn('[PatientCallWebhook] No conversation_id in payload:', JSON.stringify(body).slice(0, 500));
      return NextResponse.json({ success: false, error: 'missing conversation_id' });
    }

    const supabase = createServerClient();

    // Find the matching call request
    const { data: callReq, error: reqErr } = await supabase
      .from('patient_call_requests')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (reqErr || !callReq) {
      console.warn('[PatientCallWebhook] No call request found for conversation_id:', conversationId);
      return NextResponse.json({ success: true, processed: 'no_matching_request' });
    }

    console.log('[PatientCallWebhook] Matched call request:', callReq.id, '| patient:', callReq.patient_id);

    // ── Extract DCR fields ──
    const appointmentReason = extractDCR(dcr.appointment_reason);
    const selectedHospitalKey = extractDCR(dcr.selected_hospital);
    const selectedDoctorKey = extractDCR(dcr.selected_doctor);
    const rawDate = extractDCR(dcr.confirmed_date);
    const rawTime = extractDCR(dcr.confirmed_time);
    const patientConfirmedRaw = extractDCR(dcr.patient_confirmed);
    const callOutcome = extractDCR(dcr.call_outcome);

    const confirmedDate = resolveDate(rawDate);
    const confirmedTime = resolveTime(rawTime);
    const patientConfirmed =
      ['true', 'yes', '1', 'confirmed'].includes(patientConfirmedRaw.toLowerCase()) ||
      callOutcome === 'confirmed';

    console.log('[PatientCallWebhook] DCR extracted:', {
      appointmentReason, selectedHospitalKey, selectedDoctorKey,
      confirmedDate, confirmedTime, patientConfirmed, callOutcome,
    });

    // ── Resolve hospital and doctor from DTMF keys ──
    let resolvedHospitalId: string | null = callReq.hospital_id || null;
    let resolvedDoctorId: string | null = callReq.doctor_id || null;

    try {
      const notesData = JSON.parse(callReq.notes || '{}');
      const hMap: Record<string, string> = notesData.hospital_map || {};
      const dMap: Record<string, string> = notesData.doctor_map || {};

      if (selectedHospitalKey && hMap[selectedHospitalKey]) {
        resolvedHospitalId = hMap[selectedHospitalKey];
        console.log('[PatientCallWebhook] Resolved hospital DTMF', selectedHospitalKey, '→', resolvedHospitalId);
      }
      // dMap is nested: { hospital_dtmf: { doctor_dtmf: doctor_uuid } }
      const hospitalDoctorMap = (dMap[selectedHospitalKey] || {}) as Record<string, string>;
      if (selectedDoctorKey && hospitalDoctorMap[selectedDoctorKey]) {
        resolvedDoctorId = hospitalDoctorMap[selectedDoctorKey];
        console.log('[PatientCallWebhook] Resolved doctor DTMF', selectedHospitalKey, '+', selectedDoctorKey, '→', resolvedDoctorId);
      }
    } catch {
      console.warn('[PatientCallWebhook] Could not parse maps from notes');
    }

    // ── If patient confirmed and we have a date → create appointment ──
    if (patientConfirmed && confirmedDate) {
      console.log('[PatientCallWebhook] Patient confirmed. Creating appointment...');

      // Fetch patient details
      const { data: patient } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', callReq.patient_id)
        .single();

      if (!patient?.name) {
        console.error('[PatientCallWebhook] Patient not found:', callReq.patient_id);
        await supabase.from('patient_call_requests').update({ status: 'failed' }).eq('id', callReq.id);
        return NextResponse.json({ success: false, error: 'Patient not found' });
      }

      const resolvedDepartmentId: string | null = callReq.department_id || null;

      // Fetch display names for email
      const [doctorRes, hospitalRes, departmentRes] = await Promise.all([
        resolvedDoctorId
          ? supabase.from('doctors').select('name').eq('id', resolvedDoctorId).single()
          : Promise.resolve({ data: null }),
        resolvedHospitalId
          ? supabase.from('hospitals').select('name').eq('id', resolvedHospitalId).single()
          : Promise.resolve({ data: null }),
        resolvedDepartmentId
          ? supabase.from('departments').select('name').eq('id', resolvedDepartmentId).single()
          : Promise.resolve({ data: null }),
      ]);

      const doctorName = doctorRes.data?.name || 'Assigned Doctor';
      const hospitalName = hospitalRes.data?.name || 'MediQueue Hospital';
      const departmentName = departmentRes.data?.name || 'General';

      // Insert appointment
      const { data: appt, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          patient_id: patient.id,
          patient_name: patient.name,
          doctor_id: resolvedDoctorId,
          hospital_id: resolvedHospitalId,
          department_id: resolvedDepartmentId,
          doctor_name: doctorName,
          hospital_name: hospitalName,
          department_name: departmentName,
          date: confirmedDate,
          time_slot: confirmedTime,
          status: 'confirmed',
          otp_verified: true,
        })
        .select()
        .single();

      if (apptErr) {
        console.error('[PatientCallWebhook] Appointment insert FAILED:', apptErr);
        await supabase.from('patient_call_requests').update({ status: 'failed' }).eq('id', callReq.id);
        return NextResponse.json({ success: false, error: apptErr.message });
      }

      console.log('[PatientCallWebhook] ✅ Appointment created:', appt.id, '|', patient.name, '|', confirmedDate, confirmedTime);

      // Update call request to completed
      await supabase.from('patient_call_requests').update({
        status: 'completed',
        appointment_id: appt.id,
        notes: JSON.stringify({
          ...(() => { try { return JSON.parse(callReq.notes || '{}'); } catch { return {}; } })(),
          booked: { date: confirmedDate, time: confirmedTime, reason: appointmentReason },
        }),
      }).eq('id', callReq.id);

      // In-app notification (ignore errors)
      void supabase.from('notifications').insert({
        user_id: patient.id,
        title: 'Appointment Confirmed',
        message: `Your appointment at ${hospitalName} on ${confirmedDate} at ${confirmedTime} is confirmed.`,
        type: 'appointment',
        read: false,
        metadata: { appointment_id: appt.id, date: confirmedDate, time_slot: confirmedTime },
      });

      // Confirmation email
      if (patient.email) {
        console.log('[PatientCallWebhook] Sending confirmation email to:', patient.email);
        emailService.sendAppointmentConfirmation(patient.email, {
          patientName: patient.name,
          doctorName,
          hospitalName,
          departmentName,
          date: confirmedDate,
          timeSlot: confirmedTime,
          appointmentId: appt.id,
          appointmentReason: appointmentReason || undefined,
        }).then(sent => {
          console.log('[PatientCallWebhook] Email sent:', sent);
        }).catch(err => {
          console.error('[PatientCallWebhook] Email FAILED:', err);
        });
      } else {
        console.warn('[PatientCallWebhook] No email on patient record — skipping email');
      }

      return NextResponse.json({
        success: true,
        appointment_id: appt.id,
        message: 'Appointment created and confirmation email sent.',
      });
    }

    // Patient did not confirm or no date — mark as failed
    const finalStatus = callStatus === 'failed' || callStatus === 'error' ? 'failed' : 'failed';
    console.log('[PatientCallWebhook] Patient did not confirm. Marking as failed. callOutcome:', callOutcome, '| patientConfirmed:', patientConfirmed, '| confirmedDate:', confirmedDate);

    await supabase.from('patient_call_requests').update({
      status: finalStatus,
      call_transcript: JSON.stringify(data.transcript || []).slice(0, 5000),
    }).eq('id', callReq.id);

    return NextResponse.json({ success: true, processed: 'no_confirmation', patientConfirmed, confirmedDate });

  } catch (err: unknown) {
    console.error('[PatientCallWebhook] FATAL ERROR:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
