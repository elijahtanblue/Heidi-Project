import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { classifyTreatment } from "@/lib/classify";

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

  const rewritten = classifyTreatment(text);
  return NextResponse.json({ rewritten });
}
