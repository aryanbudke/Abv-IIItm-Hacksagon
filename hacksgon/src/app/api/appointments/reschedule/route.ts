import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { 
      appointmentId, 
      newDate, 
      newTimeSlot, 
      reason,
      userId 
    } = await request.json();

    if (!appointmentId || !newDate || !newTimeSlot || !userId) {
      return NextResponse.json(
        { error: 'Appointment ID, new date, new time slot, and user ID are required' },
        { status: 400 }
      );
    }

    // Get current appointment
    const { data: currentAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('patient_id', userId)
      .single();

    if (fetchError) {
      console.error('Fetch appointment error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!currentAppointment) {
      return NextResponse.json(
        { error: 'Appointment not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if new slot is available
    const { data: existingAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', currentAppointment.doctor_id)
      .eq('date', newDate)
      .eq('time_slot', newTimeSlot)
      .neq('status', 'cancelled')
      .neq('status', 'completed');

    if (checkError) {
      console.error('Slot availability check error:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingAppointments && existingAppointments.length > 0) {
      return NextResponse.json(
        { error: 'Selected time slot is not available' },
        { status: 409 }
      );
    }

    // Update appointment with new details
    const { data: updatedAppointment, error: updateError } = await supabase
      .from('appointments')
      .update({
        date: newDate,
        time_slot: newTimeSlot,
        status: 'confirmed',
        rescheduled_at: new Date().toISOString(),
        rescheduled_from: {
          date: currentAppointment.date,
          time_slot: currentAppointment.time_slot
        },
        reschedule_reason: reason || 'User requested reschedule',
        previous_status: currentAppointment.status
      })
      .eq('id', appointmentId)
      .eq('patient_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Reschedule error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send notification to user
    await supabase
      .from('notifications')
      .insert({
        type: 'appointment',
        title: 'Appointment Rescheduled',
        message: `Your appointment has been rescheduled to ${new Date(newDate).toLocaleDateString()} at ${newTimeSlot}`,
        user_id: userId,
        read: false,
        created_at: new Date().toISOString()
      });

    // Send notification to doctor
    await supabase
      .from('notifications')
      .insert({
        type: 'appointment',
        title: 'Appointment Rescheduled',
        message: `Patient ${currentAppointment.patient_name} rescheduled appointment to ${new Date(newDate).toLocaleDateString()} at ${newTimeSlot}`,
        user_id: currentAppointment.doctor_id,
        read: false,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      data: {
        appointment: updatedAppointment,
        message: 'Appointment rescheduled successfully'
      }
    });

  } catch (error: any) {
    console.error('Reschedule appointment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
