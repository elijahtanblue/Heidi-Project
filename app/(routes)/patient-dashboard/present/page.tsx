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
        <h1 className="text-2xl text-[var(--kinetic-dark)]">Present to Physio</h1>
        <p className="text-sm text-[var(--kinetic-gray)] mt-1">
          Hand your device to your physiotherapist to fill in this form.
        </p>
      </div>
      <PatientPresentForm />
    </div>
  );
}
