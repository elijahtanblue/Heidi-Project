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
