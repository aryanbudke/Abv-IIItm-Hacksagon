# Role-Based Access Control (RBAC) — Detailed Flow

## Overview

This project does **not** use a traditional RBAC system with explicit roles/permissions tables. Instead, it uses a combination of:

- **Clerk** for authentication (JWTs, session management)
- **Supabase Row Level Security (RLS)** for data-layer authorization
- **Email-based role inference** for the Doctor role
- **Convention-based access** for the Admin role
- **Service Role Key** to bypass RLS for backend admin operations

---

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `@clerk/nextjs` | `^7.0.2` | Authentication provider — JWTs, session, sign-in/sign-up UI |
| `@supabase/supabase-js` | `^2.49.4` | Database client with RLS support |
| `@supabase/ssr` | `^0.6.1` | Server-side Supabase client (for Next.js SSR/API routes) |

Clerk handles **who you are**. Supabase RLS handles **what you can see**. The service role key grants **admin-level bypass**.

---

## The Three Implicit Roles

There is no `roles` table. Roles are determined at runtime:

| Role | How Determined | Where Enforced |
|------|---------------|----------------|
| **Patient** | Any authenticated Clerk user with a `patient_id` in `users` table | RLS policies (`patient_id = auth.uid()`) |
| **Doctor** | Authenticated user whose Clerk email matches a row in `doctors` table | Application layer (`/src/app/doctor/page.tsx`) |
| **Admin** | Authenticated user who navigates to `/admin/*` | Convention only — no DB check |

---

## Database Schema for Role-Related Tables

### `users` table (`supabase-schema.sql`)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,        -- Clerk user ID (auth.uid())
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT,
  patient_id TEXT UNIQUE,     -- Generated on registration → identifies "Patient" role
  hospital_visited TEXT[],
  treatment_type TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `doctors` table (`supabase-schema.sql`)
```sql
CREATE TABLE doctors (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,        -- Matched against Clerk email → identifies "Doctor" role
  phone TEXT NOT NULL,
  hospital_id UUID,
  department_id UUID,
  specialization TEXT,
  qualification TEXT,
  experience INTEGER,
  rating DECIMAL(3,2),
  is_on_leave BOOLEAN DEFAULT FALSE,
  average_treatment_time INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `hospitals` table (extended via `migrations/001_extend_hospitals.sql`)
```sql
ALTER TABLE hospitals ADD COLUMN hospital_type TEXT;   -- government, private, clinic, etc.
ALTER TABLE hospitals ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE hospitals ADD COLUMN license_number TEXT;
ALTER TABLE hospitals ADD COLUMN license_expiry DATE;
ALTER TABLE hospitals ADD COLUMN license_document_url TEXT;
```

---

## Authentication Flow (Clerk)

```
User visits any protected route
          ↓
middleware.ts intercepts request
          ↓
clerkMiddleware() verifies JWT
          ↓
Public routes pass through:
  /  →  landing page
  /sign-in  /sign-up  →  auth pages
  /api/webhooks  →  Clerk webhooks
          ↓
All other routes → auth.protect()
  If no valid JWT → redirect to /sign-in
  If valid JWT → request continues
```

**`middleware.ts`**:
```typescript
export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const publicRoutes = ['/', '/sign-in', '/sign-up', '/api/webhooks'];
  if (!publicRoutes.some(r => pathname.startsWith(r))) {
    await auth.protect();
  }
});
```

---

## Supabase Clients — Two Levels of Access

### Client-Side (`src/lib/supabase/client.ts`)
```typescript
createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   // Respects RLS
)
```
- Used in browser/React components
- Subject to all RLS policies
- Can only see data the authenticated user is allowed to see

### Server-Side (`src/lib/supabase/server.ts`)
```typescript
createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY        // Bypasses RLS entirely
)
```
- Used in Next.js API routes and server components
- The service role key grants full database access
- This is how admin operations work — no explicit role check, just service key

---

## Row Level Security (RLS) Policies

### Patient Data Isolation (`supabase-schema.sql` lines 179–230)
```sql
-- Patient can only read their own user record
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id);

-- Patient can only see their own appointments
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (auth.uid()::text = patient_id);

-- Patient can only see their own queue entries
CREATE POLICY "Users can view own queue entries" ON queue
  FOR SELECT USING (auth.uid()::text = patient_id);

-- Patient can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id);
```

### Public Read Access (authenticated users only)
```sql
CREATE POLICY "Hospitals are viewable by authenticated users" ON hospitals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Departments are viewable by authenticated users" ON departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Doctors are viewable by authenticated users" ON doctors
  FOR SELECT TO authenticated USING (true);
```

### Admin Full Access (`migrations/002_admin_rls_policies.sql`)
```sql
-- These apply when accessed via the service role key (bypasses RLS)
CREATE POLICY "Admins can manage hospitals" ON hospitals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage doctors" ON doctors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL USING (true) WITH CHECK (true);
```

---

## Role-Based Route Flows

### Patient Flow

```
User signs up → Clerk creates account
        ↓
POST /api/ensure-user called (Clerk webhook)
        ↓
AuthService.createOrUpdateUser() runs
        ↓
Row inserted in users table with generated patient_id
        ↓
User visits /dashboard
        ↓
useUser() from Clerk → gets userId
        ↓
Supabase query: SELECT * FROM queue WHERE patient_id = auth.uid()
        ↓
RLS enforces: only own queue entries returned
        ↓
Patient dashboard renders own data
```

**Key file**: `src/app/dashboard/page.tsx`

---

### Doctor Flow

```
Admin registers doctor via /admin/doctors
        ↓
Doctor row inserted in doctors table with email field
        ↓
Doctor user signs in with Clerk (same email)
        ↓
Doctor visits /doctor
        ↓
useUser() → gets Clerk primaryEmailAddress
        ↓
Supabase query:
  SELECT * FROM doctors WHERE email = '<clerk_email>'
        ↓
If no row found → setAccessDenied(true) → "Access Denied" UI shown
If row found → doctor is authenticated as Doctor role
        ↓
Fetch queue for this doctor:
  SELECT * FROM queue WHERE doctor_id = doctor.id
        ↓
Doctor dashboard renders their patient queue
```

**Key file**: `src/app/doctor/page.tsx`

```typescript
// Role check — email lookup pattern
const { data: doctor } = await supabase
  .from("doctors")
  .select("*")
  .eq("email", user?.primaryEmailAddress?.emailAddress)
  .single();

if (!doctor) {
  setAccessDenied(true);
  return;
}
```

---

### Admin Flow

```
User navigates to /admin
        ↓
Middleware checks: valid Clerk JWT? → Yes, proceed
        ↓
Page loads: useUser() + isSignedIn check
        ↓
No role verification → any signed-in user can access /admin UI
        ↓
Admin performs CRUD (create hospital, register doctor, etc.)
        ↓
Frontend calls API route (e.g., POST /api/hospitals)
        ↓
API route uses server-side Supabase client (SERVICE_ROLE_KEY)
        ↓
Service role bypasses all RLS policies
        ↓
Database write succeeds
```

**Key files**:
- `src/app/admin/page.tsx` — Main admin dashboard
- `src/app/admin/hospitals/page.tsx` — Hospital CRUD + license upload
- `src/app/admin/doctors/page.tsx` — Doctor registration and department assignment

---

## Frontend Role-Based Rendering

### Landing Page (`src/app/page.tsx`)
```typescript
const { isLoaded, isSignedIn } = useUser();

// Unauthenticated users see:
<Link href="/sign-in">Sign In</Link>
<Link href="/sign-up">Get Started</Link>

// Authenticated users see:
<Link href="/join-queue">Join Queue</Link>
<Link href="/book-appointment">Book Appointment</Link>
```

### Navigation Dropdown — All role links visible to all users
```typescript
// No role check — links shown to any authenticated user
<Link href="/dashboard">User Dashboard</Link>
<Link href="/admin">Admin Dashboard</Link>
<Link href="/doctor">Doctor Dashboard</Link>
```

Role enforcement happens **inside** each dashboard on page load, not at the navigation level.

---

## Auth Service Bridge (`src/lib/services/authService.ts`)

Bridges Clerk identity to the Supabase `users` table:

```typescript
export class AuthService {
  // Called during sign-up / Clerk webhook
  async createOrUpdateUser(
    clerkUserId: string,
    userData: { name: string; email: string; mobile?: string },
    additionalData?: Partial<User>
  ): Promise<User>

  // Used to fetch patient data server-side
  async getUserData(userId: string): Promise<User | null>
}
```

- `clerkUserId` becomes the primary key in `users` table
- This is the link between Clerk auth and Supabase data
- No role assignment happens here — all users created as patients

---

## Complete Access Control Matrix

| Resource | Patient | Doctor | Admin |
|----------|---------|--------|-------|
| Own user profile | Read/Write | Read/Write | Full |
| Own appointments | Read/Write | — | Full |
| Own queue entries | Read/Write | — | Full |
| Other patients' data | None | None | Full |
| Hospital list | Read | Read | Full CRUD |
| Doctor list | Read | Read | Full CRUD |
| Department list | Read | Read | Full CRUD |
| Doctor's patient queue | None | Read (own) | Full |
| Admin dashboard | Accessible (no guard) | Accessible (no guard) | Full |

---

## Security Gaps and Notes

| Gap | Description | Risk |
|-----|-------------|------|
| No admin role check | Any Clerk-authenticated user can access `/admin` UI | High — admin UI is open to all signed-in users |
| Doctor role by email | Doctor role inferred from email match — anyone can register with a doctor's email | Medium — depends on email uniqueness |
| No audit log | No record of who performed admin actions | Medium |
| No granular permissions | All "admins" have identical full access | Low for small teams |
| RLS only for patients | Doctor and admin data access enforced at app layer, not DB layer | Medium |

---

## File Reference

| File | Role Relevance |
|------|---------------|
| `middleware.ts` | Global auth guard — redirects unauthenticated users |
| `supabase-schema.sql` | DB schema + all RLS policies |
| `migrations/001_extend_hospitals.sql` | Adds hospital_type, is_active for admin management |
| `migrations/002_admin_rls_policies.sql` | Adds admin-level RLS policies (used via service role) |
| `src/lib/supabase/client.ts` | Browser client — respects RLS |
| `src/lib/supabase/server.ts` | Server client — bypasses RLS (service role) |
| `src/lib/services/authService.ts` | Bridges Clerk → Supabase user creation |
| `src/app/layout.tsx` | ClerkProvider wraps entire app |
| `src/app/page.tsx` | Auth-conditional landing page UI |
| `src/app/dashboard/page.tsx` | Patient dashboard — RLS-enforced data fetch |
| `src/app/doctor/page.tsx` | Doctor dashboard — email-based role check |
| `src/app/admin/page.tsx` | Admin dashboard — isSignedIn check only |
| `src/app/admin/hospitals/page.tsx` | Hospital CRUD via service role |
| `src/app/admin/doctors/page.tsx` | Doctor registration via service role |
| `src/app/api/ensure-user/route.ts` | Creates patient record on first sign-in |
| `src/lib/types/index.ts` | TypeScript interfaces for User, Doctor, Hospital |
