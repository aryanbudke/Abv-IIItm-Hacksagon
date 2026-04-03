import { supabase } from '../supabase/client';
import { Appointment } from '../types';
import nodemailer from 'nodemailer';

export class AppointmentService {
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter() {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    return this.transporter;
  }

  async createAppointment(data: Omit<Appointment, 'id' | 'status' | 'otpVerified' | 'createdAt' | 'updatedAt'>): Promise<Appointment> {
    const { data: insertedData, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: data.patientId,
        patient_name: data.patientName,
        hospital_id: data.hospitalId,
        department_id: data.departmentId,
        doctor_id: data.doctorId,
        date: data.date.toISOString(),
        time_slot: data.timeSlot,
        status: 'pending',
        otp_verified: false
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: insertedData.id,
      patientId: data.patientId,
      patientName: data.patientName,
      hospitalId: data.hospitalId,
      departmentId: data.departmentId,
      doctorId: data.doctorId,
      date: data.date,
      timeSlot: data.timeSlot,
      status: 'pending',
      otpVerified: false,
      createdAt: new Date(insertedData.created_at),
      updatedAt: new Date(insertedData.updated_at)
    };
  }

  async sendOTPEmail(email: string, otp: string, appointmentDetails: any): Promise<void> {
    const transporter = await this.getTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Appointment Confirmation OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Appointment Confirmation</h2>
          <p>Your OTP for appointment confirmation is:</p>
          <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p>This OTP is valid for 10 minutes.</p>
          <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Hospital:</strong> ${appointmentDetails.hospitalName}</p>
          <p><strong>Department:</strong> ${appointmentDetails.departmentName}</p>
          <p><strong>Doctor:</strong> ${appointmentDetails.doctorName}</p>
          <p><strong>Date:</strong> ${appointmentDetails.date}</p>
          <p><strong>Time:</strong> ${appointmentDetails.timeSlot}</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  }

  async verifyAndConfirmAppointment(appointmentId: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({
        otp_verified: true,
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId);

    if (error) throw error;
  }

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      patientId: item.patient_id,
      patientName: item.patient_name,
      hospitalId: item.hospital_id,
      departmentId: item.department_id,
      doctorId: item.doctor_id,
      date: new Date(item.date),
      timeSlot: item.time_slot,
      status: item.status,
      otpVerified: item.otp_verified,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }

  async getAppointmentsByDoctor(doctorId: string, date: Date): Promise<Appointment[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .gte('date', startOfDay.toISOString())
      .lte('date', endOfDay.toISOString())
      .in('status', ['confirmed', 'pending']);

    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      patientId: item.patient_id,
      patientName: item.patient_name,
      hospitalId: item.hospital_id,
      departmentId: item.department_id,
      doctorId: item.doctor_id,
      date: new Date(item.date),
      timeSlot: item.time_slot,
      status: item.status,
      otpVerified: item.otp_verified,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  }

  async cancelAppointment(appointmentId: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId);

    if (error) throw error;
  }
}

export const appointmentService = new AppointmentService();
