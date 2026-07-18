import { db } from "../db";
import { callStructured, MODEL_FAST } from "../openai";
import { DedupSchema, type Extraction } from "../schemas";
import { normalizeName } from "../util";
import { getFounder, type FounderRow } from "../model";

export interface FounderLink {
  founder: FounderRow;
  isReturning: boolean;
}

/**
 * The "Memory moment": match the applicant against founders we already know.
 * Exact/LIKE match on normalized name, then a fast LLM confirmation.
 */
export async function findOrCreateFounder(extraction: Extraction, opportunityId: number): Promise<FounderLink> {
  const norm = normalizeName(extraction.founder.name);
  const candidates = db
    .prepare("SELECT * FROM founders WHERE normalized_name = ? OR normalized_name LIKE ? LIMIT 3")
    .all(norm, `%${norm.split(" ").pop() ?? norm}%`) as FounderRow[];

  for (const cand of candidates) {
    let same = cand.normalized_name === norm;
    if (!same) {
      const verdict = await callStructured(
        "dedup",
        DedupSchema,
        `Are these the same person?\nKnown founder: ${cand.name} — ${cand.bio ?? "no bio"} — links: ${cand.links_json}\nNew applicant: ${extraction.founder.name} — ${extraction.founder.background_summary} — links: ${JSON.stringify(extraction.founder.links)}`,
        { model: MODEL_FAST },
      );
      same = verdict.same_person;
    }
    if (same) {
      const links = new Set<string>([...JSON.parse(cand.links_json), ...extraction.founder.links]);
      db.prepare("UPDATE founders SET links_json=?, email=COALESCE(email, ?) WHERE id=?").run(
        JSON.stringify([...links]),
        extraction.founder.email,
        cand.id,
      );
      db.prepare("UPDATE opportunities SET founder_id=? WHERE id=?").run(cand.id, opportunityId);
      return { founder: getFounder(cand.id)!, isReturning: true };
    }
  }

  const res = db
    .prepare("INSERT INTO founders (name, normalized_name, email, links_json, bio) VALUES (?, ?, ?, ?, ?)")
    .run(
      extraction.founder.name,
      norm,
      extraction.founder.email,
      JSON.stringify(extraction.founder.links),
      extraction.founder.background_summary,
    );
  const founderId = Number(res.lastInsertRowid);
  db.prepare("UPDATE opportunities SET founder_id=? WHERE id=?").run(founderId, opportunityId);
  db.prepare(
    "INSERT INTO evidence (opportunity_id, founder_id, source_type, source_ref, title, snippet, synthetic) VALUES (?, ?, 'application', 'application form', 'Founder background (self-reported)', ?, 0)",
  ).run(opportunityId, founderId, extraction.founder.background_summary);
  return { founder: getFounder(founderId)!, isReturning: false };
}
