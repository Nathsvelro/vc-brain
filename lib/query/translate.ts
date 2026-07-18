import { db } from "../db";
import { callStructured, MODEL_FAST } from "../openai";
import { QueryFilterSchema, RerankSchema, type QueryFilter, type Rerank } from "../schemas";
import type { FounderRow, OpportunityRow } from "../model";

export interface NLQueryResponse {
  parsed: QueryFilter;
  results: Array<{
    opportunity: Pick<
      OpportunityRow,
      "id" | "company_name" | "one_liner" | "sector" | "geo" | "stage" | "source" | "status"
    >;
    founder_name: string | null;
    founder_score: number | null;
    overall_fit: number;
    criteria: Rerank["results"][number]["criteria"];
  }>;
}

/**
 * Multi-attribute reasoning: one compound NL query → structured filter → SQL
 * over Memory → LLM rerank with per-criterion met / not-met / UNKNOWN chips.
 * "unknown" is the honesty requirement showing up inside search.
 */
export async function searchNL(q: string): Promise<NLQueryResponse> {
  const parsed = await callStructured(
    "query_filter",
    QueryFilterSchema,
    `Translate this investor query into structured filters plus the individual criteria it contains (for later evidence checks). Query: "${q}"\nKeep filter values short and generic (e.g. "AI infra" → sectors: ["ai infrastructure"]). criteria: each distinct requirement as a short phrase.`,
    { model: MODEL_FAST },
  );

  const where: string[] = [];
  const args: unknown[] = [];
  const like = (cols: string[], terms: string[]) => {
    if (terms.length === 0) return;
    const clause = terms
      .map(() => `(${cols.map((c) => `${c} LIKE ?`).join(" OR ")})`)
      .join(" OR ");
    where.push(`(${clause})`);
    for (const t of terms) for (const _ of cols) args.push(`%${t}%`);
  };

  like(["o.sector", "o.tags_json", "o.one_liner"], parsed.filters.sectors);
  like(["o.geo"], parsed.filters.geos);
  like(["o.stage"], parsed.filters.stages);
  like(["o.company_name", "o.one_liner", "o.deck_text", "f.name", "f.bio"], parsed.filters.text_terms);
  if (parsed.filters.source !== "any") {
    where.push("o.source = ?");
    args.push(parsed.filters.source);
  }

  const sql = `SELECT o.*, f.name AS founder_name, f.current_score AS founder_score, f.bio AS founder_bio
    FROM opportunities o LEFT JOIN founders f ON f.id = o.founder_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY o.id DESC LIMIT 20`;
  type Row = OpportunityRow & { founder_name: string | null; founder_score: number | null; founder_bio: string | null };
  let rows = db.prepare(sql).all(...args) as Row[];
  // Permissive fallback: an over-restrictive parse should degrade, not zero out.
  if (rows.length === 0 && where.length > 1) {
    rows = db
      .prepare(
        `SELECT o.*, f.name AS founder_name, f.current_score AS founder_score, f.bio AS founder_bio
         FROM opportunities o LEFT JOIN founders f ON f.id = o.founder_id ORDER BY o.id DESC LIMIT 20`,
      )
      .all() as Row[];
  }
  if (rows.length === 0) return { parsed, results: [] };

  const candidateList = rows
    .map(
      (r) =>
        `[opportunity ${r.id}] ${r.company_name} — ${r.one_liner ?? "?"} · sector ${r.sector ?? "?"} · geo ${r.geo ?? "?"} · stage ${r.stage ?? "?"} · source ${r.source} · founder ${r.founder_name ?? "?"} (score ${r.founder_score ?? "?"}) — ${r.founder_bio ?? ""}`,
    )
    .join("\n");

  const reranked = await callStructured(
    "query_rerank",
    RerankSchema,
    `Investor query: "${q}"\nCriteria: ${parsed.criteria.join(" · ")}\n\nCandidates from the fund's Memory:\n${candidateList}\n\nFor each candidate, judge every criterion: met / not_met / unknown. Use "unknown" honestly whenever the data above cannot answer the criterion (e.g. "no prior VC backing" with no funding data). overall_fit 0-100. Only include candidates with at least one met criterion; order by fit.`,
    { model: MODEL_FAST },
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const results = reranked.results
    .filter((r) => byId.has(r.opportunity_id))
    .sort((a, b) => b.overall_fit - a.overall_fit)
    .map((r) => {
      const row = byId.get(r.opportunity_id)!;
      return {
        opportunity: {
          id: row.id,
          company_name: row.company_name,
          one_liner: row.one_liner,
          sector: row.sector,
          geo: row.geo,
          stage: row.stage,
          source: row.source,
          status: row.status,
        },
        founder_name: row.founder_name,
        founder_score: row.founder_score,
        overall_fit: r.overall_fit,
        criteria: r.criteria,
      };
    });

  return { parsed, results };
}
