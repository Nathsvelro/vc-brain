import { NextRequest, NextResponse } from "next/server";
import { searchNL } from "@/lib/query/translate";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { q?: string };
  if (!body.q?.trim()) return NextResponse.json({ error: "q required" }, { status: 400 });
  try {
    const result = await searchNL(body.q.trim());
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
