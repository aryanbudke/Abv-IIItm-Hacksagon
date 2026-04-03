-- Enhanced Appointment Management Schema
-- Extends existing appointments table with reschedule, cancellation, and waitlist features

-- Enhanced appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_from JSONB; -- {date, time_slot}
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_from_waitlist UUID REFERENCES appointment_waitlist(id);

-- Appointment waitlist table
CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    doctor_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
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

-- Enhanced notifications for appointment management
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id VARCHAR(50); -- For user notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB; -- Store additional context

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_user_status ON appointments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date, time_slot);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_waitlist_doctor_date ON appointment_waitlist(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_status ON appointment_waitlist(user_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON appointment_waitlist(position);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notifications(appointment_id);

-- Add triggers for automatic waitlist cleanup
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

CREATE TRIGGER trigger_cleanup_waitlist
    AFTER INSERT ON appointment_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_expired_waitlist();

-- Add function to auto-notify waitlist when appointment is cancelled
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

CREATE TRIGGER trigger_notify_waitlist
    AFTER UPDATE ON appointments
    FOR EACH ROW
    WHEN (OLD.status != 'cancelled' AND NEW.status = 'cancelled')
    EXECUTE FUNCTION notify_waitlist_on_cancellation();

-- Insert sample waitlist entries for testing
INSERT INTO appointment_waitlist (user_id, user_name, user_email, doctor_id, date, time_slot, position, priority, reason)
VALUES 
    ('user-1', 'John Doe', 'john@example.com', 'doc-1', CURRENT_DATE + INTERVAL '1 day', '10:00 AM', 1, 'regular', 'Routine checkup'),
    ('user-2', 'Jane Smith', 'jane@example.com', 'doc-1', CURRENT_DATE + INTERVAL '1 day', '10:00 AM', 2, 'regular', 'Follow-up consultation')
ON CONFLICT DO NOTHING;
