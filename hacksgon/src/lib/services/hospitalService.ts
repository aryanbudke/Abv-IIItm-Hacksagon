import { supabase } from '../supabase/client';
import { Hospital, Department, Doctor } from '../types';

export class HospitalService {
  async getAllHospitals(): Promise<Hospital[]> {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }

  async getHospitalById(hospitalId: string): Promise<Hospital | null> {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', hospitalId)
      .single();

    if (error) return null;
    if (!data) return null;

    return {
      ...data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  async getDepartmentsByHospital(hospitalId: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('hospital_id', hospitalId);

    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      hospitalId: item.hospital_id,
      counterNumbers: item.counter_numbers,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }

  async getDoctorsByDepartment(departmentId: string): Promise<Doctor[]> {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('department_id', departmentId)
      .eq('is_on_leave', false)
      .order('rating', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      hospitalId: item.hospital_id,
      departmentId: item.department_id,
      isOnLeave: item.is_on_leave,
      leaveFrom: item.leave_from ? new Date(item.leave_from) : undefined,
      leaveTo: item.leave_to ? new Date(item.leave_to) : undefined,
      totalRatings: item.total_ratings,
      averageTreatmentTime: item.average_treatment_time,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }

  async getDoctorById(doctorId: string): Promise<Doctor | null> {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', doctorId)
      .single();

    if (error) return null;
    if (!data) return null;

    return {
      ...data,
      hospitalId: data.hospital_id,
      departmentId: data.department_id,
      isOnLeave: data.is_on_leave,
      leaveFrom: data.leave_from ? new Date(data.leave_from) : undefined,
      leaveTo: data.leave_to ? new Date(data.leave_to) : undefined,
      totalRatings: data.total_ratings,
      averageTreatmentTime: data.average_treatment_time,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  async searchDoctors(searchTerm: string, hospitalId?: string): Promise<Doctor[]> {
    let query = supabase
      .from('doctors')
      .select('*');

    if (hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }

    const { data, error } = await query;

    if (error) throw error;
    const doctors = (data || []).map(item => ({
      ...item,
      hospitalId: item.hospital_id,
      departmentId: item.department_id,
      isOnLeave: item.is_on_leave,
      leaveFrom: item.leave_from ? new Date(item.leave_from) : undefined,
      leaveTo: item.leave_to ? new Date(item.leave_to) : undefined,
      totalRatings: item.total_ratings,
      averageTreatmentTime: item.average_treatment_time,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));

    return doctors.filter(doctor =>
      doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
}

export const hospitalService = new HospitalService();
