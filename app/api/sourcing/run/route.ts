import { NextRequest, NextResponse } from "next/server";
import { runPlay } from "@/lib/sourcing/plays";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { play?: { title: string; rationale: string; queries: string[] } };
  if (!body.play?.queries?.length) return NextResponse.json({ error: "play with queries required" }, { status: 400 });
  try {
    const result = await runPlay(body.play);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
