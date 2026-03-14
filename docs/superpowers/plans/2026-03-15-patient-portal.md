# Patient Portal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight patient-facing portal to the existing app where patients log in, view their full treatment history, and present a form to their physiotherapist to fill in on the spot.

**Architecture:** New `patient` role uses the existing auth system. A `patientRecordId` on `User` links patient accounts to their `Patient` record. A dedicated `POST /api/patient/present` endpoint handles episode + update creation for patient-submitted forms, bypassing the clinician-specific existing endpoints. The patient dashboard reuses `EpisodesSection` directly.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Neon adapter), NextAuth v5, Tailwind CSS v4, Jest + Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `patientRecordId` to `User`; add 3 fields to `ClinicalUpdate` |
| `lib/auth.ts` | Modify | Pass `patientRecordId` through JWT and session callbacks |
| `prisma/seed.ts` | Modify | Add `johnsmith@patient.com` patient user |
| `app/api/patient/present/route.ts` | Create | Patient portal submission (episode + update in one transaction) |
| `app/api/episodes/route.ts` | Modify | Filter episodes by `patientId` when role is `patient` |
| `app/(routes)/patient-dashboard/page.tsx` | Create | Patient history server component |
| `app/(routes)/patient-dashboard/present/page.tsx` | Create | Physio-fill form server component wrapper |
| `components/PatientPresentForm.tsx` | Create | Client form component for physio to fill in |
| `components/EpisodesSection.tsx` | Modify | Display `submittingClinicName`/`submittingCarerName` for patient-submitted updates |
| `app/(routes)/dashboard/page.tsx` | Modify | Redirect `patient` role to `/patient-dashboard` |
| `tests/patient-portal-api.test.ts` | Create | API tests for `POST /api/patient/present` |
| `tests/patient-portal-routing.test.ts` | Create | Routing/auth guard tests |
| `tests/patient-portal.test.tsx` | Create | UI tests for patient dashboard + form |

---

## Chunk 1: Schema, Migration, and Seed

### Task 1: Add schema fields and run migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add `patientRecordId` to `User` model**

Open `prisma/schema.prisma`. In the `User` model, add after the `updatedAt` field:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("clinician")
  clinicId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  patientRecordId String? @unique    // ← ADD THIS

  clinic           Clinic            @relation(fields: [clinicId], references: [id])
  episodes         Episode[]
  clinicalUpdates  ClinicalUpdate[]
  simulationEvents SimulationEvent[]
}
```

- [ ] **Step 2: Add three fields to `ClinicalUpdate` model**

In the same `schema.prisma`, in the `ClinicalUpdate` model, add after `updatedAt`:

```prisma
  patientSubmitted      Boolean  @default(false)
  submittingClinicName  String?
  submittingCarerName   String?
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name add-patient-portal-fields
```

Expected: migration file created, client regenerated, no errors.

- [ ] **Step 3b: Add `patientRecordId` to the NextAuth session**

Open `lib/auth.ts`. The `authorize` callback, `jwt` callback, and `session` callback all need updating so `patientRecordId` flows through to `session.user`.

In `authorize`, add `patientRecordId` to the return object:

```ts
return {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  clinicId: user.clinicId,
  clinicName: user.clinic.name,
  patientRecordId: user.patientRecordId ?? null,  // ← ADD
};
```

In the `jwt` callback, add:

```ts
token.patientRecordId = u.patientRecordId ?? null;  // ← ADD (after existing token.clinicName line)
```

In the `session` callback, add:

```ts
u.patientRecordId = token.patientRecordId;  // ← ADD (after existing u.clinicName line)
```

- [ ] **Step 4: Update the seed — add patient user**

Open `prisma/seed.ts`. After the existing `clinicD` / `coachsuemay` user block, add a patient user. John Smith's patient record is created later in the seed — you need to create the patient user *after* the patient record is created. Find where `johnSmith` patient is created and add the user immediately after:

```ts
// After: const johnSmith = await prisma.patient.create({ ... })
const patientUserPasswordHash = await hash("password123", 12);
await prisma.user.create({
  data: {
    email: "johnsmith@patient.com",
    password: patientUserPasswordHash,
    name: "John Smith",
    role: "patient",
    clinicId: clinicA.id,          // home clinic (City Physio)
    patientRecordId: johnSmith.id, // links to Patient record
  },
});
```

Also update the seed completion log line from `3 users` to `4 users` (or `5 users` — count what's in the seed).

- [ ] **Step 5: Re-seed the database**

```bash
npx prisma db seed
```

Expected: completes without error. New `johnsmith@patient.com` user exists in DB.

- [ ] **Step 6: Update seed integrity test**

Open `tests/seed-integrity.test.ts`. Find the assertion that checks user count and increment it by 1 (adds the new patient user). Also check if there's a role assertion and update if needed.

- [ ] **Step 7: Run seed tests to verify**

```bash
npx jest --no-coverage tests/seed-integrity.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/migrations/ lib/auth.ts tests/seed-integrity.test.ts
git commit -m "feat: add patient portal schema fields, auth session, and seed patient user"
```

---

## Chunk 2: POST /api/patient/present Endpoint

### Task 2: Write and implement the patient submission endpoint

**Files:**
- Create: `app/api/patient/present/route.ts`
- Create: `tests/patient-portal-api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/patient-portal-api.test.ts`:

```ts
/**
 * API tests for POST /api/patient/present
 * Verifies: auth checks, FK resolution, episode+update creation, field storage.
 */
import "@testing-library/jest-dom";

const mockUserFindUnique = jest.fn();
const mockPatientFindUnique = jest.fn();
const mockEpisodeCreate = jest.fn();
const mockUpdateCreate = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    user: { findUnique: mockUserFindUnique },
    patient: { findUnique: mockPatientFindUnique },
    episode: { create: mockEpisodeCreate },
    clinicalUpdate: { create: mockUpdateCreate },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({ auth: mockAuth }));

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/patient/present", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  submittingClinicName: "City Physio",
  submittingCarerName: "Dr. Jane",
  painRegion: "Lower back",
  diagnosis: "Lumbar strain",
  treatmentModalities: "Exercise therapy",
  redFlags: false,
  notesRaw: "Patient responded well",
  dateOfVisit: "2026-03-15",
};

describe("POST /api/patient/present", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockUserFindUnique.mockReset();
    mockPatientFindUnique.mockReset();
    mockEpisodeCreate.mockReset();
    mockUpdateCreate.mockReset();
  });

  test("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  test("returns 403 when role is clinician", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1", patientRecordId: null },
    });
    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  test("returns 403 when role is admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "admin", clinicId: "c1", patientRecordId: null },
    });
    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  test("returns 400 when patientRecordId is null", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: null },
    });
    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
  });

  test("returns 404 when patient record not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: "p-missing" },
    });
    mockPatientFindUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  test("creates episode and update, returns 201 with episodeId and updateId", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: "p1" },
    });
    mockPatientFindUnique.mockResolvedValue({ id: "p1", clinicId: "c1" });
    mockEpisodeCreate.mockResolvedValue({ id: "ep1" });
    mockUpdateCreate.mockResolvedValue({ id: "upd1" });

    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.episodeId).toBe("ep1");
    expect(json.updateId).toBe("upd1");
  });

  test("stores patientSubmitted: true and submitting fields on the update", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: "p1" },
    });
    mockPatientFindUnique.mockResolvedValue({ id: "p1", clinicId: "c1" });
    mockEpisodeCreate.mockResolvedValue({ id: "ep1" });
    mockUpdateCreate.mockResolvedValue({ id: "upd1" });

    const { POST } = await import("@/app/api/patient/present/route");
    await POST(makeRequest(validBody));

    expect(mockUpdateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientSubmitted: true,
          submittingClinicName: "City Physio",
          submittingCarerName: "Dr. Jane",
        }),
      })
    );
  });

  test("succeeds when treatmentModalities is omitted (defaults to empty string)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: "p1" },
    });
    mockPatientFindUnique.mockResolvedValue({ id: "p1", clinicId: "c1" });
    mockEpisodeCreate.mockResolvedValue({ id: "ep1" });
    mockUpdateCreate.mockResolvedValue({ id: "upd1" });

    // treatmentModalities not included — endpoint defaults to ""
    const { treatmentModalities: _omit, ...bodyNoTreatment } = validBody;
    void _omit;
    const { POST } = await import("@/app/api/patient/present/route");
    const res = await POST(makeRequest(bodyNoTreatment));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx jest --no-coverage tests/patient-portal-api.test.ts
```

Expected: FAIL — module not found for `@/app/api/patient/present/route`.

- [ ] **Step 3: Create the endpoint**

Create `app/api/patient/present/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  if (user.role !== "patient") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patientRecordId = user.patientRecordId as string | null;
  if (!patientRecordId) {
    return NextResponse.json({ error: "No patient record linked to this account" }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientRecordId } });
  if (!patient) {
    return NextResponse.json({ error: "Patient record not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    submittingClinicName,
    submittingCarerName,
    painRegion,
    diagnosis,
    treatmentModalities,
    redFlags,
    notesRaw,
    dateOfVisit,
  } = body as Record<string, unknown>;

  // Sequential creates — no $transaction needed for demo
  const episode = await prisma.episode.create({
    data: {
      patientId: patient.id,
      clinicId: patient.clinicId,
      userId: user.id as string,
      reason: "Patient-presented consultation",
      startDate: dateOfVisit ? new Date(dateOfVisit as string) : new Date(),
    },
  });

  const update = await prisma.clinicalUpdate.create({
    data: {
      episodeId: episode.id,
      clinicId: patient.clinicId,
      userId: user.id as string,
      updateType: "STRUCTURED",
      painRegion: (painRegion as string) || "",
      diagnosis: (diagnosis as string) || "",
      treatmentModalities: (treatmentModalities as string) || "",
      redFlags: (redFlags as boolean) ?? false,
      notes: "",
      notesRaw: (notesRaw as string) || null,
      dateOfVisit: dateOfVisit ? new Date(dateOfVisit as string) : null,
      patientSubmitted: true,
      submittingClinicName: (submittingClinicName as string) || null,
      submittingCarerName: (submittingCarerName as string) || null,
    },
  });

  return NextResponse.json({ episodeId: episode.id, updateId: update.id }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage tests/patient-portal-api.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/patient/present/route.ts tests/patient-portal-api.test.ts
git commit -m "feat: add POST /api/patient/present endpoint"
```

---

## Chunk 3: GET /api/episodes — Patient Role Support

### Task 3: Filter episodes by patientId for patient-role users

**Files:**
- Modify: `app/api/episodes/route.ts`
- Modify: `tests/episode-api.test.ts`

The existing `GET /api/episodes` filters by `clinicId`. For patient users it must filter by `patientId` instead (using `session.user.patientRecordId`), so `EpisodesSection`'s refresh call returns only their own episodes.

- [ ] **Step 1: Add failing test for patient role GET**

Open `tests/episode-api.test.ts`. At the top, the existing mock for `auth` returns a clinician session. Add a new describe block at the bottom of the file:

```ts
describe("GET /api/episodes — patient role", () => {
  beforeEach(() => {
    // Override auth mock for these tests
    (require("@/lib/auth") as { auth: jest.Mock }).auth.mockResolvedValue({
      user: { id: "u-patient", role: "patient", clinicId: "c1", patientRecordId: "p1" },
    });
    mockEpisodeFindMany.mockReset();
  });

  test("filters episodes by patientId when role is patient", async () => {
    mockEpisodeFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/episodes/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockEpisodeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "p1" }),
      })
    );
  });

  test("returns 400 when patient has no patientRecordId", async () => {
    (require("@/lib/auth") as { auth: jest.Mock }).auth.mockResolvedValue({
      user: { id: "u-patient", role: "patient", clinicId: "c1", patientRecordId: null },
    });
    const { GET } = await import("@/app/api/episodes/route");
    const res = await GET();
    expect(res.status).toBe(400);
  });
});
```

Note: check the existing test file to see if `mockEpisodeFindMany` already exists as a mock — if the variable is named differently (e.g., `mockEpisodeCreate` only), add `const mockEpisodeFindMany = jest.fn();` and wire it to the mock PrismaClient at the top of the file.

- [ ] **Step 2: Run to verify new tests fail**

```bash
npx jest --no-coverage tests/episode-api.test.ts
```

Expected: new tests FAIL (GET doesn't branch on role yet).

- [ ] **Step 3: Update GET /api/episodes**

Open `app/api/episodes/route.ts`. Replace the existing `GET` export with:

```ts
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  // Patient role: return only this patient's episodes
  if (user.role === "patient") {
    const patientRecordId = user.patientRecordId as string | null;
    if (!patientRecordId) {
      return NextResponse.json({ error: "No patient record linked" }, { status: 400 });
    }
    const episodes = await prisma.episode.findMany({
      where: { patientId: patientRecordId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        clinicalUpdates: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(episodes);
  }

  // Clinician/admin role: return clinic's episodes (existing behaviour)
  const episodes = await prisma.episode.findMany({
    where: { clinicId: user.clinicId as string },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      clinicalUpdates: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(episodes);
}
```

- [ ] **Step 4: Run episode API tests**

```bash
npx jest --no-coverage tests/episode-api.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/episodes/route.ts tests/episode-api.test.ts
git commit -m "feat: filter episodes by patientId for patient-role users"
```

---

## Chunk 4: Patient Dashboard Pages and Routing Guards

### Task 4: Patient dashboard server component

**Files:**
- Create: `app/(routes)/patient-dashboard/page.tsx`
- Create: `app/(routes)/patient-dashboard/present/page.tsx`
- Modify: `app/(routes)/dashboard/page.tsx`
- Create: `tests/patient-portal-routing.test.ts`

- [ ] **Step 1: Write routing guard tests**

Create `tests/patient-portal-routing.test.ts`:

```ts
/**
 * Tests that role-based routing guards work correctly.
 * Patient → /patient-dashboard, clinician → /dashboard
 */
import "@testing-library/jest-dom";

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));
jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: { findMany: jest.fn(async () => []) },
    patient: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
    },
    episode: { findMany: jest.fn(async () => []) },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
jest.mock("next/navigation", () => ({ redirect: mockRedirect }));

describe("Dashboard page — role guards", () => {
  test("redirects patient role to /patient-dashboard", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: "p1" },
    });

    const { default: DashboardPage } = await import("@/app/(routes)/dashboard/page");
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/patient-dashboard");
  });
});

describe("Patient dashboard page — role guards", () => {
  test("redirects clinician role to /dashboard", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });

    const { default: PatientDashboardPage } = await import(
      "@/app/(routes)/patient-dashboard/page"
    );
    await expect(PatientDashboardPage()).rejects.toThrow("REDIRECT:/dashboard");
  });

  test("redirects to /login when no patientRecordId", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "patient", clinicId: "c1", patientRecordId: null },
    });

    const { default: PatientDashboardPage } = await import(
      "@/app/(routes)/patient-dashboard/page"
    );
    await expect(PatientDashboardPage()).rejects.toThrow("REDIRECT:/login");
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx jest --no-coverage tests/patient-portal-routing.test.ts
```

Expected: FAIL — patient-dashboard page doesn't exist yet.

- [ ] **Step 3: Add patient role redirect to dashboard/page.tsx**

Open `app/(routes)/dashboard/page.tsx`. At the top of the `DashboardPage` function, after getting the session/user, add:

```ts
// Redirect patient-role users to their own dashboard
if (user?.role === "patient") {
  redirect("/patient-dashboard");
}
```

Add the import at the top: `import { redirect } from "next/navigation";`

- [ ] **Step 4: Create patient dashboard page**

Create `app/(routes)/patient-dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import EpisodesSection from "@/components/EpisodesSection";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PatientDashboardPage() {
  const session = await auth();
  const user = session?.user as unknown as Record<string, unknown> | undefined;

  if (!user) redirect("/login");
  if (user.role !== "patient") redirect("/dashboard");

  const patientRecordId = user.patientRecordId as string | null;
  if (!patientRecordId) redirect("/login");

  const patient = await prisma.patient.findUnique({
    where: { id: patientRecordId },
    include: {
      episodes: {
        orderBy: { createdAt: "desc" },
        include: {
          clinicalUpdates: {
            orderBy: { createdAt: "desc" },
            include: { clinic: true, user: true },
          },
        },
      },
    },
  });

  if (!patient) redirect("/login");

  const patients = [{ id: patient.id, firstName: patient.firstName, lastName: patient.lastName }];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-sm text-[var(--kinetic-gray)] mt-1">Your treatment history</p>
        </div>
        <Link
          href="/patient-dashboard/present"
          className="px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
          data-testid="present-to-physio-btn"
        >
          Present to Physio
        </Link>
      </div>

      {patient.episodes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            No treatment history yet. Present your device to your physiotherapist to get started.
          </p>
        </div>
      ) : (
        <EpisodesSection
          initialEpisodes={patient.episodes as Parameters<typeof EpisodesSection>[0]["initialEpisodes"]}
          patients={patients}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the present page wrapper**

Create `app/(routes)/patient-dashboard/present/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PatientPresentForm from "@/components/PatientPresentForm";

export const dynamic = "force-dynamic";

export default async function PatientPresentPage() {
  const session = await auth();
  const user = session?.user as unknown as Record<string, unknown> | undefined;

  if (!user) redirect("/login");
  if (user.role !== "patient") redirect("/dashboard");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">Present to Physio</h1>
        <p className="text-sm text-[var(--kinetic-gray)] mt-1">
          Hand your device to your physiotherapist to fill in this form.
        </p>
      </div>
      <PatientPresentForm />
    </div>
  );
}
```

- [ ] **Step 6: Run routing tests**

```bash
npx jest --no-coverage tests/patient-portal-routing.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 7: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/(routes)/patient-dashboard/ app/(routes)/dashboard/page.tsx tests/patient-portal-routing.test.ts
git commit -m "feat: add patient dashboard pages and role-based routing guards"
```

---

## Chunk 5: PatientPresentForm Component

### Task 5: Build the physio-fill form

**Files:**
- Create: `components/PatientPresentForm.tsx`
- Create: `tests/patient-portal.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

Create `tests/patient-portal.test.tsx`:

```tsx
/**
 * UI tests for PatientPresentForm.
 * Verifies: fields render, submit payload, redirect on success, error on failure.
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

import PatientPresentForm from "@/components/PatientPresentForm";

describe("PatientPresentForm", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
    mockPush.mockReset();
  });

  test("renders clinic name and carer name fields", () => {
    render(<PatientPresentForm />);
    expect(screen.getByLabelText(/clinic name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/physio \/ carer name/i)).toBeInTheDocument();
  });

  test("renders all clinical fields", () => {
    render(<PatientPresentForm />);
    expect(screen.getByLabelText(/where was the patient treated/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what was the diagnosis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what treatment was provided/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/red flag noted/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/additional notes/i)).toBeInTheDocument();
  });

  test("on submit: calls POST /api/patient/present with patientSubmitted: true", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ episodeId: "ep1", updateId: "upd1" }),
    });

    render(<PatientPresentForm />);

    fireEvent.change(screen.getByLabelText(/clinic name/i), {
      target: { value: "City Physio" },
    });
    fireEvent.change(screen.getByLabelText(/physio \/ carer name/i), {
      target: { value: "Dr. Jane" },
    });
    fireEvent.change(screen.getByLabelText(/where was the patient treated/i), {
      target: { value: "Lower back" },
    });
    fireEvent.change(screen.getByLabelText(/what was the diagnosis/i), {
      target: { value: "Lumbar strain" },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/patient/present",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"patientSubmitted":true'),
        })
      );
    });
  });

  test("redirects to /patient-dashboard on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ episodeId: "ep1", updateId: "upd1" }),
    });

    render(<PatientPresentForm />);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/patient-dashboard");
    });
  });

  test("shows error message on API failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Something went wrong" }),
    });

    render(<PatientPresentForm />);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx jest --no-coverage tests/patient-portal.test.tsx
```

Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Create PatientPresentForm component**

Create `components/PatientPresentForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientPresentForm() {
  const router = useRouter();

  const [submittingClinicName, setSubmittingClinicName] = useState("");
  const [submittingCarerName, setSubmittingCarerName] = useState("");
  const [painRegion, setPainRegion] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentModalities, setTreatmentModalities] = useState("");
  const [redFlags, setRedFlags] = useState(false);
  const [notesRaw, setNotesRaw] = useState("");
  const [dateOfVisit, setDateOfVisit] = useState("");
  const [loading, setLoading] = useState(false);
  const [categorisingTx, setCategorisingTx] = useState(false);
  const [error, setError] = useState("");

  async function handleTreatmentBlur() {
    const text = treatmentModalities.trim();
    if (text.length < 3) return;
    setCategorisingTx(true);
    try {
      const res = await fetch("/api/updates/categorise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setTreatmentModalities(data.rewritten);
      }
    } catch {
      // keep original on error
    } finally {
      setCategorisingTx(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/patient/present", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientSubmitted: true,
          submittingClinicName,
          submittingCarerName,
          painRegion,
          diagnosis,
          treatmentModalities,
          redFlags,
          notesRaw,
          dateOfVisit,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Submission failed. Please try again.");
        return;
      }

      router.push("/patient-dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      {/* Physio-filled fields */}
      <div className="pb-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Physiotherapist fills in below
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="clinicName" className="block text-sm font-medium text-gray-700 mb-1">
              Clinic Name
            </label>
            <input
              id="clinicName"
              type="text"
              value={submittingClinicName}
              onChange={(e) => setSubmittingClinicName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. City Physio"
            />
          </div>
          <div>
            <label htmlFor="carerName" className="block text-sm font-medium text-gray-700 mb-1">
              Physio / Carer Name
            </label>
            <input
              id="carerName"
              type="text"
              value={submittingCarerName}
              onChange={(e) => setSubmittingCarerName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Dr. Jane Smith"
            />
          </div>
        </div>
      </div>

      {/* Clinical fields */}
      <div>
        <label htmlFor="dateOfVisit" className="block text-sm font-medium text-gray-700 mb-1">
          Date of Visit
        </label>
        <input
          id="dateOfVisit"
          type="date"
          value={dateOfVisit}
          onChange={(e) => setDateOfVisit(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="painRegion" className="block text-sm font-medium text-gray-700 mb-1">
          Where was the patient treated?
        </label>
        <input
          id="painRegion"
          type="text"
          value={painRegion}
          onChange={(e) => setPainRegion(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="e.g. Lower back, right knee"
        />
      </div>

      <div>
        <label htmlFor="diagnosis" className="block text-sm font-medium text-gray-700 mb-1">
          What was the diagnosis?
        </label>
        <input
          id="diagnosis"
          type="text"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="e.g. Lumbar strain, rotator cuff tear"
        />
      </div>

      <div>
        <label htmlFor="treatmentModalities" className="block text-sm font-medium text-gray-700 mb-1">
          What treatment was provided?
          {categorisingTx && (
            <span className="ml-2 text-xs text-[var(--kinetic-gold)]">Categorising...</span>
          )}
        </label>
        <input
          id="treatmentModalities"
          type="text"
          value={treatmentModalities}
          onChange={(e) => setTreatmentModalities(e.target.value)}
          onBlur={handleTreatmentBlur}
          disabled={categorisingTx}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
          placeholder="e.g. Strengthening exercises, manual therapy"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="redFlags"
          type="checkbox"
          checked={redFlags}
          onChange={(e) => setRedFlags(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="redFlags" className="text-sm font-medium text-gray-700">
          Red flag noted?
        </label>
      </div>

      <div>
        <label htmlFor="notesRaw" className="block text-sm font-medium text-gray-700 mb-1">
          Additional notes
        </label>
        <textarea
          id="notesRaw"
          value={notesRaw}
          onChange={(e) => setNotesRaw(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Any additional observations or notes"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" data-testid="form-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || categorisingTx}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
      >
        {loading ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run UI tests**

```bash
npx jest --no-coverage tests/patient-portal.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/PatientPresentForm.tsx tests/patient-portal.test.tsx app/(routes)/patient-dashboard/present/page.tsx
git commit -m "feat: add PatientPresentForm component and present page"
```

---

## Chunk 6: EpisodesSection — Display Patient-Submitted Fields

### Task 6: Show submittingClinicName / submittingCarerName in update cards

**Files:**
- Modify: `components/EpisodesSection.tsx`
- Modify: `tests/update-ui.test.tsx` (or create targeted test in `tests/patient-portal.test.tsx`)

- [ ] **Step 1: Add failing test**

Open `tests/patient-portal.test.tsx`. Add a new describe block at the bottom:

```tsx
import EpisodesSection from "@/components/EpisodesSection";

describe("EpisodesSection — patient-submitted display", () => {
  test("shows submittingClinicName and submittingCarerName for patient-submitted updates", () => {
    const episodes = [
      {
        id: "ep1",
        patientId: "p1",
        reason: "Patient-presented consultation",
        startDate: "2026-03-15T00:00:00.000Z",
        createdAt: "2026-03-15T00:00:00.000Z",
        patient: { firstName: "John", lastName: "Smith" },
        clinicalUpdates: [
          {
            id: "upd1",
            painRegion: "Lower back",
            diagnosis: "Lumbar strain",
            treatmentModalities: "Exercise therapy",
            redFlags: false,
            notes: "",
            updateType: "STRUCTURED",
            dateOfVisit: "2026-03-15T00:00:00.000Z",
            createdAt: "2026-03-15T00:00:00.000Z",
            patientSubmitted: true,
            submittingClinicName: "City Physio",
            submittingCarerName: "Dr. Jane",
          },
        ],
      },
    ];

    render(
      <EpisodesSection
        initialEpisodes={episodes as never}
        patients={[{ id: "p1", firstName: "John", lastName: "Smith" }]}
      />
    );

    expect(screen.getByText("City Physio")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jane")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify test fails**

```bash
npx jest --no-coverage tests/patient-portal.test.tsx
```

Expected: new test FAIL (EpisodesSection doesn't render these fields yet).

- [ ] **Step 3: Update EpisodesSection interface and rendering**

Open `components/EpisodesSection.tsx`.

Update the `ClinicalUpdate` interface to add the three new fields:

```ts
interface ClinicalUpdate {
  id: string;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags: boolean;
  notes: string;
  updateType?: string;
  precautions?: string | null;
  responsePattern?: string | null;
  suggestedNextSteps?: string | null;
  notesSummary?: string | null;
  dateOfVisit?: string | null;
  createdAt: string;
  patientSubmitted?: boolean;           // ← ADD
  submittingClinicName?: string | null; // ← ADD
  submittingCarerName?: string | null;  // ← ADD
}
```

Then find where the update card renders the clinic/user attribution (look for the update card in the JSX — it will likely show `createdAt` or clinician name). Add a conditional block that shows the submitting fields when `patientSubmitted` is true. Look for where each `ClinicalUpdate` is rendered and add below the existing attribution line:

```tsx
{update.patientSubmitted && (update.submittingClinicName || update.submittingCarerName) && (
  <div className="text-xs text-gray-500 mt-1">
    {update.submittingClinicName && <span>{update.submittingClinicName}</span>}
    {update.submittingClinicName && update.submittingCarerName && <span> · </span>}
    {update.submittingCarerName && <span>{update.submittingCarerName}</span>}
  </div>
)}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --no-coverage tests/patient-portal.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/EpisodesSection.tsx tests/patient-portal.test.tsx
git commit -m "feat: display submitting clinic/carer name for patient-submitted updates"
```

---

## Chunk 7: Final Push and Smoke Test

### Task 7: Push to Vercel and verify

- [ ] **Step 1: Run the full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: all tests PASS. Note the total count.

- [ ] **Step 2: Push to origin**

```bash
git push origin main
```

Expected: Vercel auto-deploys.

- [ ] **Step 3: Manual smoke test**

1. Log in as `johnsmith@patient.com` / `password123` → should land on `/patient-dashboard`
2. Verify patient name heading and "Present to Physio" button visible
3. Click "Present to Physio" → `/patient-dashboard/present` loads
4. Fill in clinic name, carer name, and a few clinical fields → Submit
5. Redirects to `/patient-dashboard`, new episode appears in history
6. Log in as `edsun@diversus.com` / `password123` → lands on `/dashboard` (not patient dashboard)

- [ ] **Step 4: Final commit message**

All changes have been committed incrementally. No final commit needed.
