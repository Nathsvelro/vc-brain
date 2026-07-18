import { db } from "../db";
import { callStructured, MODEL_SMART } from "../openai";
import { MemoAndRecommendationSchema } from "../schemas";
import { getThesis, thesisPrompt } from "../thesis";
import { getFounder, latestAxes, listClaims, listEvidence, type OpportunityRow } from "../model";

const SYSTEM = `You write the investment memo a partner reads before wiring $100K within 24 hours. Rules:

- Sections: company snapshot (max 120 words), investment hypotheses (max 6 bullets, 25 words each), SWOT (max 4 bullets per quadrant, 20 words each), problem & product (max 150 words), traction & KPIs (bullets — ONLY from claims, carrying their verification status).
- Every bullet cites evidence_ids from the provided pool. Never cite an id that is not in the pool. Never invent numbers.
- key_unknowns: every missing diligence item, phrased explicitly ("Cap table: not disclosed", "Customer references: unavailable at this stage"). A memo that marks its own gaps is MORE trustworthy. Include contradicted claims here as open questions.
- Padding counts against you. As detailed as the decision requires, as brief as clarity allows.
- recommendation: invest / watch / pass through the fund thesis lens. check_size_usd must sit inside the thesis check range (null when verdict is pass). Confidence reflects evidence quality — contradictions and thin verification lower it. Exactly 3 diligence_questions: the sharpest things a human should ask next.`;

export async function writeMemo(opp: OpportunityRow): Promise<{ verdict: string }> {
  const thesis = getThesis();
  const claims = listClaims(opp.id);
  const evidence = listEvidence(opp.id);
  const axes = latestAxes(opp.id);
  const founder = opp.founder_id ? getFounder(opp.founder_id) : undefined;

  const claimList = claims
    .map((c) => `- [${c.status}, trust ${c.trust_score ?? "?"}] (${c.category}) ${c.text}${c.verification_note ? ` — ${c.verification_note}` : ""}`)
    .join("\n");
  const evidenceList = evidence
    .map((e) => `[evidence ${e.id}] (${e.source_type}) ${e.title ?? ""} — ${(e.snippet ?? "").slice(0, 250)} (${e.source_ref ?? ""})`)
    .join("\n");
  const axisList = axes
    .map((a) => `${a.axis}: ${a.verdict} (${Math.round(a.score)}/100, ${a.confidence} confidence, trend ${a.trend}) — ${a.rationale}`)
    .join("\n");

  const out = await callStructured(
    "memo",
    MemoAndRecommendationSchema,
    `Fund thesis:\n${thesisPrompt(thesis)}\n\nCompany: ${opp.company_name} — ${opp.one_liner}\nSector: ${opp.sector} · Geo: ${opp.geo} · Stage: ${opp.stage}\nFounder: ${founder ? `${founder.name}, Founder Score ${founder.current_score} [${founder.score_low}-${founder.score_high}]${founder.cold_start ? " (cold start)" : ""}` : "unknown"}\n\n3-axis screening:\n${axisList}\n\nClaims with verification:\n${claimList}\n\nEvidence pool:\n${evidenceList}`,
    { model: MODEL_SMART, system: SYSTEM },
  );

  db.prepare("UPDATE opportunities SET memo_json=?, recommendation_json=?, status='analyzed' WHERE id=?").run(
    JSON.stringify(out.memo),
    JSON.stringify(out.recommendation),
    opp.id,
  );
  return { verdict: out.recommendation.verdict };
}
