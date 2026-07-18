import { db } from "../db";
import { callStructured, pdfPart, MODEL_SMART, type Msg, type ContentPart } from "../openai";
import { ExtractionSchema, type Extraction } from "../schemas";
import type { OpportunityRow } from "../model";

const SYSTEM = `You are the intake analyst of an AI-native venture fund. You read a startup application (company name plus pitch deck, or plain text) and extract structured facts.

Rules:
- claims: every specific, checkable assertion the founder makes — traction, revenue, customers, team background, market size, prior funding, product milestones. Short, one assertion per claim.
- source_ref: when a PDF deck is provided, cite the slide it came from, e.g. "slide 4". Otherwise use "application text".
- not_disclosed: standard diligence items that are absent from the materials (e.g. "revenue figures", "cap table", "customer references", "round structure", "financial projections"). List what is genuinely missing — do not pad.
- Never invent facts. If the founder's name is not stated, use "<company> founder".
- stage: one of pre-seed, seed, series-a, later. geo: city or country if stated, else region, else "unknown".`;

export async function extract(opp: OpportunityRow): Promise<Extraction> {
  const parts: ContentPart[] = [
    {
      type: "input_text",
      text: `Company name (from application form): ${opp.company_name}\n${
        opp.deck_text ? `Application / deck text:\n${opp.deck_text.slice(0, 20000)}` : "The pitch deck PDF is attached."
      }`,
    },
  ];
  if (opp.deck_path) parts.push(pdfPart(opp.deck_path));

  const messages: Msg[] = [{ role: "user", content: parts }];
  const extraction = await callStructured("extraction", ExtractionSchema, messages, {
    model: MODEL_SMART,
    system: SYSTEM,
  });

  db.prepare(
    "UPDATE opportunities SET one_liner=?, sector=?, geo=?, stage=?, tags_json=? WHERE id=?",
  ).run(
    extraction.one_liner,
    extraction.sector,
    extraction.geo,
    extraction.stage,
    JSON.stringify(extraction.tags),
    opp.id,
  );

  const deckSource = opp.deck_path ? "deck" : "application";
  const insertEvidence = db.prepare(
    "INSERT INTO evidence (opportunity_id, founder_id, source_type, source_ref, title, snippet, synthetic) VALUES (?, NULL, ?, ?, ?, ?, 0)",
  );
  const insertClaim = db.prepare(
    "INSERT INTO claims (opportunity_id, text, category, status, evidence_ids_json) VALUES (?, ?, ?, 'unverified', ?)",
  );

  const tx = db.transaction(() => {
    insertEvidence.run(
      opp.id,
      "application",
      "application form",
      "Application",
      `${extraction.company_name} — ${extraction.one_liner}\nFounder: ${extraction.founder.name}. ${extraction.founder.background_summary}`,
    );
    for (const claim of extraction.claims) {
      const ev = insertEvidence.run(
        opp.id,
        deckSource,
        claim.source_ref,
        `Founder claim (${claim.category})`,
        claim.text,
      );
      insertClaim.run(opp.id, claim.text, claim.category, JSON.stringify([Number(ev.lastInsertRowid)]));
    }
  });
  tx();

  return extraction;
}
