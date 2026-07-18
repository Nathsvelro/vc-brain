import { db } from "../db";
import { callStructured, MODEL_SMART } from "../openai";
import { AxesSchema } from "../schemas";
import { getThesis, thesisPrompt } from "../thesis";
import { getFounder, listClaims, listEvidence, type AxisScoreRow, type OpportunityRow } from "../model";

const SYSTEM = `You are the screening committee of a venture fund. Score this opportunity on THREE INDEPENDENT axes. Never average them; they are deliberately allowed to disagree — the disagreement is the signal an investor needs.

1. founder — who they are: traits and track record. The persistent Founder Score provided is ONE input; also weigh what this specific opportunity shows.
2. market — sizing, competition, timing: bullish / neutral / bear.
3. idea_market — does the idea AS PITCHED survive scrutiny in this market? If it does not, say so even when the team is excellent, and state in the rationale whether the team is strong enough to pivot.

For each axis: verdict (bullish/neutral/bear), score 0-100, confidence, a 2-3 sentence rationale, and the evidence ids that drove it. Trust the claim verification results: contradicted claims must hurt the relevant axis. Judge through the fund thesis provided.`;

export async function scoreAxes(opp: OpportunityRow): Promise<AxisScoreRow[]> {
  const thesis = getThesis();
  const claims = listClaims(opp.id);
  const evidence = listEvidence(opp.id);
  const founder = opp.founder_id ? getFounder(opp.founder_id) : undefined;

  const claimList = claims
    .map((c) => `- [${c.status}, trust ${c.trust_score ?? "?"}] (${c.category}) ${c.text}${c.verification_note ? ` — ${c.verification_note}` : ""}`)
    .join("\n");
  const evidenceList = evidence
    .map((e) => `[evidence ${e.id}] (${e.source_type}) ${e.title ?? ""} — ${(e.snippet ?? "").slice(0, 250)}`)
    .join("\n");
  const founderLine = founder
    ? `${founder.name} — persistent Founder Score ${founder.current_score ?? "?"} [${founder.score_low ?? "?"}-${founder.score_high ?? "?"}]${founder.cold_start ? " (cold start — wide uncertainty)" : ""}`
    : "unknown";

  const out = await callStructured(
    "axis_scores",
    AxesSchema,
    `Fund thesis:\n${thesisPrompt(thesis)}\n\nOpportunity: ${opp.company_name} — ${opp.one_liner}\nSector: ${opp.sector} · Geo: ${opp.geo} · Stage: ${opp.stage}\nFounder: ${founderLine}\n\nVerified claim results:\n${claimList}\n\nEvidence pool:\n${evidenceList}\n\nReturn exactly three axes: founder, market, idea_market.`,
    { model: MODEL_SMART, system: SYSTEM },
  );

  const validEvidence = new Set(evidence.map((e) => e.id));
  const insert = db.prepare(
    "INSERT INTO axis_scores (opportunity_id, axis, verdict, score, confidence, trend, rationale, evidence_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const rows: AxisScoreRow[] = [];
  for (const axisName of ["founder", "market", "idea_market"] as const) {
    const axis = out.axes.find((a) => a.axis === axisName) ?? {
      axis: axisName,
      verdict: "neutral" as const,
      score: 50,
      confidence: "low" as const,
      rationale: "Model omitted this axis; defaulted to neutral.",
      evidence_ids: [],
    };
    // Trend is computed in code against the previous append-only snapshot.
    const prev = db
      .prepare("SELECT score FROM axis_scores WHERE opportunity_id=? AND axis=? ORDER BY id DESC LIMIT 1")
      .get(opp.id, axisName) as { score: number } | undefined;
    const trend =
      prev == null ? "new" : axis.score - prev.score > 3 ? "improving" : prev.score - axis.score > 3 ? "declining" : "stable";
    const evidenceIds = axis.evidence_ids.filter((id) => validEvidence.has(id));
    const res = insert.run(
      opp.id,
      axisName,
      axis.verdict,
      Math.min(100, Math.max(0, axis.score)),
      axis.confidence,
      trend,
      axis.rationale,
      JSON.stringify(evidenceIds),
    );
    rows.push(
      db.prepare("SELECT * FROM axis_scores WHERE id=?").get(Number(res.lastInsertRowid)) as AxisScoreRow,
    );
  }
  return rows;
}
