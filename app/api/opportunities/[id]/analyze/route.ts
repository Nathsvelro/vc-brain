import { NextRequest, NextResponse } from "next/server";
import { getOpportunity, latestRunLog } from "@/lib/model";
import { analyzeOpportunity } from "@/lib/pipeline/run";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = getOpportunity(Number(id));
  if (!opp) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ status: opp.status, log: latestRunLog(opp.id) });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = getOpportunity(Number(id));
  if (!opp) return NextResponse.json({ error: "not found" }, { status: 404 });
  void analyzeOpportunity(opp.id).catch((err) => console.error("re-analysis failed:", err));
  return NextResponse.json({ ok: true });
}
