export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  patientId: string;
  lastVisit?: Date;
  hospitalVisited?: string[];
  treatmentType?: string[];
  // faceData?: string; // MVP: Face verification disabled
  createdAt: Date;
  updatedAt: Date;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  departments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  description: string;
  floor?: string;
  counterNumbers: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  hospitalId: string;
  departmentId: string;
  specialization: string;
  qualification: string;
  experience: number;
  availability: DoctorAvailability[];
  isOnLeave: boolean;
  leaveFrom?: Date;
  leaveTo?: Date;
  averageTreatmentTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorAvailability {
  day: string;
  startTime: string;
  endTime: string;
  slots: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  date: Date;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  otpVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueEntry {
  id: string;
  tokenNumber: number;
  patientId: string;
  patientName: string;
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  date: Date;
  time: Date;
  treatmentType: string;
  isEmergency: boolean;
  // faceEmbedding?: number[]; // MVP: Face verification disabled
  chiefComplaint?: string;
  qrCode: string;
  status: 'waiting' | 'in-treatment' | 'completed' | 'cancelled';
  estimatedWaitTime?: number;
  position?: number;
  counterNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyQueue {
  id: string;
  tokenNumber: number;
  patientId: string;
  patientName: string;
  hospitalId: string;
  departmentId: string;
  emergencyType: string;
  severity: 'critical' | 'high' | 'medium';
  qrCode: string;
  status: 'waiting' | 'in-treatment' | 'completed';
  counterNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}



export interface HistoricalData {
  id: string;
  hospitalId: string;
  departmentId: string;
  date: Date;
  hour: number;
  patientCount: number;
  averageWaitTime: number;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'appointment' | 'queue' | 'emergency' | 'general';
  read: boolean;
  createdAt: Date;
}
