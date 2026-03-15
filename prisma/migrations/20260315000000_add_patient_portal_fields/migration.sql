-- AlterTable: add patientRecordId to User
ALTER TABLE "User" ADD COLUMN "patientRecordId" TEXT;

-- CreateIndex: unique constraint on patientRecordId
CREATE UNIQUE INDEX "User_patientRecordId_key" ON "User"("patientRecordId");

-- AlterTable: add patient portal fields to ClinicalUpdate
ALTER TABLE "ClinicalUpdate" ADD COLUMN "patientSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicalUpdate" ADD COLUMN "submittingClinicName" TEXT;
ALTER TABLE "ClinicalUpdate" ADD COLUMN "submittingCarerName" TEXT;
