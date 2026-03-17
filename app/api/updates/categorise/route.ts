import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const CATEGORY_LABELS: Record<number, string> = {
  1: "Employed Exercise Therapy",
  2: "Employed Manual Therapy",
  3: "Employed Pain Management Strategies",
  4: "Employed Musculoskeletal Rehabilitation",
  5: "Employed Sports Physiotherapy",
  6: "Employed Post-operative Rehabilitation",
  7: "Employed Neurological Physiotherapy",
  8: "Employed Cardiorespiratory Physiotherapy",
  9: "Employed Pelvic Health Physiotherapy",
  10: "Employed Hydrotherapy",
  11: "Employed Education and Self-management",
  12: "Employed Assistive Support",
};

// Keyword → category number. Checked case-insensitively via substring match.
const KEYWORD_MAP: Array<[string, number]> = [
  // 1. Exercise therapy
  ["strengthening exercise", 1],
  ["mobility exercise", 1],
  ["flexibility exercise", 1],
  ["stretching", 1],
  ["balance and coordination", 1],
  ["endurance", 1],
  ["postural correction", 1],
  ["functional retraining", 1],

  // 2. Manual therapy
  ["joint mobilisation", 2],
  ["joint mobilization", 2],
  ["joint manipulation", 2],
  ["soft tissue massage", 2],
  ["myofascial release", 2],
  ["trigger point", 2],
  ["passive stretching", 2],
  ["manual traction", 2],

  // 3. Pain management
  ["heat therapy", 3],
  ["ice therapy", 3],
  ["tens", 3],
  ["electrical stimulation", 3],
  ["dry needling", 3],
  ["acupuncture", 3],
  ["relaxation", 3],
  ["breathing technique", 3],
  ["graded exposure", 3],

  // 4. Musculoskeletal rehabilitation
  ["injury-specific rehab", 4],
  ["tendon loading", 4],
  ["return-to-work", 4],
  ["movement retraining", 4],
  ["joint stability", 4],
  ["musculoskeletal", 4],

  // 5. Sports physiotherapy
  ["acute injury", 5],
  ["strength and conditioning", 5],
  ["biomechanical assessment", 5],
  ["running gait", 5],
  ["return-to-sport", 5],
  ["taping and strapping", 5],
  ["injury prevention", 5],
  ["sports physio", 5],

  // 6. Post-operative rehabilitation
  ["post-operative", 6],
  ["postoperative", 6],
  ["range-of-motion recovery", 6],
  ["swelling reduction", 6],
  ["scar management", 6],
  ["strength rebuilding", 6],
  ["gait retraining", 6],
  ["progressive function restoration", 6],

  // 7. Neurological physiotherapy
  ["gait training", 7],
  ["balance retraining", 7],
  ["coordination exercise", 7],
  ["neuroplasticity", 7],
  ["vestibular rehab", 7],
  ["neurological physio", 7],

  // 8. Cardiorespiratory physiotherapy
  ["breathing exercise", 8],
  ["airway clearance", 8],
  ["chest physiotherapy", 8],
  ["chest physio", 8],
  ["pulmonary rehabilitation", 8],
  ["pulmonary rehab", 8],
  ["exercise tolerance", 8],
  ["cardiorespiratory", 8],

  // 9. Pelvic health
  ["pelvic floor", 9],
  ["pregnancy-related", 9],
  ["postpartum", 9],
  ["incontinence", 9],
  ["pelvic pain", 9],
  ["pelvic health", 9],

  // 10. Hydrotherapy
  ["hydrotherapy", 10],
  ["aquatic physio", 10],
  ["pool exercise", 10],
  ["pool setting", 10],
  ["low-impact strengthening", 10],

  // 11. Education and self-management
  ["pain education", 11],
  ["activity modification", 11],
  ["ergonomic advice", 11],
  ["posture advice", 11],
  ["home exercise program", 11],
  ["load management", 11],
  ["self-management", 11],

  // 12. Assistive support
  ["bracing", 12],
  ["splinting", 12],
  ["crutches", 12],
  ["walking aid", 12],
  ["orthotics", 12],
  ["kinesiology tape", 12],
  ["assistive", 12],
];

function classify(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, categoryNum] of KEYWORD_MAP) {
    if (lower.includes(keyword)) {
      return CATEGORY_LABELS[categoryNum];
    }
  }
  // No match — return free text as-is
  return text;
}

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

  const rewritten = classify(text);
  return NextResponse.json({ rewritten });
}
