/**
 * Tests for POST /api/updates/categorise
 *
 * Verifies:
 * - Auth guard (401 without session)
 * - Validation (400 for short text)
 * - Calls Anthropic and returns rewritten text
 * - Returns original text unchanged on Anthropic error (500)
 */

import "./helpers/polyfills";

const mockMessagesCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/updates/categorise/route";

const mockAuth = auth as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/updates/categorise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/updates/categorise", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockMessagesCreate.mockReset();
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ text: "strengthening exercises" }) as never);
    expect(res.status).toBe(401);
  });

  test("returns 400 when text is too short", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "clinician" } });
    const res = await POST(makeRequest({ text: "ab" }) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Text too short");
  });

  test("returns 400 when text is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "clinician" } });
    const res = await POST(makeRequest({ text: "" }) as never);
    expect(res.status).toBe(400);
  });

  test("calls Anthropic and returns rewritten text", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "clinician" } });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Exercise therapy targeting knee strength and mobility" }],
    });

    const res = await POST(makeRequest({ text: "strengthening exercises for the knee" }) as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rewritten).toBe("Exercise therapy targeting knee strength and mobility");
  });

  test("passes original text to Anthropic prompt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "clinician" } });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Manual therapy to address joint stiffness and soft tissue restriction" }],
    });

    await POST(makeRequest({ text: "soft tissue massage and joint mobilisation" }) as never);

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("soft tissue massage and joint mobilisation"),
          }),
        ]),
      })
    );
  });

  test("prompt includes all 12 category names", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "clinician" } });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Exercise therapy for balance improvement" }],
    });

    await POST(makeRequest({ text: "balance training" }) as never);

    const callArg = mockMessagesCreate.mock.calls[0][0];
    const content = callArg.messages[0].content as string;

    expect(content).toContain("Exercise therapy");
    expect(content).toContain("Manual therapy");
    expect(content).toContain("Pain management treatments");
    expect(content).toContain("Musculoskeletal rehabilitation");
    expect(content).toContain("Sports physiotherapy treatments");
    expect(content).toContain("Post-operative rehabilitation");
    expect(content).toContain("Neurological physiotherapy");
    expect(content).toContain("Cardiorespiratory physiotherapy");
    expect(content).toContain("Pelvic health physiotherapy");
    expect(content).toContain("Hydrotherapy / aquatic physiotherapy");
    expect(content).toContain("Education and self-management");
    expect(content).toContain("Assistive support and external aids");
  });

  test("trims whitespace from returned text", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "clinician" } });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "  Exercise therapy for lumbar stabilisation  " }],
    });

    const res = await POST(makeRequest({ text: "lumbar stabilisation exercises" }) as never);
    const data = await res.json();
    expect(data.rewritten).toBe("Exercise therapy for lumbar stabilisation");
  });
});
