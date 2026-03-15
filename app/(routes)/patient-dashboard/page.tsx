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
