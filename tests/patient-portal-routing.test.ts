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
