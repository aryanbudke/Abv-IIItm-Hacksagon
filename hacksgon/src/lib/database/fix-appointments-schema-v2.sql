-- Fix appointments table to support enhanced features - Supabase Compatible Version
-- Add missing columns for reschedule, cancel, and waitlist functionality

-- Add columns for enhanced appointment management
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_name TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_from JSONB; -- {date, time_slot}
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_from_waitlist UUID REFERENCES appointment_waitlist(id);

-- Update status check constraint to include new statuses
-- Note: Supabase doesn't support DROP CONSTRAINT IF EXISTS, so we handle differently
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint doesn't exist, which is fine
END;
$$;

-- Add new constraint
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'));

-- Create appointment_waitlist table if it doesn't exist
CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    doctor_id UUID NOT NULL,
    date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    position INTEGER NOT NULL,
    priority VARCHAR(20) DEFAULT 'regular',
    reason TEXT,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, offered, accepted, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    offered_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    appointment_id UUID REFERENCES appointments(id) -- When waitlist is converted to appointment
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_user_status ON appointments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date, time_slot);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_waitlist_doctor_date ON appointment_waitlist(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_status ON appointment_waitlist(user_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON appointment_waitlist(position);

-- Function to update doctor_name, hospital_name, department_name when appointment is created/updated
CREATE OR REPLACE FUNCTION update_appointment_details()
RETURNS TRIGGER AS $$
BEGIN
    -- Update doctor name
    NEW.doctor_name = (SELECT name FROM doctors WHERE id = NEW.doctor_id);
    
    -- Update hospital name  
    NEW.hospital_name = (SELECT name FROM hospitals WHERE id = NEW.hospital_id);
    
    -- Update department name
    NEW.department_name = (SELECT name FROM departments WHERE id = NEW.department_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically populate name fields
-- Note: Supabase doesn't support DROP TRIGGER IF EXISTS, so we create with a unique name
CREATE TRIGGER trigger_update_appointment_details_unique
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_details();

-- Function to notify waitlist when appointment is cancelled
CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify first person on waitlist for this slot
    UPDATE appointment_waitlist 
    SET status = 'offered',
        offered_at = NOW(),
        expires_at = NOW() + INTERVAL '2 hours'
    WHERE doctor_id = NEW.doctor_id
    AND date = NEW.date
    AND time_slot = NEW.time_slot
    AND status = 'waiting'
    ORDER BY position ASC
    LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for waitlist notification
CREATE TRIGGER trigger_notify_waitlist
    AFTER UPDATE ON appointments
    FOR EACH ROW
    WHEN (OLD.status != 'cancelled' AND NEW.status = 'cancelled')
    EXECUTE FUNCTION notify_waitlist_on_cancellation();

-- Function to clean up expired waitlist entries
CREATE OR REPLACE FUNCTION cleanup_expired_waitlist()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE appointment_waitlist 
    SET status = 'expired' 
    WHERE status IN ('waiting', 'offered') 
    AND expires_at < NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cleanup
CREATE TRIGGER trigger_cleanup_waitlist
    AFTER INSERT ON appointment_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_expired_waitlist();

-- Update existing appointments with missing data
UPDATE appointments 
SET 
    doctor_name = COALESCE(doctor_name, (SELECT name FROM doctors WHERE id = appointments.doctor_id)),
    hospital_name = COALESCE(hospital_name, (SELECT name FROM hospitals WHERE id = appointments.hospital_id)),
    department_name = COALESCE(department_name, (SELECT name FROM departments WHERE id = appointments.department_id))
WHERE doctor_name IS NULL OR hospital_name IS NULL OR department_name IS NULL;
