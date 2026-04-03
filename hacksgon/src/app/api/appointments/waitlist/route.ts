import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET - Get waitlist for a specific slot
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const date = searchParams.get('date');
    const timeSlot = searchParams.get('timeSlot');

    if (!doctorId || !date || !timeSlot) {
      return NextResponse.json(
        { error: 'Doctor ID, date, and time slot are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('time_slot', timeSlot)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      console.error('Waitlist fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        waitlist: data || [],
        count: data?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Waitlist GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add to waitlist
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { 
      doctorId, 
      date, 
      timeSlot, 
      userId,
      userName,
      userEmail,
      reason,
      priority = 'regular'
    } = await request.json();

    if (!doctorId || !date || !timeSlot || !userId || !userName) {
      return NextResponse.json(
        { error: 'Doctor ID, date, time slot, user ID, and user name are required' },
        { status: 400 }
      );
    }

    // Check if already on waitlist for this slot
    const { data: existingEntry, error: checkError } = await supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('user_id', userId)
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('time_slot', timeSlot)
      .neq('status', 'expired')
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Waitlist check error:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingEntry) {
      return NextResponse.json(
        { error: 'You are already on the waitlist for this time slot' },
        { status: 409 }
      );
    }

    // Get current position in waitlist
    const { data: waitlistCount, error: countError } = await supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('time_slot', timeSlot)
      .eq('status', 'waiting');

    const position = waitlistCount ? waitlistCount.length + 1 : 1;

    // Add to waitlist
    const { data: waitlistEntry, error: insertError } = await supabase
      .from('appointment_waitlist')
      .insert({
        user_id: userId,
        user_name: userName,
        user_email: userEmail,
        doctor_id: doctorId,
        date,
        time_slot: timeSlot,
        position,
        priority,
        reason: reason || 'Requested appointment',
        status: 'waiting',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select()
      .single();

    if (insertError) {
      console.error('Waitlist insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Send notification to user
    await supabase
      .from('notifications')
      .insert({
        type: 'general',
        title: 'Added to Waitlist',
        message: `You are position ${position} on the waitlist for ${new Date(date).toLocaleDateString()} at ${timeSlot}`,
        user_id: userId,
        read: false,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      data: {
        waitlistEntry,
        position,
        message: `You are position ${position} on the waitlist`
      }
    });

  } catch (error: any) {
    console.error('Waitlist POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Accept waitlist offer
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { waitlistId, userId } = await request.json();

    if (!waitlistId || !userId) {
      return NextResponse.json(
        { error: 'Waitlist ID and user ID are required' },
        { status: 400 }
      );
    }

    // Get waitlist entry
    const { data: waitlistEntry, error: fetchError } = await supabase
      .from('appointment_waitlist')
      .select('*')
      .eq('id', waitlistId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Waitlist fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!waitlistEntry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found or unauthorized' },
        { status: 404 }
      );
    }

    if (waitlistEntry.status !== 'offered') {
      return NextResponse.json(
        { error: 'This waitlist offer is no longer available' },
        { status: 400 }
      );
    }

    // Check if offer has expired
    if (new Date(waitlistEntry.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Waitlist offer has expired' },
        { status: 400 }
      );
    }

    // Create appointment from waitlist
    const { data: newAppointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        patient_id: userId,
        patient_name: waitlistEntry.user_name,
        doctor_id: waitlistEntry.doctor_id,
        date: waitlistEntry.date,
        time_slot: waitlistEntry.time_slot,
        status: 'confirmed',
        created_from_waitlist: waitlistId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError);
      return NextResponse.json({ error: appointmentError.message }, { status: 500 });
    }

    // Update waitlist entry
    await supabase
      .from('appointment_waitlist')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        appointment_id: newAppointment.id
      })
      .eq('id', waitlistId);

    // Send confirmation notification
    await supabase
      .from('notifications')
      .insert({
        type: 'appointment',
        title: 'Appointment Confirmed!',
        message: `Your appointment has been confirmed for ${new Date(waitlistEntry.date).toLocaleDateString()} at ${waitlistEntry.time_slot}`,
        user_id: userId,
        read: false,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      data: {
        appointment: newAppointment,
        message: 'Appointment confirmed successfully from waitlist'
      }
    });

  } catch (error: any) {
    console.error('Waitlist accept error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
