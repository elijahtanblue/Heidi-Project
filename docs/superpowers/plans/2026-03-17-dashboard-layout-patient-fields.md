# Dashboard Layout Redesign + New Patient Fields Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the access level bar to the top, place New Patient and Add Visit forms side-by-side in a two-column row, and add optional Medicare number and physician's name fields to the patient creation flow.

**Architecture:** Two independent workstreams that merge at the dashboard page. The data layer (schema → API → form fields) is self-contained. The layout refactor (CreateEpisodeForm extraction, EpisodesSection cleanup, dashboard restructure) handles the component wiring. Both are purely additive or subtractive — no business logic changes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon adapter), Tailwind CSS v4, Jest + Testing Library

**Spec:** `docs/superpowers/specs/2026-03-17-dashboard-layout-patient-fields.md`

---

## Chunk 1: Data Layer — Schema, API, Form Fields

### Task 1: Add Medicare and Physician fields to schema and API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `app/api/patients/route.ts`

No new tests yet — test updates come in Task 2.

- [ ] **Step 1: Update `prisma/schema.prisma`**

Find the `Patient` model and add two optional fields after `clinicId` (before `consentStatus`). Replace the entire model with:

```prisma
model Patient {
  id                   String    @id @default(cuid())
  firstName            String
  lastName             String
  dateOfBirth          DateTime
  phoneNumber          String    @unique
  clinicId             String
  medicareNumber       String?
  physicianName        String?
  consentStatus        String    @default("SHARE")
  consentUpdatedAt     DateTime?
  treatmentCompletedAt DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  clinic   Clinic    @relation(fields: [clinicId], references: [id])
  episodes Episode[]
}
```

- [ ] **Step 2: Run migration**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx prisma migrate dev --name add-patient-medicare-physician 2>&1 | tail -10
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Update `app/api/patients/route.ts`**

Destructure the two new optional fields from the request body and pass them to `prisma.patient.create`. Treat empty string as absent (use `|| undefined`).

Replace the destructuring block and create call:

```typescript
const { firstName, lastName, dateOfBirth, phoneNumber, medicareNumber, physicianName } = body as {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  medicareNumber?: string;
  physicianName?: string;
};
```

And update `prisma.patient.create`:

```typescript
const patient = await prisma.patient.create({
  data: {
    firstName,
    lastName,
    dateOfBirth: new Date(dateOfBirth),
    phoneNumber: phoneCleaned,
    clinicId: user.clinicId as string,
    medicareNumber: medicareNumber || undefined,
    physicianName: physicianName || undefined,
  },
});
```

- [ ] **Step 4: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add prisma/schema.prisma prisma/migrations app/api/patients/route.ts && git commit -m "feat: add medicareNumber and physicianName fields to Patient"
```

---

### Task 2: Add new fields to CreatePatientForm and update tests

**Files:**
- Modify: `components/CreatePatientForm.tsx`
- Modify: `tests/patient-api.test.ts`

- [ ] **Step 1: Write failing API test**

In `tests/patient-api.test.ts`, add a new test inside the existing `describe("POST /api/patients")` block, after the existing tests:

```typescript
it("persists medicareNumber and physicianName when provided", async () => {
  mockPatientFindUnique.mockResolvedValueOnce(null);
  mockPatientCreate.mockResolvedValueOnce({ id: "p1" });

  await POST(makeReq({
    ...validBody,
    medicareNumber: "2123456701",
    physicianName: "Dr. Sarah Lee",
  }));

  expect(mockPatientCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      medicareNumber: "2123456701",
      physicianName: "Dr. Sarah Lee",
    }),
  });
});

it("omits medicareNumber and physicianName when empty string", async () => {
  mockPatientFindUnique.mockResolvedValueOnce(null);
  mockPatientCreate.mockResolvedValueOnce({ id: "p1" });

  await POST(makeReq({
    ...validBody,
    medicareNumber: "",
    physicianName: "",
  }));

  expect(mockPatientCreate).toHaveBeenCalledWith({
    data: expect.not.objectContaining({
      medicareNumber: expect.anything(),
    }),
  });
});
```

- [ ] **Step 2: Run the patient API tests**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage tests/patient-api.test.ts 2>&1 | tail -15
```

Expected: all tests including the two new ones PASS. (The API was already implemented in Task 1, so these tests are written against a working implementation — no red→green cycle needed here.)

- [ ] **Step 3: Update `components/CreatePatientForm.tsx`**

Add state vars for the two new fields after the existing state declarations:

```typescript
const [medicareNumber, setMedicareNumber] = useState("");
const [physicianName, setPhysicianName] = useState("");
```

Update the `fetch` call body (inside `handleSubmit`) to include the new fields:

```typescript
body: JSON.stringify({
  firstName,
  lastName,
  dateOfBirth,
  phoneNumber,
  medicareNumber: medicareNumber || undefined,
  physicianName: physicianName || undefined,
}),
```

Reset both on success (after `setIsOpen(false)`):

```typescript
setMedicareNumber("");
setPhysicianName("");
```

Also update the Cancel button's `onClick` handler to reset the new fields:

```tsx
// Old:
onClick={() => { setIsOpen(false); setError(""); }}

// New:
onClick={() => { setIsOpen(false); setError(""); setMedicareNumber(""); setPhysicianName(""); }}
```

Add a new `grid grid-cols-2 gap-3` row below the DOB/Phone row, inside the `<form>`:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label htmlFor="patient-medicare" className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1">
      Medicare Number
    </label>
    <input
      id="patient-medicare"
      type="text"
      value={medicareNumber}
      onChange={(e) => setMedicareNumber(e.target.value)}
      placeholder="e.g. 2123456701"
      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
    />
  </div>
  <div>
    <label htmlFor="patient-physician" className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1">
      Physician's Name
    </label>
    <input
      id="patient-physician"
      type="text"
      value={physicianName}
      onChange={(e) => setPhysicianName(e.target.value)}
      placeholder="e.g. Dr. Sarah Lee"
      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
    />
  </div>
</div>
```

- [ ] **Step 4: Run full test suite**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add components/CreatePatientForm.tsx tests/patient-api.test.ts && git commit -m "feat: add Medicare number and physician name to patient creation form"
```

---

## Chunk 2: Layout Refactor — Extract, Rewire, Rearrange

### Task 3: Refactor CreateEpisodeForm and EpisodesSection

**Files:**
- Modify: `components/CreateEpisodeForm.tsx`
- Modify: `components/EpisodesSection.tsx`
- Modify: `tests/episode-form.test.tsx`

These two component changes must land together — after `CreateEpisodeForm` drops `onCreated`, `EpisodesSection` must immediately stop passing it.

- [ ] **Step 1: Update `tests/episode-form.test.tsx` — rewrite CreateEpisodeForm tests**

The four `CreateEpisodeForm` tests currently pass an `onCreated` prop that will be removed. Replace the entire `describe("CreateEpisodeForm")` block:

```typescript
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
```

Add these two lines at the **module scope** (outside any `describe` or `beforeEach`), near the top of the file alongside the existing `const mockFetch = jest.fn()` declaration. Jest hoists `jest.mock` calls automatically regardless of where they appear in the file, but keeping them at module scope is conventional.

Then update all four tests inside `describe("CreateEpisodeForm")` — remove `const onCreated = jest.fn()` from each test and remove `onCreated={onCreated}` from every `render(...)` call. Update the success test to assert `mockRefresh` was called:

```typescript
describe("CreateEpisodeForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRefresh.mockReset();
  });

  test("renders the Add Patient Visit button initially", () => {
    render(<CreateEpisodeForm patients={patients} />);
    expect(screen.getByText("+ Add Patient Visit")).toBeInTheDocument();
  });

  test("shows form fields when button is clicked", () => {
    render(<CreateEpisodeForm patients={patients} />);
    fireEvent.click(screen.getByText("+ Add Patient Visit"));

    expect(screen.getByLabelText("Patient")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for Visit")).toBeInTheDocument();
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
  });

  test("submits form with valid data and calls router.refresh", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "ep1", reason: "Back pain", startDate: "2026-02-22" }),
    });

    render(<CreateEpisodeForm patients={patients} />);
    fireEvent.click(screen.getByText("+ Add Patient Visit"));

    fireEvent.change(screen.getByLabelText("Patient"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Reason for Visit"), {
      target: { value: "Back pain" },
    });

    fireEvent.click(screen.getByText("Add Visit"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/episodes", expect.objectContaining({
        method: "POST",
      }));
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  test("shows error message on failed submission", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Patient not found" }),
    });

    render(<CreateEpisodeForm patients={patients} />);
    fireEvent.click(screen.getByText("+ Add Patient Visit"));

    fireEvent.change(screen.getByLabelText("Patient"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Reason for Visit"), {
      target: { value: "Back pain" },
    });

    fireEvent.click(screen.getByText("Add Visit"));

    await waitFor(() => {
      expect(screen.getByText("Patient not found")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage tests/episode-form.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `onCreated` prop still required by the current component.

- [ ] **Step 3: Update `components/CreateEpisodeForm.tsx`**

Remove the `onCreated` prop from the interface and add `useRouter`:

```typescript
import { useState } from "react";
import { useRouter } from "next/navigation";

interface CreateEpisodeFormProps {
  patients: Patient[];
}

export default function CreateEpisodeForm({ patients }: CreateEpisodeFormProps) {
  const router = useRouter();
  // ... rest of existing state
```

In `handleSubmit`, replace the block after `if (!res.ok)` check with:

```typescript
// Remove:
const episode = await res.json();
onCreated(episode);
setOpen(false);
setPatientId("");
setReason("");
setStartDate(new Date().toISOString().split("T")[0]);

// Replace with:
router.refresh();
setOpen(false);
setPatientId("");
setReason("");
setStartDate(new Date().toISOString().split("T")[0]);
```

- [ ] **Step 4: Run CreateEpisodeForm tests**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage tests/episode-form.test.tsx 2>&1 | tail -15
```

Expected: all 4 CreateEpisodeForm tests PASS.

- [ ] **Step 5: Update `components/EpisodesSection.tsx`**

Make four changes:

1. Remove the `import CreateEpisodeForm from "./CreateEpisodeForm"` line at the top.

2. Remove the `patients` prop from the interface and destructuring:

```typescript
// Remove from interface:
interface EpisodesSectionProps {
  initialEpisodes: Episode[];
  // patients: Patient[];   ← delete this line
  clinicTier?: string;
}

// Remove from destructuring:
export default function EpisodesSection({
  initialEpisodes,
  // patients,              ← delete this line
  clinicTier,
}: EpisodesSectionProps) {
```

3. Remove the `handleEpisodeCreated` function (lines 61-64 in the current file):

```typescript
// Delete this entire function:
function handleEpisodeCreated(episode: { id: string; reason: string; startDate: string }) {
  refreshEpisodes();
  void episode;
}
```

4. Replace the `<CreateEpisodeForm>` JSX in the return (inside the flex row at the top of the component):

```tsx
// Remove:
<CreateEpisodeForm patients={patients} onCreated={handleEpisodeCreated} />

// The div that wraps it becomes:
<div className="flex items-center justify-between">
  <h2 className="text-sm text-[var(--kinetic-dark)]">
    Patient Visits
  </h2>
</div>
```

- [ ] **Step 6: Run full test suite**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass. (The dashboard page still passes `patients` to EpisodesSection — that TypeScript error will be fixed in Task 4 when the dashboard is updated.)

If TypeScript errors from the old `patients` prop being passed in `dashboard/page.tsx` cause test failures, proceed to Task 4 immediately and fix them together.

- [ ] **Step 7: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add components/CreateEpisodeForm.tsx components/EpisodesSection.tsx tests/episode-form.test.tsx && git commit -m "refactor: extract CreateEpisodeForm from EpisodesSection, use router.refresh on episode creation"
```

---

### Task 4: Restructure dashboard page layout

**Files:**
- Modify: `app/(routes)/dashboard/page.tsx`

No new tests — the server component renders static structure. Existing routing tests are unaffected.

- [ ] **Step 1: Read the current `app/(routes)/dashboard/page.tsx`** to confirm line numbers before editing.

- [ ] **Step 2: Extract `myClinic` as a named variable**

The access bar currently uses an IIFE. Replace it with named variables computed once and reused. Add these lines after the `Promise.all` destructuring:

```typescript
const myClinic = clinics.find((c) => c.id === clinicId);
const tier = myClinic ? determineTier(myClinic.accessPercent) : null;
const style = tier ? TIER_STYLES[tier] : null;
const barColor = tier === "full" ? "bg-green-500"
  : tier === "limited" ? "bg-yellow-500"
  : tier === "minimal" ? "bg-orange-500"
  : "bg-red-400";
```

- [ ] **Step 3: Rewrite the JSX return block**

Replace the entire `return (...)` with the new layout. Key changes:
1. Access progress card is the **first element** in the return, before the header.
2. Header no longer has `justify-between` / `<CreatePatientForm />` in the top-right.
3. A `grid grid-cols-2 gap-4 mb-8` row follows the header, containing `<CreatePatientForm />` (left) and `<CreateEpisodeForm patients={patients} />` (right).
4. `<EpisodesSection>` no longer receives a `patients` prop.

```tsx
return (
  <div>
    {/* Access Progress Bar — top of page */}
    {myClinic && tier && style && (
      <div className="bg-white rounded-lg shadow-sm p-4 mb-8" data-testid="access-progress-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm text-[var(--kinetic-dark)]">Your Access Level</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`} data-testid="tier-label">
              {style.label}
            </span>
          </div>
          <span className="text-sm font-medium text-[var(--kinetic-dark)]" data-testid="access-percent">{myClinic.accessPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5" data-testid="progress-bar">
          <div className={`${barColor} h-2.5 rounded-full transition-all`} style={{ width: `${myClinic.accessPercent}%` }}></div>
        </div>
        <p className="text-xs text-[var(--kinetic-gray)] mt-2">
          Access decays 1% per day. Earn points by contributing clinical updates.
        </p>
      </div>
    )}

    {/* Header */}
    <div className="mb-6">
      <h1 className="text-xl text-[var(--kinetic-dark)]">
        Shared Patient History
      </h1>
      <p className="text-sm text-[var(--kinetic-gray)] mt-1">
        Access shared patient history by contributing updates.
      </p>
    </div>

    {/* Two-column form row */}
    <div className="grid grid-cols-2 gap-4 mb-8">
      <CreatePatientForm />
      <CreateEpisodeForm patients={patients} />
    </div>

    {/* Patient Visits Section */}
    <div className="mb-8">
      <EpisodesSection
        initialEpisodes={serializedEpisodes}
        clinicTier={myClinic ? determineTier(myClinic.accessPercent) : "inactive"}
      />
    </div>

    {/* Clinics Table */}
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm text-[var(--kinetic-dark)]">
          Clinics
        </h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Clinic Name
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Opt-in Status
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Access Tier
            </th>
          </tr>
        </thead>
        <tbody>
          {clinics.map((clinic) => {
            const clinicTierVal = determineTier(clinic.accessPercent);
            const clinicStyle = TIER_STYLES[clinicTierVal];
            return (
              <tr key={clinic.id} className="border-b border-gray-50 last:border-b-0">
                <td className="px-4 py-3 text-sm text-[var(--kinetic-dark)]">
                  {clinic.name}
                </td>
                <td className="px-4 py-3">
                  {isAdmin || clinic.id === clinicId ? (
                    <ClinicOptInToggle
                      clinicId={clinic.id}
                      initialOptedIn={clinic.optedIn}
                    />
                  ) : (
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium w-24 ${
                        clinic.optedIn
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {clinic.optedIn ? "Opted In" : "Not Opted In"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${clinicStyle.bg} ${clinicStyle.text}`}>
                    {clinicStyle.label}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {clinic.accessPercent}%
                  </span>
                </td>
              </tr>
            );
          })}
          {clinics.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-sm text-center text-[var(--kinetic-gray)]">
                No clinics found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Patient Management */}
    <PatientManagement
      patients={patients.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phoneNumber: p.phoneNumber,
        treatmentCompletedAt: p.treatmentCompletedAt?.toISOString() ?? null,
        episodeCount: p._count.episodes,
      }))}
    />

    {/* Patient Consent */}
    <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-8">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm text-[var(--kinetic-dark)]">
          Patient Consent
        </h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Patient Name
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Sharing Status
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id} className="border-b border-gray-50 last:border-b-0">
              <td className="px-4 py-3 text-sm text-[var(--kinetic-dark)]">
                {patient.firstName} {patient.lastName}
              </td>
              <td className="px-4 py-3">
                <ConsentToggle
                  patientId={patient.id}
                  patientName={`${patient.firstName} ${patient.lastName}`}
                  initialConsent={patient.consentStatus}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
```

Also add the `CreateEpisodeForm` import at the top of the file:

```typescript
import CreateEpisodeForm from "@/components/CreateEpisodeForm";
```

- [ ] **Step 4: Run full test suite**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add "app/(routes)/dashboard/page.tsx" && git commit -m "feat: move access bar to top, two-column form row on dashboard"
```

- [ ] **Step 6: Push to Vercel**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git push origin main 2>&1
```

Expected: push succeeds, Vercel deployment triggered.
