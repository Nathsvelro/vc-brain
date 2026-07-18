import { db } from "../db";
import { callStructured, MODEL_FAST } from "../openai";
import { ScreenSchema, type Screen } from "../schemas";
import { getThesis, thesisPrompt } from "../thesis";
import type { OpportunityRow } from "../model";

/**
 * Fast first-pass filter: removes clearly non-viable / off-thesis ideas before
 * full analysis. Filtered opportunities are KEPT, visible, with the reason —
 * nothing is discarded.
 */
export async function quickScreen(opp: OpportunityRow): Promise<Screen> {
  const thesis = getThesis();
  const screen = await callStructured(
    "quick_screen",
    ScreenSchema,
    `Fund thesis:\n${thesisPrompt(thesis)}\n\nOpportunity:\n${opp.company_name} — ${opp.one_liner}\nSector: ${opp.sector} · Geo: ${opp.geo} · Stage: ${opp.stage} · Tags: ${opp.tags_json}\n\nShould this proceed to full analysis? Fail ONLY if clearly non-viable or clearly outside the thesis (wrong sector, wrong stage, wrong geography, non-startup). When in doubt, pass. Give a one-sentence reason either way.`,
    { model: MODEL_FAST },
  );
  db.prepare("UPDATE opportunities SET screen_json=? WHERE id=?").run(JSON.stringify(screen), opp.id);
  if (!screen.pass) {
    db.prepare("UPDATE opportunities SET status='screened_filtered' WHERE id=?").run(opp.id);
  }
  return screen;
}
