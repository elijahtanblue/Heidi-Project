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

  test("shows network error message when fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network failure"));

    render(<PatientPresentForm />);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
