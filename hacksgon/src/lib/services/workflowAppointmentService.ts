import { emailService } from '@/lib/services/emailService';
import { createServerClient } from '@/lib/supabase/server';

type SupabaseClient = ReturnType<typeof createServerClient>;

interface CreateWorkflowAppointmentParams {
  supabase?: SupabaseClient;
  patientId: string;
  doctorId?: string | null;
  hospitalId?: string | null;
  date: string;
  timeSlot: string;
  workflowName?: string;
  executionId?: string;
  source: 'workflow_node' | 'call_confirmation';
}

interface WorkflowAppointmentResult {
  appointmentId: string | null;
  patientEmailSent: boolean;
  patientEmail: string | null;
  doctorName: string;
  hospitalName: string;
  departmentName: string;
}

export async function createWorkflowAppointment(
  params: CreateWorkflowAppointmentParams
): Promise<WorkflowAppointmentResult> {
  const supabase = params.supabase || createServerClient();

  const { data: patient, error: patientError } = await supabase
    .from('users')
    .select('id,name,email')
    .eq('id', params.patientId)
    .single();

  if (patientError || !patient) {
    throw new Error('Could not load patient details for appointment creation');
  }

  let doctorName = '';
  let hospitalId = params.hospitalId || null;
  let departmentId: string | null = null;
  let departmentName = 'General';

  if (params.doctorId) {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('id,name,hospital_id,department_id')
      .eq('id', params.doctorId)
      .single();

    if (doctor) {
      doctorName = doctor.name || '';
      hospitalId = hospitalId || doctor.hospital_id || null;
      departmentId = doctor.department_id || null;
    }
  }

  if (!hospitalId) {
    throw new Error('Could not determine hospital for appointment creation');
  }

  const { data: hospital } = await supabase
    .from('hospitals')
    .select('name')
    .eq('id', hospitalId)
    .single();

  const hospitalName = hospital?.name || 'Hospital';

  if (departmentId) {
    const { data: department } = await supabase
      .from('departments')
      .select('name')
      .eq('id', departmentId)
      .single();
    departmentName = department?.name || departmentName;
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      patient_id: patient.id,
      patient_name: patient.name,
      hospital_id: hospitalId,
      doctor_id: params.doctorId || null,
      department_id: departmentId,
      doctor_name: doctorName || null,
      hospital_name: hospitalName,
      department_name: departmentName,
      date: params.date,
      time_slot: params.timeSlot,
      status: 'confirmed',
      otp_verified: true,
    })
    .select('id')
    .single();

  if (appointmentError) {
    throw appointmentError;
  }

  const notificationMetadata = {
    appointment_id: appointment?.id || null,
    date: params.date,
    time_slot: params.timeSlot,
    execution_id: params.executionId || null,
    source: params.source,
  };

  await supabase.from('notifications').insert({
    user_id: patient.id,
    title: 'Appointment Confirmed',
    message: `Your appointment has been scheduled for ${params.date} at ${params.timeSlot}.`,
    type: 'appointment',
    read: false,
    metadata: notificationMetadata,
  });

  if (params.doctorId) {
    await supabase.from('notifications').insert({
      user_id: params.doctorId,
      title: params.source === 'call_confirmation' ? 'New Appointment via Workflow' : 'Appointment Scheduled',
      message:
        params.source === 'call_confirmation'
          ? `${patient.name} confirmed an appointment for ${params.date} at ${params.timeSlot}.`
          : `${patient.name} has been scheduled for ${params.date} at ${params.timeSlot}.`,
      type: 'appointment',
      read: false,
      metadata: notificationMetadata,
    });
  }

  let patientEmailSent = false;
  if (patient.email) {
    patientEmailSent = await emailService.sendAppointmentConfirmation(patient.email, {
      patientName: patient.name || 'Patient',
      doctorName: doctorName || 'Assigned Doctor',
      hospitalName,
      departmentName,
      date: params.date,
      timeSlot: params.timeSlot,
      appointmentId: appointment?.id || '',
    });
  }

  return {
    appointmentId: appointment?.id || null,
    patientEmailSent,
    patientEmail: patient.email || null,
    doctorName,
    hospitalName,
    departmentName,
  };
}
