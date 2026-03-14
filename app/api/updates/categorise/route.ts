import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const CATEGORIES_PROMPT = `1. Exercise therapy: Strengthening exercises, Mobility and flexibility exercises, Stretching, Balance and coordination training, Endurance and conditioning, Postural correction exercises, Functional retraining
2. Manual therapy: Joint mobilisations, Joint manipulations, Soft tissue massage, Myofascial release, Trigger point therapy, Passive stretching, Manual traction
3. Pain management treatments: Heat therapy, Ice therapy, TENS or electrical stimulation, Dry needling, Acupuncture, Relaxation and breathing techniques, Graded exposure for pain-related movement fear
4. Musculoskeletal rehabilitation: Injury-specific rehab plans, Tendon loading programs, Return-to-work rehab, Movement retraining, Joint stability programs
5. Sports physiotherapy treatments: Acute injury management, Strength and conditioning support, Biomechanical assessment, Running gait analysis, Return-to-sport programming, Taping and strapping, Injury prevention programs
6. Post-operative rehabilitation: Range-of-motion recovery, Swelling reduction, Scar management, Strength rebuilding, Gait retraining, Progressive function restoration
7. Neurological physiotherapy: Gait training, Balance retraining, Coordination exercises, Functional movement retraining, Neuroplasticity-based rehab, Vestibular rehab for dizziness and vertigo
8. Cardiorespiratory physiotherapy: Breathing exercises, Airway clearance techniques, Chest physiotherapy, Pulmonary rehabilitation, Exercise tolerance training, Recovery after surgery or illness
9. Pelvic health physiotherapy: Pelvic floor muscle training, Pregnancy-related treatment, Postpartum rehab, Incontinence treatment, Pelvic pain management, Core and breathing retraining
10. Hydrotherapy / aquatic physiotherapy: Low-impact strengthening, Joint mobility work, Balance and gait training, Pain-reduced exercise in a pool setting
11. Education and self-management: Pain education, Activity modification, Ergonomic advice, Posture advice, Home exercise programs, Load management, Injury prevention strategies
12. Assistive support and external aids: Bracing, Splinting, Crutches or walking aids, Orthotics advice, Taping or kinesiology tape`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const text = (body.text as string)?.trim() ?? "";

  if (text.length < 3) {
    return NextResponse.json({ error: "Text too short" }, { status: 400 });
  }

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `You are a physiotherapy clinical documentation assistant. Rewrite the following treatment description using the most appropriate physiotherapy category from the list below.

The rewritten sentence must:
- Reference the category name naturally (e.g. "Exercise therapy targeting..." or "Manual therapy to address...")
- Preserve the clinical meaning of the original
- Be concise (max 20 words)
- Not copy the original phrasing verbatim

Categories:
${CATEGORIES_PROMPT}

Treatment description: "${text}"

Reply with ONLY the rewritten sentence. No explanation, no quotes, no extra punctuation.`,
      },
    ],
  });

  const rewritten = (message.content[0] as { type: string; text: string }).text.trim();
  return NextResponse.json({ rewritten });
}
