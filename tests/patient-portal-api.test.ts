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
