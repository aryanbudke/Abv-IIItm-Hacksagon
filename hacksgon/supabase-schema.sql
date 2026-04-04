-- Hospital Queue Management System - Supabase Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT,
  patient_id TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  last_visit TIMESTAMPTZ,
  hospital_visited TEXT[],
  treatment_type TEXT[],
  face_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hospitals table
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  departments TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  floor TEXT,
  counter_numbers INTEGER[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors table
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  specialization TEXT NOT NULL,
  qualification TEXT NOT NULL,
  experience INTEGER NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  availability JSONB,
  is_on_leave BOOLEAN DEFAULT FALSE,
  leave_from TIMESTAMPTZ,
  leave_to TIMESTAMPTZ,
  average_treatment_time INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending',
  otp_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue table
CREATE TABLE queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_number INTEGER NOT NULL,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  treatment_type TEXT NOT NULL,
  is_emergency BOOLEAN DEFAULT FALSE,
  face_embedding DECIMAL[],
  qr_code TEXT NOT NULL,
  status TEXT CHECK (status IN ('waiting', 'in-treatment', 'completed', 'cancelled')) DEFAULT 'waiting',
  estimated_wait_time INTEGER,
  position INTEGER,
  counter_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency Queue table
CREATE TABLE emergency_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_number INTEGER NOT NULL,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  emergency_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium')) NOT NULL,
  qr_code TEXT NOT NULL,
  status TEXT CHECK (status IN ('waiting', 'in-treatment', 'completed')) DEFAULT 'waiting',
  counter_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback TEXT,
  treatment_success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical Data table
CREATE TABLE historical_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER CHECK (hour >= 0 AND hour <= 23) NOT NULL,
  patient_count INTEGER DEFAULT 0,
  average_wait_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('appointment', 'queue', 'emergency', 'general')) NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_patient_id ON users(patient_id);
CREATE INDEX idx_departments_hospital_id ON departments(hospital_id);
CREATE INDEX idx_doctors_hospital_id ON doctors(hospital_id);
CREATE INDEX idx_doctors_department_id ON doctors(department_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_queue_hospital_department ON queue(hospital_id, department_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_created_at ON queue(created_at);
CREATE INDEX idx_emergency_queue_hospital ON emergency_queue(hospital_id);
CREATE INDEX idx_ratings_doctor_id ON ratings(doctor_id);
CREATE INDEX idx_historical_data_hospital_dept ON historical_data(hospital_id, department_id, date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Users can view their own appointments
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (auth.uid()::text = patient_id);

-- Users can create their own appointments
CREATE POLICY "Users can create appointments" ON appointments
  FOR INSERT WITH CHECK (auth.uid()::text = patient_id);

-- Users can view their own queue entries
CREATE POLICY "Users can view own queue entries" ON queue
  FOR SELECT USING (auth.uid()::text = patient_id);

-- Users can create their own queue entries
CREATE POLICY "Users can create queue entries" ON queue
  FOR INSERT WITH CHECK (auth.uid()::text = patient_id);

-- Users can view their own emergency queue entries
CREATE POLICY "Users can view own emergency entries" ON emergency_queue
  FOR SELECT USING (auth.uid()::text = patient_id);

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id);

-- Public tables (readable by all authenticated users)
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospitals are viewable by authenticated users" ON hospitals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Departments are viewable by authenticated users" ON departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Doctors are viewable by authenticated users" ON doctors
  FOR SELECT TO authenticated USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_updated_at BEFORE UPDATE ON queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_queue_updated_at BEFORE UPDATE ON emergency_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
