-- Enhanced Queue Management System Schema
-- Extends existing schema with smart queue features

-- Enhanced queue table with smart features
ALTER TABLE queue ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'regular';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'general';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS location_id VARCHAR(50) DEFAULT 'default';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS counter_id VARCHAR(50);
ALTER TABLE queue ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE queue ADD COLUMN IF NOT EXISTS estimated_wait_time INTEGER DEFAULT 0;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS service_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS skip_reason TEXT;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS skip_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS transfer_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS transfer_from_counter VARCHAR(50);
ALTER TABLE queue ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE;

-- Enhanced counters table
ALTER TABLE counters ADD COLUMN IF NOT EXISTS location_id VARCHAR(50) DEFAULT 'default';
ALTER TABLE counters ADD COLUMN IF NOT EXISTS staff_id VARCHAR(50);
ALTER TABLE counters ADD COLUMN IF NOT EXISTS average_service_time INTEGER DEFAULT 5;
ALTER TABLE counters ADD COLUMN IF NOT EXISTS last_service_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE counters ADD COLUMN IF NOT EXISTS current_customer_id VARCHAR(50);

-- Queue configuration table for smart algorithms
CREATE TABLE IF NOT EXISTS queue_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id VARCHAR(50) NOT NULL,
    priority_weights JSONB NOT NULL DEFAULT '{"emergency": 100, "vip": 80, "elderly": 60, "regular": 40}',
    average_service_time INTEGER NOT NULL DEFAULT 5,
    max_queue_length INTEGER NOT NULL DEFAULT 50,
    overflow_threshold INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced notifications table with metadata
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- Service types table
CREATE TABLE IF NOT EXISTS service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    average_duration INTEGER NOT NULL, -- in minutes
    priority_required BOOLEAN DEFAULT FALSE,
    location_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations table for multi-location support
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    manager_id VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    operating_hours JSONB, -- Store opening/closing times
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs for audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- call_next, skip, transfer, open_counter, etc.
    customer_id VARCHAR(50),
    counter_id VARCHAR(50),
    details JSONB, -- Additional context
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer feedback system
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    service_type VARCHAR(100),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    wait_time_rating INTEGER CHECK (wait_time_rating >= 1 AND wait_time_rating <= 5),
    service_quality_rating INTEGER CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
    would_recommend BOOLEAN,
    location_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_id VARCHAR(50) DEFAULT 'default';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'consultation';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'regular';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled';

-- Documents upload system
CREATE TABLE IF NOT EXISTS customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- id_proof, insurance, medical_record, etc.
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    upload_status VARCHAR(20) DEFAULT 'uploaded', -- uploaded, processing, approved, rejected
    uploaded_by VARCHAR(50),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default queue configuration
INSERT INTO queue_config (location_id, priority_weights, average_service_time, max_queue_length, overflow_threshold)
VALUES (
    'default',
    '{"emergency": 100, "vip": 80, "elderly": 60, "regular": 40}',
    5,
    50,
    15
) ON CONFLICT (location_id) DO NOTHING;

-- Insert default service types
INSERT INTO service_types (name, description, average_duration, priority_required)
VALUES 
    ('General Consultation', 'General medical consultation', 10, FALSE),
    ('Emergency', 'Emergency medical attention', 15, TRUE),
    ('VIP Service', 'Priority service for VIP customers', 20, TRUE),
    ('Elderly Care', 'Specialized care for elderly patients', 25, TRUE),
    ('Pediatrics', 'Child medical care', 15, FALSE),
    ('Cardiology', 'Heart and cardiovascular care', 30, FALSE),
    ('Lab Tests', 'Laboratory testing services', 20, FALSE),
    ('Vaccination', 'Immunization services', 10, FALSE),
    ('Check-up', 'Routine health examination', 15, FALSE)
ON CONFLICT DO NOTHING;

-- Insert default location
INSERT INTO locations (id, name, address, city, state, country, phone, operating_hours)
VALUES (
    gen_random_uuid(),
    'Main Branch',
    '123 Healthcare Street',
    'New York',
    'NY',
    'USA',
    '+1-800-HEALTH',
    '{"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "18:00"}, "friday": {"open": "08:00", "close": "18:00"}, "saturday": {"open": "09:00", "close": "17:00"}, "sunday": {"open": "09:00", "close": "17:00"}}'
) ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(position);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_location ON queue(location_id);
CREATE INDEX IF NOT EXISTS idx_queue_counter ON queue(counter_id);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON queue(priority, position);
CREATE INDEX IF NOT EXISTS idx_activity_logs_staff ON activity_logs(staff_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at);
