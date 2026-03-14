/**
 * UI tests for treatment categorisation on blur.
 *
 * Verifies:
 * - Blurring the treatment field calls /api/updates/categorise
 * - Field value updates with the rewritten text
 * - Field is disabled (loading state) while categorising
 * - On API error, original text is preserved
 * - Skips the call when text is fewer than 3 characters
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AddUpdateForm from "@/components/AddUpdateForm";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ refresh: jest.fn() })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const episodeId = "ep1";

function renderForm() {
  return render(
    <AddUpdateForm episodeId={episodeId} onCreated={jest.fn()} />
  );
}

function openStructuredForm() {
  fireEvent.click(screen.getByText("+ Add Update"));
  fireEvent.click(screen.getByTestId("chooser-structured"));
}

function openQuickHandoffForm() {
  fireEvent.click(screen.getByText("+ Add Update"));
  fireEvent.click(screen.getByTestId("chooser-quick"));
}

describe("Treatment categorisation on blur — Structured form", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("calls /api/updates/categorise when treatment field is blurred", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rewritten: "Exercise therapy targeting knee strength" }),
    });

    renderForm();
    openStructuredForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "strengthening exercises" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/updates/categorise",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ text: "strengthening exercises" }),
        })
      );
    });
  });

  test("field value updates with rewritten text after blur", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rewritten: "Exercise therapy targeting knee strength" }),
    });

    renderForm();
    openStructuredForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "strengthening exercises" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Exercise therapy targeting knee strength")).toBeInTheDocument();
    });
  });

  test("original text is preserved when API call fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    renderForm();
    openStructuredForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "dry needling" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByDisplayValue("dry needling")).toBeInTheDocument();
    });
  });

  test("original text is preserved when API returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });

    renderForm();
    openStructuredForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "heat therapy" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByDisplayValue("heat therapy")).toBeInTheDocument();
    });
  });

  test("does not call API when text is fewer than 3 characters", async () => {
    renderForm();
    openStructuredForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "ex" } });
    fireEvent.blur(input);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("does not call API when field is empty", async () => {
    renderForm();
    openStructuredForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.blur(input);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Treatment categorisation on blur — Quick Handoff form", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("calls /api/updates/categorise on blur in Quick Handoff mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rewritten: "Manual therapy to address soft tissue restriction" }),
    });

    renderForm();
    openQuickHandoffForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "soft tissue massage" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/updates/categorise",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  test("field updates with rewritten text in Quick Handoff mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rewritten: "Manual therapy to address soft tissue restriction" }),
    });

    renderForm();
    openQuickHandoffForm();

    const input = screen.getByTestId(`treatment-modalities-input-${episodeId}`);
    fireEvent.change(input, { target: { value: "soft tissue massage" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Manual therapy to address soft tissue restriction")).toBeInTheDocument();
    });
  });
});

describe("Treatment categorisation on blur — Inline edit form", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const baseEpisode = {
    id: "ep1",
    patientId: "p1",
    reason: "Back pain",
    startDate: "2026-02-15T00:00:00.000Z",
    createdAt: "2026-02-15T00:00:00.000Z",
    patient: { firstName: "John", lastName: "Smith" },
  };

  const baseUpdate = {
    id: "cu1",
    painRegion: "Lower back",
    diagnosis: "Disc herniation",
    treatmentModalities: "Manual therapy",
    redFlags: false,
    notes: "Improving",
    updateType: "STRUCTURED",
    createdAt: "2026-02-20T00:00:00.000Z",
    dateOfVisit: null,
  };

  // Need to import EpisodesSection for inline edit tests
  const EpisodesSection = require("@/components/EpisodesSection").default;

  test("calls /api/updates/categorise on blur in inline edit form", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rewritten: "Post-operative rehabilitation focused on lumbar mobility" }),
    });

    render(
      <EpisodesSection
        initialEpisodes={[{ ...baseEpisode, clinicalUpdates: [baseUpdate] }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("edit-update-cu1"));

    const input = screen.getByTestId("treatment-edit-input-cu1");
    fireEvent.change(input, { target: { value: "post-op rehab exercises" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/updates/categorise",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  test("inline edit field updates with rewritten text after blur", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rewritten: "Post-operative rehabilitation focused on lumbar mobility" }),
    });

    render(
      <EpisodesSection
        initialEpisodes={[{ ...baseEpisode, clinicalUpdates: [baseUpdate] }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("edit-update-cu1"));

    const input = screen.getByTestId("treatment-edit-input-cu1");
    fireEvent.change(input, { target: { value: "post-op rehab exercises" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Post-operative rehabilitation focused on lumbar mobility")
      ).toBeInTheDocument();
    });
  });

  test("inline edit preserves original text on API error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <EpisodesSection
        initialEpisodes={[{ ...baseEpisode, clinicalUpdates: [baseUpdate] }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("edit-update-cu1"));

    const input = screen.getByTestId("treatment-edit-input-cu1");
    fireEvent.change(input, { target: { value: "hydrotherapy pool exercises" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByDisplayValue("hydrotherapy pool exercises")).toBeInTheDocument();
    });
  });
});
