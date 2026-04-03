import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { 
      appointmentId, 
      reason,
      userId,
      notifyDoctor = true
    } = await request.json();

    if (!appointmentId || !userId) {
      return NextResponse.json(
        { error: 'Appointment ID and user ID are required' },
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

    // Removed the "less than 2 hours" restriction for testing purposes

    // Update appointment status to cancelled
    const { data: cancelledAppointment, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'User requested cancellation',
        previous_status: currentAppointment.status
      })
      .eq('id', appointmentId)
      .eq('patient_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Cancel appointment error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send notification to user
    await supabase
      .from('notifications')
      .insert({
        type: 'appointment',
        title: 'Appointment Cancelled',
        message: `Your appointment on ${new Date(currentAppointment.date).toLocaleDateString()} at ${currentAppointment.time_slot} has been cancelled`,
        user_id: userId,
        read: false,
        created_at: new Date().toISOString()
      });

    // Send notification to doctor if requested
    if (notifyDoctor) {
      await supabase
        .from('notifications')
        .insert({
          type: 'appointment',
          title: 'Appointment Cancelled',
          message: `Appointment with ${currentAppointment.patient_name} on ${new Date(currentAppointment.date).toLocaleDateString()} at ${currentAppointment.time_slot} has been cancelled`,
          user_id: currentAppointment.doctor_id,
          read: false,
          created_at: new Date().toISOString()
        });
    }

    // Check if there are people on waitlist for this slot
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('doctor_id', currentAppointment.doctor_id)
      .eq('date', currentAppointment.date)
      .eq('time_slot', currentAppointment.time_slot)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1);

    if (!waitlistError && waitlistEntries && waitlistEntries.length > 0) {
      const firstWaitlisted = waitlistEntries[0];

      // Offer the slot to first person on waitlist
      await supabase
        .from('appointment_waitlist')
        .update({
          status: 'offered',
          offered_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours to respond
        })
        .eq('id', firstWaitlisted.id);

      // Send notification to waitlisted user
      await supabase
        .from('notifications')
        .insert({
          type: 'general',
          title: 'Appointment Slot Available!',
          message: `An appointment slot is available for ${new Date(currentAppointment.date).toLocaleDateString()} at ${currentAppointment.time_slot}. Please confirm within 2 hours.`,
          user_id: firstWaitlisted.user_id,
          read: false,
          created_at: new Date().toISOString()
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment: cancelledAppointment,
        message: 'Appointment cancelled successfully',
        waitlistNotified: waitlistEntries && waitlistEntries.length > 0
      }
    });

  } catch (error: any) {
    console.error('Cancel appointment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
