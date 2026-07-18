import { db } from "../db";
import { callStructured, MODEL_SMART } from "../openai";
import { FounderScoreSchema } from "../schemas";
import { founderHistory, listFounderEvidence, listClaims, type FounderRow, type OpportunityRow } from "../model";

const WEIGHTS: Record<string, number> = {
  execution_track_record: 0.3,
  technical_depth: 0.25,
  domain_insight: 0.2,
  learning_velocity: 0.15,
  external_validation: 0.1,
};

export interface FounderScoreResult {
  score: number;
  low: number;
  high: number;
  coldStart: boolean;
  isFirstScore: boolean;
  delta: number | null;
}

const SYSTEM = `You are scoring a FOUNDER (the person, not this specific startup) for a venture fund's persistent Founder Score. Score five components 0-10, each with confidence and the evidence ids you relied on:
- execution_track_record: things actually shipped/achieved (products, companies, wins, published work)
- technical_depth: demonstrated engineering/scientific ability
- domain_insight: how well they understand the problem space they chose
- learning_velocity: trajectory — improvement between ventures, speed of shipping, honest reflection on failures
- external_validation: signals from others (stars, followers, press, accelerators, references)

Rules:
- Cite evidence ids for every component; a component with no evidence gets confidence "low", NOT an automatic 0.
- COLD-START founders (little/no external footprint): score what the materials themselves evidence — clarity of thinking, domain insight, ambition. Use "low" confidence liberally instead of punishing absence of history.
- If prior score history is provided, treat it as memory: a founder who failed but shipped, learned, and returned with sharper thinking should score HIGHER on learning_velocity than someone untested. Never reset — update.
- Contradicted claims by this founder are an integrity signal: reflect them in the rationale and confidence.`;

export async function scoreFounder(
  founder: FounderRow,
  opp: OpportunityRow,
): Promise<FounderScoreResult> {
  const evidence = listFounderEvidence(founder.id);
  const externalCount = evidence.filter((e) => e.source_type === "web" || e.source_type === "github").length;
  const coldStart = externalCount < 3;
  const history = founderHistory(founder.id);
  const claims = listClaims(opp.id);

  const evidenceList = evidence
    .map((e) => `[evidence ${e.id}] (${e.source_type}) ${e.title ?? ""} — ${(e.snippet ?? "").slice(0, 300)}`)
    .join("\n");
  const historyList =
    history.length === 0
      ? "(none — first time this founder enters the system)"
      : history
          .map((h) => `${h.created_at}: score ${h.score.toFixed(0)} [${h.low.toFixed(0)}-${h.high.toFixed(0)}] via ${h.trigger_event} — ${h.rationale ?? ""}`)
          .join("\n");
  const claimSummary = claims
    .map((c) => `- (${c.status}, trust ${c.trust_score ?? "?"}) ${c.text}`)
    .join("\n");

  const out = await callStructured(
    "founder_score",
    FounderScoreSchema,
    `Founder: ${founder.name}\nBio: ${founder.bio ?? "unknown"}\nCold-start: ${coldStart ? "YES — minimal external footprint" : "no"}\n\nPrior score history (persistent memory):\n${historyList}\n\nCurrent opportunity: ${opp.company_name} — ${opp.one_liner}\nClaim verification results:\n${claimSummary}\n\nEvidence pool:\n${evidenceList}`,
    { model: MODEL_SMART, system: SYSTEM },
  );

  // Deterministic aggregation: weighted sum → 0-100.
  let score = 0;
  let lowConfidence = 0;
  for (const c of out.components) {
    score += (WEIGHTS[c.name] ?? 0) * c.score_0_10 * 10;
    if (c.confidence === "low") lowConfidence++;
  }
  score = Math.round(Math.min(100, Math.max(0, score)));

  // Uncertainty band is a formula, not a feeling.
  let width = 10 + 6 * lowConfidence + 4 * Math.max(0, 5 - evidence.length);
  width = Math.min(40, width);
  if (coldStart) width = Math.max(25, width);
  const low = Math.max(0, Math.round(score - width / 2));
  const high = Math.min(100, Math.round(score + width / 2));

  const prev = history.length > 0 ? history[history.length - 1].score : null;

  db.prepare(
    "INSERT INTO founder_score_history (founder_id, score, low, high, components_json, rationale, trigger_event, opportunity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    founder.id,
    score,
    low,
    high,
    JSON.stringify({ components: out.components, weights: WEIGHTS, evidence_count: evidence.length, external_count: externalCount }),
    out.rationale,
    opp.source === "outbound" ? "outbound" : "application",
    opp.id,
  );
  db.prepare("UPDATE founders SET current_score=?, score_low=?, score_high=?, cold_start=? WHERE id=?").run(
    score,
    low,
    high,
    coldStart ? 1 : 0,
    founder.id,
  );

  return {
    score,
    low,
    high,
    coldStart,
    isFirstScore: history.length === 0,
    delta: prev == null ? null : score - prev,
  };
}
