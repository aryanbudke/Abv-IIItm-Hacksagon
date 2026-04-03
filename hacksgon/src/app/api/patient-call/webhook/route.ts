import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/patient-call/webhook
// Handles ElevenLabs Server-side Tool calls
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('ElevenLabs Webhook received:', body);

    // ElevenLabs sends tool calls in a specific format
    // For simplicity, we'll implement a robust handler for "get_available_slots" and "confirm_booking"
    
    // Check if it's a tool call (this depends on how we define it in the initiation)
    // We will define it to hit this endpoint with { tool: string, parameters: any }
    const { tool, parameters } = body;
    const supabase = createServerClient();

    if (tool === 'get_available_slots') {
      const { doctor_id, date } = parameters;
      const { data: booked } = await supabase
        .from('appointments')
        .select('time_slot')
        .eq('doctor_id', doctor_id)
        .eq('date', date)
        .neq('status', 'cancelled');

      const allSlots = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
      const bookedSet = new Set((booked || []).map(b => b.time_slot));
      const available = allSlots.filter(s => !bookedSet.has(s));

      return NextResponse.json({ available_slots: available });
    }

    if (tool === 'confirm_booking') {
      const { call_request_id, doctor_id, date, time_slot } = parameters;

      // 1. Fetch the original call request to get patient info
      const { data: callReq, error: fetchErr } = await supabase
        .from('patient_call_requests')
        .select('*')
        .eq('id', call_request_id)
        .single();

      if (fetchErr || !callReq) {
        return NextResponse.json({ error: 'Call request not found' }, { status: 404 });
      }

      // 2. Create the appointment
      const { data: appt, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          patient_id: callReq.patient_id,
          doctor_id: doctor_id || callReq.doctor_id,
          hospital_id: callReq.hospital_id,
          department_id: callReq.department_id,
          date: date,
          time_slot: time_slot,
          status: 'confirmed' // Pre-confirmed since they spoke to AI
        })
        .select()
        .single();

      if (apptErr) {
        return NextResponse.json({ error: `Booking failed: ${apptErr.message}` }, { status: 500 });
      }

      // 3. Update call request
      await supabase
        .from('patient_call_requests')
        .update({
          status: 'completed',
          appointment_id: appt.id,
          notes: `Booked via AI call on ${date} at ${time_slot}`
        })
        .eq('id', call_request_id);

      return NextResponse.json({ success: true, appointment_id: appt.id });
    }

    return NextResponse.json({ error: 'Unknown tool' }, { status: 400 });
  } catch (err: any) {
    console.error('ElevenLabs Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
