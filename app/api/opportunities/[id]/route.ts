import { NextRequest, NextResponse } from "next/server";
import { getFounder, getOpportunity, latestAxes, latestRunLog, listClaims, listEvidence } from "@/lib/model";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = getOpportunity(Number(id));
  if (!opp) return NextResponse.json({ error: "not found" }, { status: 404 });
  const founder = opp.founder_id ? getFounder(opp.founder_id) : null;
  return NextResponse.json({
    opportunity: opp,
    founder,
    claims: listClaims(opp.id),
    evidence: listEvidence(opp.id),
    axes: latestAxes(opp.id),
    log: latestRunLog(opp.id),
  });
}
