-- Sample Data for Hospital Queue Management System
-- Run this AFTER running supabase-schema.sql

-- Insert Hospitals
-- INSERT INTO hospitals (name, address, city, state, pincode, phone, email, departments) VALUES (...);

-- Insert Departments
-- INSERT INTO departments (hospital_id, name, description, floor, counter_numbers) VALUES (...);

-- Insert Doctors
-- INSERT INTO doctors (name, email, phone, hospital_id, department_id, specialization, qualification, experience, availability, average_treatment_time) VALUES (...);

-- Verify the data
SELECT 'Hospitals inserted:' as info, COUNT(*) as count FROM hospitals;
SELECT 'Departments inserted:' as info, COUNT(*) as count FROM departments;
SELECT 'Doctors inserted:' as info, COUNT(*) as count FROM doctors;
