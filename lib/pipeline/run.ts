import crypto from "node:crypto";
import { db } from "../db";
import { withStep } from "../trace";
import { getOpportunity } from "../model";
import { extract } from "./extract";
import { findOrCreateFounder } from "./founders";
import { quickScreen } from "./screen";
import { enrich } from "./enrich";
import { verifyClaims } from "./verify";
import { scoreFounder } from "./founderScore";
import { scoreAxes } from "./axes";
import { writeMemo } from "./memo";

/**
 * The full inbound/outbound analysis pipeline. Every stage is wrapped in
 * withStep so the reasoning_log doubles as live progress + the Trace tab.
 * Order matters: verification precedes axes; the Founder Score is computed
 * before the Founder axis because it is one of its inputs.
 */
export async function analyzeOpportunity(oppId: number, runIdIn?: string): Promise<void> {
  const runId = runIdIn ?? crypto.randomUUID();
  db.prepare("UPDATE opportunities SET status='analyzing' WHERE id=?").run(oppId);

  try {
    const opp = getOpportunity(oppId);
    if (!opp) throw new Error(`opportunity ${oppId} not found`);

    const extraction = await withStep(
      runId,
      oppId,
      "extract",
      "Reading application & deck — extracting claims, founder identity, and gaps",
      () => extract(opp),
      (e) => ({ claims: e.claims.length, not_disclosed: e.not_disclosed, founder: e.founder.name }),
    );

    const { founder, isReturning } = await withStep(
      runId,
      oppId,
      "memory",
      "Checking Memory — is this founder already known to the fund?",
      () => findOrCreateFounder(extraction, oppId),
      (r) => ({ founder_id: r.founder.id, returning: r.isReturning }),
    );

    const fresh = getOpportunity(oppId)!;
    const screen = await withStep(
      runId,
      oppId,
      "screen",
      "Quick screen against the fund thesis",
      () => quickScreen(fresh),
      (s) => s,
    );
    if (!screen.pass) {
      await withStep(runId, oppId, "decision", `Filtered before full analysis: ${screen.reason}`, async () => ({
        filtered: true,
      }));
      return;
    }

    await withStep(
      runId,
      oppId,
      "enrich",
      "Searching the web & GitHub for independent evidence",
      () => enrich(fresh, founder),
      (n) => ({ evidence_added: n }),
    );

    await withStep(
      runId,
      oppId,
      "verify",
      "Verifying every claim against the evidence pool (Trust Scores)",
      () => verifyClaims(fresh),
      (v) => v,
    );

    await withStep(
      runId,
      oppId,
      "founder_score",
      isReturning
        ? "Updating persistent Founder Score (returning founder — history informs the update)"
        : "Computing initial Founder Score",
      () => scoreFounder(founder, fresh),
      (r) => r,
    );

    await withStep(
      runId,
      oppId,
      "axes",
      "Scoring Founder / Market / Idea-vs-Market — three independent verdicts, never averaged",
      () => scoreAxes(fresh),
      (rows) => rows.map((r) => ({ axis: r.axis, verdict: r.verdict, score: r.score, trend: r.trend })),
    );

    await withStep(
      runId,
      oppId,
      "memo",
      "Drafting the evidence-cited investment memo & recommendation",
      () => writeMemo(fresh),
      (m) => m,
    );
  } catch (err) {
    console.error(`pipeline failed for opportunity ${oppId}:`, err);
    db.prepare("UPDATE opportunities SET status='error' WHERE id=?").run(oppId);
  }
}
