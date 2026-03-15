import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSummary } from "@/domain/services/summarizer";

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

  const notesSummaryValue = notesRaw ? generateSummary(notesRaw as string) : null;

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
      notes: notesSummaryValue ?? "",
      notesRaw: (notesRaw as string) || null,
      notesSummary: notesSummaryValue || null,
      dateOfVisit: dateOfVisit ? new Date(dateOfVisit as string) : null,
      patientSubmitted: true,
      submittingClinicName: (submittingClinicName as string) || null,
      submittingCarerName: (submittingCarerName as string) || null,
    },
  });

  return NextResponse.json({ episodeId: episode.id, updateId: update.id }, { status: 201 });
}
