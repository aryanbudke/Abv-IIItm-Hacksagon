import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { hospitalId, patientName, userId, userEmail } = await request.json();

    if (!hospitalId) {
      return NextResponse.json(
        { error: 'Hospital is required' },
        { status: 400 }
      );
    }

    // Find Emergency department for this hospital
    const { data: emergencyDept, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('hospital_id', hospitalId)
      .eq('name', 'Emergency')
      .single();

    if (deptError || !emergencyDept) {
      return NextResponse.json(
        { error: 'Emergency department not found for this hospital' },
        { status: 404 }
      );
    }

    // Auto-assign available emergency doctor
    const { data: emergencyDoctors, error: doctorError } = await supabase
      .from('doctors')
      .select('id, name')
      .eq('hospital_id', hospitalId)
      .eq('department_id', emergencyDept.id)
      .eq('is_on_leave', false)
      .limit(1);

    const assignedDoctor = emergencyDoctors && emergencyDoctors.length > 0 ? emergencyDoctors[0] : null;

    // Ensure user exists in database
    let finalUserId = userId;
    if (userId && userEmail) {
      try {
        const patientId = `PAT${Date.now().toString().slice(-6)}`;
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            name: patientName || 'Emergency Patient',
            email: userEmail,
            patient_id: patientId,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        if (userError) {
          console.error('User upsert error:', userError);
          // Continue with emergency_user as fallback
        }
      } catch (error) {
        console.error('Error creating user:', error);
        // Continue with emergency_user as fallback
      }
    }

    // Generate emergency token (always starts with E for emergency)
    const tokenNumber = Math.floor(Math.random() * 9000) + 1000;
    
    // Create QR code for emergency
    const qrData = JSON.stringify({
      tokenNumber: `E${tokenNumber}`,
      isEmergency: true,
      priority: 'critical',
      timestamp: new Date().toISOString()
    });
    
    const qrCode = await QRCode.toDataURL(qrData);

    // Get hospital name
    const { data: hospitalData } = await supabase
      .from('hospitals')
      .select('name')
      .eq('id', hospitalId)
      .single();

    // Reorder existing queue in Emergency department - push all waiting patients down by 1 position
    const { data: waitingPatients } = await supabase
      .from('queue')
      .select('id, position')
      .eq('department_id', emergencyDept.id)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    // Update positions for existing patients
    if (waitingPatients && waitingPatients.length > 0) {
      for (const patient of waitingPatients) {
        await supabase
          .from('queue')
          .update({ position: (patient.position || 0) + 1 })
          .eq('id', patient.id);
      }
    }

    // Add to regular queue with emergency flag and position 1
    const { data, error } = await supabase
      .from('queue')
      .insert({
        token_number: tokenNumber,
        patient_id: userId || 'emergency_user',
        patient_name: patientName || 'Emergency Patient',
        hospital_id: hospitalId,
        department_id: emergencyDept.id,
        doctor_id: assignedDoctor?.id || null,
        date: new Date().toISOString(),
        time: new Date().toISOString(),
        treatment_type: 'Emergency',
        is_emergency: true,
        qr_code: qrCode,
        status: 'waiting',
        position: 1,
        estimated_wait_time: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Emergency queue insert error:', error);
      throw error;
    }

    // Send emergency notification to admin
    await supabase
      .from('notifications')
      .insert({
        type: 'emergency',
        title: '🚨 EMERGENCY CASE',
        message: `Emergency patient "${patientName || 'Unknown'}" at ${hospitalData?.name || 'Hospital'} - Emergency Department. Immediate attention required!`,
        read: false,
        created_at: new Date().toISOString()
      });

    // Send notification to assigned emergency doctor
    if (assignedDoctor) {
      await supabase
        .from('notifications')
        .insert({
          type: 'emergency',
          title: '🚨 EMERGENCY PATIENT ASSIGNED',
          message: `Emergency patient "${patientName || 'Unknown'}" has been assigned to you at ${hospitalData?.name || 'Hospital'}. Immediate attention required!`,
          read: false,
          created_at: new Date().toISOString(),
          metadata: {
            doctorId: assignedDoctor.id,
            patientName: patientName,
            tokenNumber: tokenNumber
          }
        });
    }

    return NextResponse.json({
      id: data.id,
      token_number: tokenNumber,
      qr_code: qrCode,
      patient_name: patientName || 'Emergency Patient',
      hospitalName: hospitalData?.name || 'Hospital',
      departmentName: 'Emergency',
      doctorName: assignedDoctor?.name || 'Emergency Team',
      estimatedWaitTime: 0,
      position: 1,
      isEmergency: true
    });

  } catch (error) {
    console.error('Emergency queue error:', error);
    return NextResponse.json(
      { error: 'Failed to create emergency queue entry' },
      { status: 500 }
    );
  }
}
