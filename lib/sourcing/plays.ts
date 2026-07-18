import { db } from "../db";
import { callStructured, MODEL_FAST } from "../openai";
import { CandidatesSchema, OutreachSchema, PlaysSchema, type Plays } from "../schemas";
import { getThesis, thesisPrompt } from "../thesis";
import { tavilySearch } from "../tavily";
import { analyzeOpportunity } from "../pipeline/run";
import { getOpportunity, type OpportunityRow } from "../model";

/**
 * Outbound sourcing: the thesis itself generates the search plays, candidates
 * get scored by the exact same pipeline as inbound applications, and outreach
 * cites the specific signal that surfaced the founder.
 */
export async function generatePlays(): Promise<Plays> {
  const thesis = getThesis();
  return callStructured(
    "sourcing_plays",
    PlaysSchema,
    `Fund thesis:\n${thesisPrompt(thesis)}\n\nDesign 4 concrete web-search "sourcing plays" to surface exceptional founders BEFORE they start fundraising — hackathon winners, notable open-source launches, fresh Product Hunt / Hacker News launches, research spinouts, accelerator demo days. Each play: a short title, why this channel fits the thesis, and 1-2 literal web search queries.`,
    { model: MODEL_FAST },
  );
}

export interface PlayRunResult {
  createdOpportunityIds: number[];
  candidatesFound: number;
}

export async function runPlay(play: { title: string; rationale: string; queries: string[] }): Promise<PlayRunResult> {
  const thesis = getThesis();
  const searches = await Promise.allSettled(play.queries.slice(0, 2).map((q) => tavilySearch(q, 5)));
  const hits = searches.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  if (hits.length === 0) return { createdOpportunityIds: [], candidatesFound: 0 };

  const resultList = hits
    .map((h, i) => `[result ${i + 1}] ${h.title} — ${h.content.slice(0, 400)} (${h.url})`)
    .join("\n");

  const { candidates } = await callStructured(
    "sourcing_candidates",
    CandidatesSchema,
    `Fund thesis:\n${thesisPrompt(thesis)}\n\nSourcing play: ${play.title} — ${play.rationale}\n\nSearch results:\n${resultList}\n\nExtract up to 2 REAL founder/company candidates visible in these results that fit the thesis. signal = the specific thing that surfaced them (e.g. "won ETHBerlin 2026 main track"). Only candidates actually present in the results — never invent.`,
    { model: MODEL_FAST },
  );

  const created: number[] = [];
  for (const cand of candidates.slice(0, 2)) {
    const existing = db
      .prepare("SELECT id FROM opportunities WHERE company_name = ? COLLATE NOCASE")
      .get(cand.company_name) as { id: number } | undefined;
    if (existing) continue;

    const deckText = `Outbound-sourced candidate (not an application).\nFounder: ${cand.founder_name}\nCompany: ${cand.company_name}\nSector: ${cand.sector} · Geo: ${cand.geo}\nSummary: ${cand.summary}\nSourcing signal: ${cand.signal}\nSource: ${cand.source_url}`;
    const res = db
      .prepare(
        "INSERT INTO opportunities (company_name, source, status, deck_text, source_signal) VALUES (?, 'outbound', 'received', ?, ?)",
      )
      .run(cand.company_name, deckText, cand.signal);
    const oppId = Number(res.lastInsertRowid);
    created.push(oppId);

    // Outreach first (fast, page fills immediately); full scoring runs async.
    const outreach = await callStructured(
      "outreach",
      OutreachSchema,
      `Fund: ${thesis.fund_name}. We write cold outreach whose only goal is to trigger a real application — cold outreach, not cold investment.\nCandidate: ${cand.founder_name} (${cand.company_name}) — ${cand.summary}\nThe exact signal that surfaced them: ${cand.signal} (${cand.source_url})\n\nWrite a short, personal email (under 120 words) that names the specific signal, says we can decide on a $100K check within 24 hours of an application, and links to our application page. No flattery padding.`,
      { model: MODEL_FAST },
    );
    db.prepare("UPDATE opportunities SET outreach_json=? WHERE id=?").run(JSON.stringify(outreach), oppId);

    void analyzeOpportunity(oppId).catch((err) => console.error("outbound analysis failed:", err));
  }

  return { createdOpportunityIds: created, candidatesFound: candidates.length };
}

/**
 * Convergence: a sourced candidate "applies". Creates a real inbound
 * application for the same founder/company; dedup links the two tracks and the
 * Founder Score history spans both events.
 */
export function simulateApplication(outboundOppId: number): { inboundOppId: number } {
  const opp = getOpportunity(outboundOppId);
  if (!opp || opp.source !== "outbound") throw new Error("not an outbound opportunity");

  const deckText = `Inbound application following our outreach.\n${opp.deck_text ?? ""}\n\nAdditional founder note: Thanks for reaching out — applying as suggested. Happy to share more detail on traction and roadmap on a call.`;
  const res = db
    .prepare(
      "INSERT INTO opportunities (company_name, source, status, deck_text, source_signal, linked_opportunity_id) VALUES (?, 'inbound', 'received', ?, ?, ?)",
    )
    .run(opp.company_name, deckText, opp.source_signal, outboundOppId);
  const inboundOppId = Number(res.lastInsertRowid);
  db.prepare("UPDATE opportunities SET linked_opportunity_id=? WHERE id=?").run(inboundOppId, outboundOppId);

  void analyzeOpportunity(inboundOppId).catch((err) => console.error("converged analysis failed:", err));
  return { inboundOppId };
}

export type { OpportunityRow };
