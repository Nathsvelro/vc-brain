import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_THESIS, getThesis, setThesis, type ThesisConfig } from "@/lib/thesis";

export async function GET() {
  return NextResponse.json(getThesis());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<ThesisConfig> | null;
  if (!body || typeof body.fund_name !== "string" || !body.fund_name.trim() || !Array.isArray(body.sectors)) {
    return NextResponse.json({ error: "invalid thesis config" }, { status: 400 });
  }
  // Deep-merge over the defaults so a partial payload can never persist a
  // config that later crashes thesisPrompt() mid-pipeline.
  const merged: ThesisConfig = {
    ...DEFAULT_THESIS,
    ...body,
    fund_name: body.fund_name.trim(),
    check_size_usd: { ...DEFAULT_THESIS.check_size_usd, ...(body.check_size_usd ?? {}) },
  };
  if (
    typeof merged.check_size_usd.min !== "number" ||
    typeof merged.check_size_usd.max !== "number" ||
    !Array.isArray(merged.stages) ||
    !Array.isArray(merged.geographies)
  ) {
    return NextResponse.json({ error: "invalid thesis config" }, { status: 400 });
  }
  setThesis(merged);
  return NextResponse.json({ ok: true });
}
