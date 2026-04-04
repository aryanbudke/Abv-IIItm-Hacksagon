# Plan: User Management Page (`/admin/users`)

## Overview

A new admin-only page at `/admin/users` that lists every Clerk user, shows their current role, and lets the admin promote/demote them. Promoting someone to **doctor** redirects to the existing `/admin/doctors` page with their email pre-filled in the doctor registration form.

---

## Current State (What Already Exists)

| Piece | Location | Status |
|---|---|---|
| Role field | Clerk `publicMetadata.role` | ✅ exists (`patient` / `doctor` / `admin`) |
| Set-role API | `POST /api/set-role` | ✅ exists — takes `{ email, role }`, admin-only |
| Doctor registration page | `/admin/doctors` | ✅ exists — has a form with `email` field |
| Users in Supabase | `public.users` table | ✅ exists — Clerk ID + name + email |
| Admin guard pattern | All admin pages | ✅ consistent — redirect if `role !== "admin"` |

**What is missing:**
- An API route to **list all Clerk users** (Clerk's `/api/users` is server-side only)
- A UI page at `/admin/users` to display and manage those users
- A query-param contract so `/admin/doctors` can accept `?email=` to pre-fill the form

---

## Architecture Decisions

### 1. How to list Clerk users
The Clerk user list is **only accessible server-side** via `clerkClient()`. We cannot call it from a browser directly. Solution: a new **server-side API route** `GET /api/admin/users` that:
- Verifies the caller is an admin
- Calls `clerk.users.getUserList()` with pagination
- Returns sanitised user objects (id, name, email, role, createdAt, imageUrl)

### 2. How roles are stored
Roles live in `publicMetadata.role` in Clerk. There is **no separate roles table** in Supabase — we keep it that way (single source of truth = Clerk).

### 3. Doctor promotion flow
When admin clicks "Promote to Doctor":
1. The role is set to `"doctor"` via the existing `POST /api/set-role`
2. Admin is redirected to `/admin/doctors?email=<user_email>&name=<user_name>`
3. The doctors page reads those query params and pre-fills the form

### 4. Demotion / role change
Any role can be changed to any other via `POST /api/set-role`. If a doctor is demoted to patient, their record in the `doctors` table is **not deleted automatically** (admin should manually remove from `/admin/doctors` if needed — we'll show a warning).

---

## What We Build

### A. New API route — `GET /api/admin/users`

**File:** `src/app/api/admin/users/route.ts`

**Logic:**
```
1. auth() → get callerId
2. clerkClient().users.getUser(callerId) → verify role === "admin"
3. clerkClient().users.getUserList({ limit, offset, query }) → paginated list
4. Map each Clerk user to { id, name, email, role, imageUrl, createdAt }
5. Return JSON
```

**Query params supported:**
- `?page=1` (default 1)
- `?limit=20` (default 20, max 50)
- `?search=` (searches email/name via Clerk)

---

### B. New page — `/admin/users`

**File:** `src/app/admin/users/page.tsx`

**UI Sections:**

#### Header
- Back button → `/admin`
- Title: "User Management"
- Search bar (debounced, filters the list)
- Stats chips: Total Users · Admins · Doctors · Patients

#### User Table / Cards
Each user row shows:
- Avatar (Clerk imageUrl)
- Full name + email
- Current role badge (colour-coded: blue=admin, purple=doctor, green=patient)
- "Created" date
- Action dropdown: **Promote / Demote / Change Role**

#### Role Action Menu (per user)
Options shown depending on current role:

| Current Role | Options Available |
|---|---|
| `patient` | → Make Doctor, → Make Admin |
| `doctor` | → Make Patient, → Make Admin |
| `admin` | → Make Patient, → Make Doctor |

Clicking **"Make Doctor"**:
1. Calls `POST /api/set-role` with `{ email, role: "doctor" }`
2. Shows toast: "Role updated. Redirecting to doctor registration..."
3. Redirects to `/admin/doctors?email=<email>&name=<name>`

Clicking **"Make Patient"** or **"Make Admin"**:
1. Calls `POST /api/set-role`
2. Shows success toast
3. Refreshes the user list
4. If demoting a doctor → shows a warning banner: _"This user still has a doctor record. Remove it from the Doctors page if needed."_

#### Pagination
Simple prev/next controls at bottom.

---

### C. Modify `/admin/doctors` to accept query params

**File:** `src/app/admin/doctors/page.tsx`

**Change:** On component mount, read `?email` and `?name` from the URL using `useSearchParams()`. If present, pre-fill the new-doctor form and **automatically open the "Add Doctor" panel**.

```
const searchParams = useSearchParams();
const prefillEmail = searchParams.get("email") ?? "";
const prefillName  = searchParams.get("name")  ?? "";

// On mount, if prefillEmail exists:
//   → set form.email = prefillEmail
//   → set form.name  = prefillName
//   → open the add-doctor drawer/form
```

This is a **minimal, targeted change** — no restructuring of the doctors page.

---

## File Change Summary

| File | Change Type | Description |
|---|---|---|
| `src/app/api/admin/users/route.ts` | **New** | GET endpoint — lists Clerk users, admin-only |
| `src/app/admin/users/page.tsx` | **New** | User management UI page |
| `src/app/admin/doctors/page.tsx` | **Edit** | Read `?email` + `?name` query params, pre-fill form |

**No database changes required.** No new Supabase tables. No migration files.

---

## Detailed Flow Diagrams

### Promote to Doctor Flow
```
Admin visits /admin/users
       │
       ▼
List loads via GET /api/admin/users
       │
       ▼
Admin clicks "Make Doctor" on a user
       │
       ▼
POST /api/set-role { email, role: "doctor" }
       │
       ├─ success → toast "Role updated"
       │            router.push(`/admin/doctors?email=X&name=Y`)
       │
       └─ error   → toast "Failed: <error message>"
```

### Demote / Change Role Flow
```
Admin clicks "Make Patient" (or "Make Admin")
       │
       ▼
POST /api/set-role { email, role }
       │
       ├─ success → toast "Role updated"
       │            refresh user list
       │            if previous role was "doctor":
       │              show warning banner about doctor record
       │
       └─ error   → toast "Failed: <error message>"
```

### /admin/doctors Pre-fill Flow
```
router.push("/admin/doctors?email=foo@bar.com&name=Foo Bar")
       │
       ▼
doctors page mounts
       │
       ▼
useSearchParams() reads email + name
       │
       ▼
setForm({ ...emptyForm, email: "foo@bar.com", name: "Foo Bar" })
setShowForm(true)  ← opens the add-doctor panel automatically
       │
       ▼
Admin fills remaining fields (hospital, department, specialization, etc.)
and submits → doctor record created in Supabase
```

---

## UI Design Notes

- **Same design system** as existing admin pages: Tailwind, Framer Motion, shadcn cards, blue gradient theme
- Role badges:
  - `admin` → blue pill
  - `doctor` → purple pill
  - `patient` → green pill
  - `unknown` → grey pill
- Action dropdown uses a simple popover (or a `<select>`-style menu, matching the doctors page style)
- Loading skeleton while fetching user list
- Empty state if search returns no results
- Error state if API fails

---

## Edge Cases & Considerations

| Case | Handling |
|---|---|
| User has no Clerk account yet | `set-role` already handles this — returns a message, no crash |
| Admin tries to demote themselves | Allow it (they can re-promote via Clerk dashboard); show a warning |
| User is both in `doctors` table and has role `patient` | Show warning on demote; don't auto-delete doctor record |
| Clerk rate limits on `getUserList` | Debounce search input (300ms); keep page size ≤ 20 |
| Admin page already guards role | `/admin/users` will use same guard as other admin pages |
| Doctor record already exists for that email | `/admin/doctors` handles duplicates — shows error on submit |

---

## Implementation Order

1. **`GET /api/admin/users`** — build & test the API first
2. **`/admin/users` page** — build with mock data first, then wire up the API
3. **`/admin/doctors` query param pre-fill** — small targeted edit, do last

Each step is independently testable. Steps 1 and 3 are the smallest; step 2 is the main UI work.

---

## Out of Scope (for this feature)

- Bulk role changes
- Deleting users (handled via Clerk dashboard)
- Editing user profile details (name, email) — Clerk handles this
- Showing full patient history per user (belongs in a future patient detail page)
- Automatic removal of doctor record on demotion (too destructive without confirmation UX — future task)
