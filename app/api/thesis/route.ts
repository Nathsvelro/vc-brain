import { NextRequest, NextResponse } from "next/server";
import { getThesis, setThesis, type ThesisConfig } from "@/lib/thesis";

export async function GET() {
  return NextResponse.json(getThesis());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ThesisConfig;
  if (!body?.fund_name || !Array.isArray(body.sectors)) {
    return NextResponse.json({ error: "invalid thesis config" }, { status: 400 });
  }
  setThesis(body);
  return NextResponse.json({ ok: true });
}
