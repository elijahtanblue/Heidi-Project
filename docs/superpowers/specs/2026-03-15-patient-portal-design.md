# Patient Portal — Design Spec
**Date:** 2026-03-15
**Project:** Kinetic MVP
**Status:** Approved

---

## Overview

Add a lightweight patient-facing portal to the existing Next.js app. The goal is to reframe the physiotherapy referral problem from a clinician-driven workflow to a patient-driven one — patients carry their own treatment history and present it to new providers, driving demand for cross-clinic record sharing.

For this demo, both the clinician dashboard and patient dashboard live in the same app, separated by role-based routing. A patient user logs in with email and password. The patient's treatment history is fully editable (same as the clinician view) to keep the demo simple to present.

### Known demo limitations (accepted)
- `Episode.userId` will be the patient's User id for patient-submitted episodes. Downstream views that render `episode.user.name` will show the patient's name as the "clinician". The `submittingCarerName` field provides the real carer name. This is acceptable for the demo.
- `EpisodesSection` shows inline edit/delete controls. These remain active for patients (intentional — makes the demo easier to navigate).
- Free-text clinic and carer name fields can be typed by anyone. If a patient fakes them, it only delays their own treatment. Accepted.

---

## Section 1 — Schema Changes

One Prisma migration. No new models.

### `ClinicalUpdate` — three new optional fields

```prisma
patientSubmitted      Boolean  @default(false)
submittingClinicName  String?
submittingCarerName   String?
```

These fields are only populated when the update is submitted via the patient portal. All existing clinician-submitted records default to `patientSubmitted: false` with null clinic/carer name fields.

### `User` — one new optional field

```prisma
patientRecordId  String?  @unique
```

Links a patient-role `User` to their `Patient` record (stores the `Patient.id`). Null for all clinician and admin users.

### `treatmentModalities` on patient-submitted updates

`treatmentModalities` is optional (`String?` in the schema). For patient-submitted updates, if auto-categorisation fails or is skipped, the field may be null. The endpoint accepts null for this field.

### Seed

Add one patient user to `prisma/seed.ts`:
- Email: `johnsmith@patient.com`
- Password: `password123`
- Role: `patient`
- `patientRecordId`: set to John Smith's existing `Patient.id`

Note: John Smith's `Patient` record has a non-null `clinicId` (set in the existing seed). This is the `Patient.clinicId` — distinct from `User.clinicId` which is null for patient-role users.

---

## Section 2 — Auth & Routing

No new auth system. Patients use the existing email/password login flow.

### Role-based redirect in `app/(routes)/layout.tsx`

After session check:
- Role `"patient"` → redirect to `/patient-dashboard`
- Role `"clinician"` or `"admin"` → `/dashboard` (unchanged)

A patient hitting `/dashboard` redirects to `/patient-dashboard`. A clinician hitting `/patient-dashboard` redirects to `/dashboard`.

### New routes

```
app/(routes)/patient-dashboard/page.tsx         — patient history (server component)
app/(routes)/patient-dashboard/present/page.tsx — physio-fill form (server component)
```

Both routes are auth-protected. If no session → redirect to `/login`.

---

## Section 3 — Patient Dashboard

Server-rendered page at `/patient-dashboard`.

**Data fetching:**

```ts
const patientRecordId = (session.user as { patientRecordId?: string }).patientRecordId;
if (!patientRecordId) redirect("/login"); // guard: misconfigured patient account

const patient = await prisma.patient.findUnique({
  where: { id: patientRecordId },
  include: {
    episodes: {
      orderBy: { createdAt: "desc" },
      include: {
        clinicalUpdates: {
          include: { clinic: true, user: true }
        }
      }
    }
  }
});
if (!patient) redirect("/login"); // guard: patientRecordId references deleted patient
```

**Layout:**
- Heading: patient's full name (`patient.firstName + " " + patient.lastName`)
- "Present to Physio" button — navigates to `/patient-dashboard/present`
- Full treatment history via `EpisodesSection`

**History rendering:**
- Pass episodes to `EpisodesSection` with full edit/delete controls (demo mode)
- For patient-submitted updates (`patientSubmitted: true`): display `submittingClinicName` and `submittingCarerName` in place of `clinic.name` / `user.name`. This display logic lives in `EpisodesSection` — add a conditional render: if `patientSubmitted`, show those fields; otherwise show existing relation fields.
- `EpisodesSection` already receives `clinicalUpdates` with `clinic` and `user` included — no change to the query shape needed.

**Empty state:**
> "No treatment history yet. Present your device to your physiotherapist to get started."

---

## Section 4 — Present to Physio Form

New client component `PatientPresentForm` rendered at `/patient-dashboard/present`.

A trimmed version of `AddUpdateForm` with two extra free-text fields at the top and reworded labels throughout.

### Fields

| Field | Type | Who fills it |
|---|---|---|
| `submittingClinicName` | free text input | Physio |
| `submittingCarerName` | free text input | Physio |
| `dateOfVisit` | date input | Physio |
| `painRegion` | text input — "Where was the patient treated?" | Physio |
| `diagnosis` | text input — "What was the diagnosis?" | Physio |
| `treatmentModalities` | text input — "What treatment was provided?" (auto-categorised on blur, optional) | Physio |
| `redFlag` | checkbox — "Red flag noted?" | Physio |
| `notesRaw` | textarea — "Additional notes" | Physio |

### Submission — single new endpoint

```
POST /api/patient/present
```

This endpoint:
1. Checks `session.user.role === "patient"` — returns 403 otherwise
2. Reads `session.user.patientRecordId` — returns 400 if null
3. Queries `prisma.patient.findUnique({ where: { id: patientRecordId } })` — returns 404 if not found
4. Creates in a single Prisma transaction:
   - **Episode**: `{ patientId: patient.id, clinicId: patient.clinicId, userId: session.user.id }`
   - **ClinicalUpdate**: `{ episodeId, clinicId: patient.clinicId, userId: session.user.id, patientSubmitted: true, submittingClinicName, submittingCarerName, ...clinicalFields }`
5. Returns `{ episodeId, updateId }` on success

On success: client redirects to `/patient-dashboard`.
On API error: show inline error message, keep form data intact.

### Treatment auto-categorisation

`treatmentModalities` calls `POST /api/updates/categorise` on blur. Falls back silently — field keeps whatever the physio typed. Since the field is optional, an empty or uncategorised value is accepted by the endpoint.

### Access policy

`domain/policy/access.ts` governs cross-clinic snapshot access decisions only. `POST /api/patient/present` does its own role check and does not go through the access policy module.

---

## Section 5 — Testing

Lightweight — unit and component level only. No e2e tests for the demo.

### Auth/routing tests
- User with role `"patient"` is redirected from `/dashboard` to `/patient-dashboard`
- User with role `"clinician"` is redirected from `/patient-dashboard` to `/dashboard`

### Patient dashboard UI tests
- Renders patient name and "Present to Physio" button
- Renders empty state when patient has no episodes
- Renders episode list when episodes exist

### `PatientPresentForm` UI tests
- Renders `submittingClinicName` and `submittingCarerName` fields
- On submit: calls `POST /api/patient/present` with `patientSubmitted: true`, `submittingClinicName`, `submittingCarerName`
- Redirects to `/patient-dashboard` on success
- Shows inline error message on API failure (non-2xx)

### API tests — `POST /api/patient/present`
- Returns 403 for clinician/admin role
- Returns 400 if `patientRecordId` is null
- Returns 404 if `patientRecordId` references no patient
- Creates episode + update and returns `{ episodeId, updateId }` for valid patient session
- Stores `patientSubmitted: true`, `submittingClinicName`, `submittingCarerName` on the update
- Accepts null `treatmentModalities` without error

### Regression
- Existing episode and update endpoints continue to pass with no changes

---

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 3 fields to `ClinicalUpdate`, 1 field to `User` |
| `prisma/seed.ts` | Add `johnsmith@patient.com` patient user |
| `app/(routes)/layout.tsx` | Add patient role redirect |
| `app/(routes)/patient-dashboard/page.tsx` | New — patient dashboard |
| `app/(routes)/patient-dashboard/present/page.tsx` | New — present to physio page |
| `components/PatientPresentForm.tsx` | New — physio-fill form component |
| `app/api/patient/present/route.ts` | New — patient portal submission endpoint |
| `components/EpisodesSection.tsx` | Minor — conditionally display `submittingClinicName`/`submittingCarerName` for patient-submitted updates |
| `tests/patient-portal.test.tsx` | New — UI tests |
| `tests/patient-portal-api.test.ts` | New — API tests |
| `tests/patient-portal-routing.test.ts` | New — routing/auth tests |
