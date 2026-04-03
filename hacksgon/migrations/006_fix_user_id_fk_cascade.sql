-- Fix foreign key constraints on users.id to support ON UPDATE CASCADE
-- This allows ensure-user to update a user's ID when their Clerk ID changes

-- appointments
ALTER TABLE appointments
  DROP CONSTRAINT appointments_patient_id_fkey,
  ADD CONSTRAINT appointments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- queue
ALTER TABLE queue
  DROP CONSTRAINT queue_patient_id_fkey,
  ADD CONSTRAINT queue_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- emergency_queue
ALTER TABLE emergency_queue
  DROP CONSTRAINT emergency_queue_patient_id_fkey,
  ADD CONSTRAINT emergency_queue_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ratings
ALTER TABLE ratings
  DROP CONSTRAINT ratings_patient_id_fkey,
  ADD CONSTRAINT ratings_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- notifications
ALTER TABLE notifications
  DROP CONSTRAINT notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
