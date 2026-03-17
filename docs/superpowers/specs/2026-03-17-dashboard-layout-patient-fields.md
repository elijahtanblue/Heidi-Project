# Dashboard Layout Redesign + New Patient Fields

**Date:** 2026-03-17
**Scope:** Visual layout restructure of the clinician dashboard and two new optional fields on the Patient model.

---

## 1. Layout Changes

### 1.1 Access Level Bar — Move to Top

The access progress card (`data-testid="access-progress-card"`) currently renders after the header row. It moves to be the **first element** in the dashboard page, rendered before the `<h1>` header. No changes to its content or styling.

The `myClinic` lookup and `tier`/`style`/`barColor` computations are extracted as named variables at the top of the server component function (instead of the current IIFE pattern) so they can be shared between the access bar and `DashboardClientSection` without duplication.

### 1.2 Two-Column Form Row

Below the header, a `grid grid-cols-2 gap-4 mb-8` row holds both form components side by side:

- **Left column:** `CreatePatientForm` — renders its gold "+ Create New Patient" trigger button by default; clicking expands the New Patient form within the left column.
- **Right column:** `CreateEpisodeForm` — renders its gold "+ Add Patient Visit" trigger button by default; clicking expands the Add Patient Visit form within the right column.

Both columns are always visible. Each form expands/collapses independently. The two trigger buttons appear side by side at rest.

### 1.3 CreateEpisodeForm Extraction from EpisodesSection

`CreateEpisodeForm` is currently rendered inside `EpisodesSection`. It is extracted to the dashboard page level so it can participate in the two-column row.

**How episode list updates after creation:**

`CreateEpisodeForm` will call `router.refresh()` on successful episode creation (same pattern as `CreatePatientForm`). This triggers a Next.js server-side re-fetch and re-render, updating the episode list in `EpisodesSection` without requiring state lifting or callbacks between components. `EpisodesSection` retains its existing internal state management unchanged for all other mutations (delete episode, delete update, add update, edit update).

**Changes to `EpisodesSection`:**
- Remove the `handleEpisodeCreated` callback (the handler that was passed as `onCreated` to `CreateEpisodeForm`) and the `<CreateEpisodeForm>` JSX block — do NOT remove `refreshEpisodes` itself, as it is still used by `handleDeleteUpdate` and the `EditUpdateInline` `onSaved` callback
- Remove the `patients` prop from `EpisodesSectionProps` and the component signature — it was only used to pass to `CreateEpisodeForm` and is not used anywhere else in the component
- All other internal state (episodes list, edit forms, delete handlers, `refreshEpisodes` for other mutations) remains unchanged
- The `initialEpisodes` and `clinicTier` props remain unchanged

**Changes to `CreateEpisodeForm`:**
- Add `import { useRouter } from "next/navigation"` and call `router.refresh()` after a successful POST instead of calling `onCreated(episode)` with the new episode object
- Remove the `onCreated` prop from the component interface
- The `patients` prop stays (still needed to populate the patient select dropdown)

**Changes to `dashboard/page.tsx`:**
- Remove `<CreatePatientForm />` from the header flex row (no longer top-right)
- Render the two-column grid row below the header with `<CreatePatientForm />` (left) and `<CreateEpisodeForm patients={patients} />` (right)
- `patients` is already fetched in the existing `Promise.all` — no new data fetching needed

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

Accept `medicareNumber` and `physicianName` in the request body. Both are optional strings. Pass to `prisma.patient.create`. Treat absent/empty values as `undefined` (not stored as empty string).

### 2.4 CreatePatientForm

Add two new optional input fields in a new `grid grid-cols-2 gap-3` row below the existing DOB/Phone row:

- **Medicare Number** — text input, optional (`required` omitted), `placeholder="e.g. 2123456701"`
- **Physician's Name** — text input, optional (`required` omitted), `placeholder="e.g. Dr. Sarah Lee"`

State: `medicareNumber` and `physicianName` string state vars, initialized to `""`.

Include both in the `fetch` POST body (send `undefined` or omit if empty string — use `|| undefined` to avoid storing blanks). Reset both to `""` on successful submit.

---

## 3. Files Changed

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `medicareNumber String?`, `physicianName String?` to Patient |
| `prisma/migrations/...` | Create | Migration for the two new columns |
| `app/api/patients/route.ts` | Modify | Accept + persist `medicareNumber`, `physicianName` |
| `components/CreatePatientForm.tsx` | Modify | Add two optional input fields + state vars |
| `components/CreateEpisodeForm.tsx` | Modify | Remove `onCreated` prop; call `router.refresh()` on success instead |
| `components/EpisodesSection.tsx` | Modify | Remove internal CreateEpisodeForm render + `onCreated` handler |
| `app/(routes)/dashboard/page.tsx` | Modify | Move access bar to top; two-column form row; extract myClinic variable |

---

## 4. Tests

- Update `tests/patient-api.test.ts`: include `medicareNumber` and `physicianName` in create-patient request/response tests
- Update `tests/patient-ui.test.tsx`: update the POST body assertion in the submit test to include (or use `objectContaining` for) the new optional fields
- Update `tests/episode-form.test.tsx`: all four tests currently render `<CreateEpisodeForm patients={patients} onCreated={onCreated} />` — after the `onCreated` prop is removed, every `render(...)` call must drop the `onCreated` argument entirely, the `onCreated = jest.fn()` variable must be removed, and the success-path test must instead mock `useRouter` (via `jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }))`) and assert that `mockRefresh()` was called
- No routing or access-policy logic changes — those tests are unaffected

---

## 5. Out of Scope

- Displaying `medicareNumber` and `physicianName` in PatientManagement table (future work)
- Mobile/responsive layout (per prior decision, mobile view is not a priority)
