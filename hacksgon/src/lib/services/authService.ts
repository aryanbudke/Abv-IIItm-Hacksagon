import { supabase } from '../supabase/client';
import { User } from '../types';
import { generatePatientId } from '../utils';

export class AuthService {
  async createOrUpdateUser(clerkUserId: string, userData: { name: string; email: string; mobile?: string }, additionalData?: Partial<User>): Promise<User> {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', clerkUserId)
      .single();

    if (existingUser && !fetchError) {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          ...additionalData,
          updated_at: new Date().toISOString()
        })
        .eq('id', clerkUserId)
        .select()
        .single();

      if (updateError) throw updateError;

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        patientId: updatedUser.patient_id,
        lastVisit: updatedUser.last_visit ? new Date(updatedUser.last_visit) : undefined,
        hospitalVisited: updatedUser.hospital_visited,
        treatmentType: updatedUser.treatment_type,
        // faceData: updatedUser.face_data, // MVP: Face verification disabled
        createdAt: new Date(updatedUser.created_at),
        updatedAt: new Date(updatedUser.updated_at)
      };
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: clerkUserId,
          name: userData.name,
          email: userData.email,
          mobile: userData.mobile || '',
          patient_id: generatePatientId(),
          ...additionalData
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        patientId: newUser.patient_id,
        lastVisit: newUser.last_visit ? new Date(newUser.last_visit) : undefined,
        hospitalVisited: newUser.hospital_visited,
        treatmentType: newUser.treatment_type,
        // faceData: newUser.face_data, // MVP: Face verification disabled
        createdAt: new Date(newUser.created_at),
        updatedAt: new Date(newUser.updated_at)
      };
    }
  }

  async getUserData(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      patientId: data.patient_id,
      lastVisit: data.last_visit ? new Date(data.last_visit) : undefined,
      hospitalVisited: data.hospital_visited,
      treatmentType: data.treatment_type,
      // faceData: data.face_data, // MVP: Face verification disabled
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export const authService = new AuthService();
