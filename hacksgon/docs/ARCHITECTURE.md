# hacksagon Architecture & Design

This document covers the high-level design and technical implementation details for hacksagon's core features.

---

## Autonomous Workflow Engine

The Workflow Engine is a custom-built, node-based automation system that handles hospital administrative logic.

### Core Concepts:
- **Triggers**: Events that start a workflow (e.g., "New Appointment", "Patient Arrival", "Emergency Triggered").
- **Nodes**: Atomic units of logic (e.g., "Check Availability", "Send SMS", "Re-route to Department").
- **Edges**: Path-connecting nodes based on conditional results.

### Technical Implementation:
- **Engine Logic**: `src/lib/workflow/engine.ts`
- **Node Catalogue**: `src/lib/workflow/nodeCatalogue.ts`
- **Frontend**: Built with React Flow (XYFlow) for interactive node-based visualization and editing.

---

## AI & Machine Learning Layers

hacksagon leverages AI to improve patient experience and operational efficiency.

### 1. Voice AI Booking (ElevenLabs)
Traditional booking systems are replaced or supplemented by an AI agent that:
- Conducts natural language voice conversations.
- Parses patient intent (department, specialist, date).
- Automatically creates or updates entries in Supabase via edge functions.
- **Service**: `src/lib/services/elevenLabsService.ts`

### 2. Wait-Time Prediction
The `WaitTimePredictor` and `CrowdPredictor` modules use historical data and current queue length to:
- Estimate patient wait times based on historical averages and live trends.
- Predict hourly crowd density in different hospital floors.
- **Logic**: `src/lib/ai/waitTimePredictor.ts`

### 3. Face Identification (Biometric Verification)
For streamlined check-ins, the system uses TensorFlow.js and Face-API.js to:
- Generate face descriptors (128-dimensional embeddings) for patients.
- Compare descriptors using Euclidean distance logic.
- Verify identities against stored data using a configurable similarity threshold.
- **Logic**: `src/lib/face/faceVerification.ts`

---

## Performance & Scalability

### Real-time Sync
The project utilizes Supabase Realtime to ensure that:
- Patient positions in the digital waiting room are updated instantly.
- Admin dashboards reflect new arrivals without manual refreshes.
- Emergency triggers alert all staff within milliseconds.

### Mobile-First Design
Using Tailwind CSS v4 and Framer Motion, the entire UI is optimized for:
- One-handed mobile usage for patient interactions.
- High-efficiency desktop interaction for staff components.
- Visual feedback through transitions during state changes (e.g., estimated time updates).

---

## Security Architecture

### Role-Based Access Control (RBAC)
- **Patient**: Can manage their own profile, book appointments, and view their place in the queue.
- **Staff/Doctor**: Can view patient details, update queue status, and manage department traffic.
- **Admin**: Can design workflows, manage hospital resources, and view global analytics.

### Data Privacy
- All PHI (Protected Health Information) is secured via Clerk Authentication and Supabase Row Level Security (RLS).
- Face descriptors are stored as numerical arrays, which cannot be reconstructed back into an image.
