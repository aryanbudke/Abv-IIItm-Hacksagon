import { supabase } from '../supabase/client';
import { QueueEntry, EmergencyQueue } from '../types';
import { generateTokenNumber } from '../utils';
import QRCode from 'qrcode';
import { fireEvent } from '@/lib/workflow/triggers';

export class QueueService {
  async addToQueue(data: Omit<QueueEntry, 'id' | 'tokenNumber' | 'qrCode' | 'createdAt' | 'updatedAt'>): Promise<QueueEntry> {
    const tokenNumber = generateTokenNumber(data.hospitalId, data.date instanceof Date ? data.date.toISOString() : data.date as string);
    
    // Calculate position in queue for this department
    const { count } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', data.departmentId)
      .eq('status', 'waiting');
    
    const position = (count || 0) + 1;
    
    // Calculate estimated wait time (position * average treatment time)
    const { data: doctors } = await supabase
      .from('doctors')
      .select('average_treatment_time')
      .eq('department_id', data.departmentId);
    
    const avgTreatmentTime = doctors && doctors.length > 0
      ? doctors.reduce((sum, doc) => sum + (doc.average_treatment_time || 15), 0) / doctors.length
      : 15;
    
    const estimatedWaitTime = Math.round(position * avgTreatmentTime);
    
    const qrData = JSON.stringify({
      tokenNumber,
      patientId: data.patientId,
      hospitalId: data.hospitalId,
      departmentId: data.departmentId,
      timestamp: new Date().toISOString()
    });
    
    const qrCode = await QRCode.toDataURL(qrData);
    
    const { data: insertedData, error } = await supabase
      .from('queue')
      .insert({
        token_number: tokenNumber,
        patient_id: data.patientId,
        patient_name: data.patientName,
        hospital_id: data.hospitalId,
        department_id: data.departmentId,
        doctor_id: data.doctorId || null,
        date: data.date.toISOString(),
        time: data.time.toISOString(),
        treatment_type: data.treatmentType,
        is_emergency: data.isEmergency,
        // face_embedding: data.faceEmbedding, // MVP: Face verification disabled
        qr_code: qrCode,
        status: 'waiting',
        position: position,
        estimated_wait_time: estimatedWaitTime
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: insertedData.id,
      tokenNumber,
      patientId: data.patientId,
      patientName: data.patientName,
      hospitalId: data.hospitalId,
      departmentId: data.departmentId,
      doctorId: data.doctorId,
      date: data.date,
      time: data.time,
      treatmentType: data.treatmentType,
      isEmergency: data.isEmergency,
      // faceEmbedding: data.faceEmbedding, // MVP: Face verification disabled
      qrCode,
      status: 'waiting',
      position: position,
      estimatedWaitTime: estimatedWaitTime,
      createdAt: new Date(insertedData.created_at),
      updatedAt: new Date(insertedData.updated_at)
    };
  }

  async addToEmergencyQueue(data: Omit<EmergencyQueue, 'id' | 'tokenNumber' | 'qrCode' | 'createdAt' | 'updatedAt'>): Promise<EmergencyQueue> {
    const tokenNumber = generateTokenNumber(data.hospitalId, new Date().toISOString());
    
    const qrData = JSON.stringify({
      tokenNumber,
      patientId: data.patientId,
      hospitalId: data.hospitalId,
      emergency: true,
      timestamp: new Date().toISOString()
    });
    
    const qrCode = await QRCode.toDataURL(qrData);
    
    const { data: insertedData, error } = await supabase
      .from('emergency_queue')
      .insert({
        token_number: tokenNumber,
        patient_id: data.patientId,
        patient_name: data.patientName,
        hospital_id: data.hospitalId,
        department_id: data.departmentId,
        emergency_type: data.emergencyType,
        severity: data.severity,
        qr_code: qrCode,
        status: 'waiting'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: insertedData.id,
      tokenNumber,
      patientId: data.patientId,
      patientName: data.patientName,
      hospitalId: data.hospitalId,
      departmentId: data.departmentId,
      emergencyType: data.emergencyType,
      severity: data.severity,
      qrCode,
      status: 'waiting',
      createdAt: new Date(insertedData.created_at),
      updatedAt: new Date(insertedData.updated_at)
    };
  }

  async getQueueByHospitalAndDepartment(hospitalId: string, departmentId: string): Promise<QueueEntry[]> {
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .eq('hospital_id', hospitalId)
      .eq('department_id', departmentId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      tokenNumber: item.token_number,
      patientId: item.patient_id,
      patientName: item.patient_name,
      hospitalId: item.hospital_id,
      departmentId: item.department_id,
      doctorId: item.doctor_id,
      date: new Date(item.date),
      time: new Date(item.time),
      treatmentType: item.treatment_type,
      isEmergency: item.is_emergency,
      // faceEmbedding: item.face_embedding, // MVP: Face verification disabled
      qrCode: item.qr_code,
      status: item.status,
      estimatedWaitTime: item.estimated_wait_time,
      position: item.position,
      counterNumber: item.counter_number,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }

  async updateQueueStatus(queueId: string, status: QueueEntry['status'], counterNumber?: number): Promise<void> {
    const { error } = await supabase
      .from('queue')
      .update({
        status,
        counter_number: counterNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId);
    
    if (error) throw error;
  }

  async getPatientPosition(queueId: string): Promise<number> {
    const { data: queueData, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .eq('id', queueId)
      .single();
    
    if (queueError || !queueData) return -1;
    
    const { count, error } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', queueData.hospital_id)
      .eq('department_id', queueData.department_id)
      .eq('status', 'waiting')
      .lt('created_at', queueData.created_at);
    
    if (error) return -1;
    return (count || 0) + 1;
  }

  subscribeToQueue(
    hospitalId: string, 
    departmentId: string, 
    callback: (queue: QueueEntry[]) => void
  ): () => void {
    const channel = supabase
      .channel('queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue',
          filter: `hospital_id=eq.${hospitalId},department_id=eq.${departmentId}`
        },
        async () => {
          const { data } = await supabase
            .from('queue')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('department_id', departmentId)
            .in('status', ['waiting', 'in-treatment'])
            .order('created_at', { ascending: true });
          
          const queue = (data || []).map(item => ({
            id: item.id,
            tokenNumber: item.token_number,
            patientId: item.patient_id,
            patientName: item.patient_name,
            hospitalId: item.hospital_id,
            departmentId: item.department_id,
            doctorId: item.doctor_id,
            date: new Date(item.date),
            time: new Date(item.time),
            treatmentType: item.treatment_type,
            isEmergency: item.is_emergency,
            // faceEmbedding: item.face_embedding, // MVP: Face verification disabled
            qrCode: item.qr_code,
            status: item.status,
            estimatedWaitTime: item.estimated_wait_time,
            position: item.position,
            counterNumber: item.counter_number,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
          }));
          
          callback(queue);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }

  async deleteQueueEntry(queueId: string): Promise<void> {
    const { error } = await supabase
      .from('queue')
      .delete()
      .eq('id', queueId);
    
    if (error) throw error;
  }
}

export const queueService = new QueueService();
