# hacksagon API Reference

This document outlines the core API endpoints and their primary functions.

---

## Appointment Management

### `POST /api/appointments`

Create a new patient appointment.

- **Body**: `{ patientId, doctorId, date, timeSlot, departmentId }`
- **Response**: Created appointment object.

### `GET /api/appointments`

Find or list appointments based on user role.

- **Parameters**: `userId`, `date` (optional).

### `POST /api/verify-otp`

Verify a patient's identity before booking or check-in.

- **Body**: `{ phone, otp }`

---

## Queue & Emergency

### `POST /api/queue`

Join a hospital department's live queue.

- **Body**: `{ patientId, departmentId, treatmentType, isEmergency }`
- **Response**: Token number, position, and estimated wait time.

### `GET /api/queue/live`

Get the real-time status of a department's waiting list.

### `POST /api/emergency-queue`

Instant high-priority entry for critical cases.

- **Body**: `{ patientId, severity, emergencyType }`

---

## Workflows & Automation

### `POST /api/workflows`

Define or update a reusable hospital automation workflow.

- **Body**: `{ name, hospitalId, nodes, edges }`

### `POST /api/workflow-executions`

Trigger a specific workflow manually or via event hook.

---

## AI & External Services

### `POST /api/elevenlabs`

Handle interaction with the ElevenLabs voice booking agent.

- **Endpoint**: Interface for voice session initialization and data parsing.

### `POST /api/face-verification`

Server-side validation for face embeddings (if using hybrid verification).

### `POST /api/send-otp`

Initiates SMS or Email OTP dispatch via Nodemailer or external provider.

---

## Authentication & Headers

- All requests (except public info) must include a valid Clerk Session Token in the `Authorization` header.
- The `x-supabase-role` may be used by the backend to handle RBAC-specific logic.
- Most routes respond in `application/json` format.
