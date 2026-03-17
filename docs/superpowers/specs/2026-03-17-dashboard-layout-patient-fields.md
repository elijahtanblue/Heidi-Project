# Dashboard Layout Redesign + New Patient Fields

**Date:** 2026-03-17
**Scope:** Visual layout restructure of the clinician dashboard and two new optional fields on the Patient model.

---

## 1. Layout Changes

### 1.1 Access Level Bar — Move to Top

The access progress card (`data-testid="access-progress-card"`) currently renders after the header row. It moves to be the **first element** in the dashboard page, rendered before the `<h1>` header. No changes to its content or styling.

### 1.2 Two-Column Form Row

Below the header, a `grid grid-cols-2 gap-4 mb-8` row replaces the current top-right positioning of `CreatePatientForm`. It contains:

- **Left column:** `CreatePatientForm` — renders its gold "+ Create New Patient" trigger button by default; clicking expands the New Patient form within the left column.
- **Right column:** `CreateEpisodeForm` — renders its gold "+ Add Patient Visit" trigger button by default; clicking expands the Add Patient Visit form within the right column.

Both columns are always visible. Each form expands/collapses independently within its own column. The two trigger buttons appear side by side.

### 1.3 CreateEpisodeForm Extraction from EpisodesSection

`CreateEpisodeForm` is currently rendered inside `EpisodesSection`. It must be extracted to the dashboard page level so it can participate in the two-column row.

**Change to `EpisodesSection`:**
- Remove the internal `CreateEpisodeForm` render and the `onCreated` handler
- The `patients` prop stays (still used for the episode list display)
- The `initialEpisodes` and `clinicTier` props stay unchanged
- Add an `onEpisodeCreated` callback prop: `onEpisodeCreated: (episode: SerializedEpisode) => void`
- EpisodesSection calls this callback when a new episode is created, so the dashboard can add it to the displayed list

**Change to dashboard page:**
- Render `<CreateEpisodeForm patients={patients} onCreated={handleEpisodeCreated} />` in the right column
- `handleEpisodeCreated` is a client-side state update that adds the new episode to the displayed list (same logic currently inside EpisodesSection)

Wait — `dashboard/page.tsx` is a server component. The episode list and `onCreated` handler are managed client-side inside `EpisodesSection`. The extraction must not break this. The cleanest approach:

- Keep `EpisodesSection` as a client component that manages its own episode list state
- Lift `CreateEpisodeForm` **out** of the EpisodesSection JSX but keep it communicating via a shared state or callback
- Concretely: `EpisodesSection` exposes a `renderCreateForm` render-prop, OR the dashboard wraps both in a new `PatientVisitsPanel` client component

**Chosen approach:** Create a thin `PatientVisitsPanel` client component that owns the episode list state and renders both `CreateEpisodeForm` and `EpisodesSection` together. This keeps the extraction clean without threading callbacks through the server component.

- `components/PatientVisitsPanel.tsx` (new client component):
  - Accepts `initialEpisodes`, `patients`, `clinicTier` props (same as current EpisodesSection)
  - Owns `episodes` state (initialized from `initialEpisodes`)
  - Renders `<CreateEpisodeForm>` (the trigger button + form) in its own slot, passed UP to the two-column row via a render prop or by restructuring

Actually, the simpler solution: keep both forms in the two-column row on the dashboard, and have `EpisodesSection` receive a shared `episodes` state managed by a parent client component.

**Revised approach (simpler):**

Extract a `DashboardClientSection` client component that:
- Owns `episodes` state
- Renders the two-column form row (both CreatePatientForm and CreateEpisodeForm)
- Renders EpisodesSection below

The server component (`dashboard/page.tsx`) renders:
1. Access level bar (server-rendered, stays as IIFE)
2. Header h1 + subtitle
3. `<DashboardClientSection initialEpisodes={...} patients={...} clinicTier={...} />`
4. Clinics table
5. PatientManagement
6. Patient Consent table

`DashboardClientSection`:
- `"use client"`
- Owns `episodes` state
- Renders grid with `CreatePatientForm` (left) and `CreateEpisodeForm` (right)
- Renders `<EpisodesSection episodes={episodes} patients={patients} clinicTier={clinicTier} onEpisodeCreated={...} />`
- `EpisodesSection` is refactored to accept `episodes` as a prop (not `initialEpisodes`) and an `onEpisodeCreated` callback instead of managing its own CreateEpisodeForm

---

## 2. New Patient Fields

### 2.1 Schema

Add two optional fields to the `Patient` model in `prisma/schema.prisma`:

```prisma
medicareNumber String?
physicianName  String?
```

### 2.2 Migration

Run `npx prisma migrate dev --name add-patient-medicare-physician` to generate and apply the migration.

### 2.3 API — POST /api/patients

Accept `medicareNumber` and `physicianName` in the request body. Both are optional strings. Pass to `prisma.patient.create`.

### 2.4 CreatePatientForm

Add two new optional input fields below the existing DOB/Phone row:

- **Medicare Number** — text input, optional, `placeholder="e.g. 2123456701"`, no `required` attribute
- **Physician's Name** — text input, optional, `placeholder="e.g. Dr. Sarah Lee"`, no `required` attribute

Both in a `grid grid-cols-2 gap-3` row. Include in the `fetch` POST body. Reset on successful submit.

---

## 3. Files Changed

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `medicareNumber String?`, `physicianName String?` to Patient |
| `prisma/migrations/...` | Create | Migration for the two new columns |
| `app/api/patients/route.ts` | Modify | Accept + persist `medicareNumber`, `physicianName` |
| `components/CreatePatientForm.tsx` | Modify | Add two optional input fields |
| `components/DashboardClientSection.tsx` | Create | Client wrapper owning episode state + two-column form row |
| `components/EpisodesSection.tsx` | Modify | Accept `episodes` prop + `onEpisodeCreated` callback; remove internal CreateEpisodeForm |
| `app/(routes)/dashboard/page.tsx` | Modify | Move access bar to top, render DashboardClientSection, remove CreatePatientForm from header |

---

## 4. Tests

- Update `tests/patient-api.test.ts` to include `medicareNumber` and `physicianName` in create-patient tests
- Update any `EpisodesSection` tests that reference `initialEpisodes` prop or `CreateEpisodeForm` being inside it
- No routing or access-policy logic changes — those tests are unaffected

---

## 5. Out of Scope

- Displaying `medicareNumber` and `physicianName` in PatientManagement table (future work)
- Mobile/responsive layout (per prior decision, mobile view is not a priority)
