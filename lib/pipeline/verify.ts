import { db } from "../db";
import { callStructured, MODEL_SMART } from "../openai";
import { VerificationSchema } from "../schemas";
import { listClaims, listEvidence, type OpportunityRow } from "../model";

/**
 * Trust Score is a deterministic mapping from verdict + corroboration —
 * the LLM decides the verdict, code decides the number. Defensible in Q&A.
 */
export function mapTrustScore(status: string, nSupport: number, nContradict: number): number {
  switch (status) {
    case "verified":
      return Math.min(95, 80 + 5 * Math.max(0, nSupport - 1));
    case "unverifiable":
      return 50;
    case "contradicted":
      return Math.max(10, 25 - 5 * Math.max(0, nContradict - 1));
    default:
      return 45; // unverified: deck-only, no external corroboration
  }
}

const SYSTEM = `You are the verification analyst of a venture fund. You receive the founder's claims and the full evidence pool collected about the company. For EACH claim, judge:
- verified: at least one INDEPENDENT external source (web/github) supports it. The founder's own deck/application never counts as external support.
- contradicted: external evidence conflicts with the claim (cite the conflicting evidence ids).
- unverifiable: inherently private information (internal revenue, cap table) with no public trace — not the founder's fault.
- unverified: could have public traces, but the pool has none.
Be strict: a vague mention is not verification. Note must be one sentence explaining the verdict, naming the contradiction when there is one.`;

export async function verifyClaims(opp: OpportunityRow): Promise<{ verified: number; contradicted: number; total: number }> {
  const claims = listClaims(opp.id);
  const evidence = listEvidence(opp.id);
  if (claims.length === 0) return { verified: 0, contradicted: 0, total: 0 };

  const external = evidence.filter((e) => e.source_type === "web" || e.source_type === "github");
  const claimList = claims.map((c) => `[claim ${c.id}] (${c.category}) ${c.text}`).join("\n");
  const evidenceList =
    external.length === 0
      ? "(no external evidence was found)"
      : external
          .map((e) => `[evidence ${e.id}] (${e.source_type}) ${e.title ?? ""} — ${e.snippet ?? ""} (${e.source_ref ?? ""})`)
          .join("\n");

  const out = await callStructured(
    "verification",
    VerificationSchema,
    `Company: ${opp.company_name} — ${opp.one_liner}\n\nClaims:\n${claimList}\n\nExternal evidence pool:\n${evidenceList}\n\nReturn one verdict per claim id.`,
    { model: MODEL_SMART, system: SYSTEM },
  );

  const validClaim = new Set(claims.map((c) => c.id));
  // Only web/github rows count as support/contradiction — the deck cannot
  // corroborate itself, and hallucinated ids must not survive.
  const externalIds = new Set(external.map((e) => e.id));
  const update = db.prepare(
    "UPDATE claims SET status=?, trust_score=?, evidence_ids_json=?, verification_note=? WHERE id=?",
  );

  let verified = 0;
  let contradicted = 0;
  const tx = db.transaction(() => {
    for (const v of out.verdicts) {
      if (!validClaim.has(v.claim_id)) continue;
      const support = v.supporting_evidence_ids.filter((id) => externalIds.has(id));
      const contra = v.contradicting_evidence_ids.filter((id) => externalIds.has(id));
      let status = v.status;
      let note = v.note;
      if (status === "verified" && support.length === 0) {
        status = "unverified";
        note = `${note} (downgraded: no valid independent source survived validation)`;
      } else if (status === "contradicted" && contra.length === 0) {
        status = "unverified";
        note = `${note} (downgraded: cited contradicting evidence was invalid)`;
      }
      const prior: number[] = JSON.parse(claims.find((c) => c.id === v.claim_id)!.evidence_ids_json);
      const merged = [...new Set([...prior, ...support, ...contra])];
      const trust = mapTrustScore(status, support.length, contra.length);
      update.run(status, trust, JSON.stringify(merged), note, v.claim_id);
      if (status === "verified") verified++;
      if (status === "contradicted") contradicted++;
    }
  });
  tx();

  return { verified, contradicted, total: claims.length };
}
