import crypto from "node:crypto";
import { db } from "./db";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

let warnedNoKey = false;

/**
 * Cache-first Tavily search. The cache is also how seed fixtures inject
 * synthetic web results, which makes demos deterministic and offline-safe.
 */
export async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const hash = crypto.createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
  const cached = db.prepare("SELECT response_json FROM tavily_cache WHERE query_hash = ?").get(hash) as
    | { response_json: string }
    | undefined;
  if (cached) return JSON.parse(cached.response_json);

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    if (!warnedNoKey) {
      console.warn("TAVILY_API_KEY not set — web enrichment returns no results (fixtures in tavily_cache still work).");
      warnedNoKey = true;
    }
    return [];
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic" }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { results?: Array<Partial<TavilyResult>> };
  const results: TavilyResult[] = (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: (r.content ?? "").slice(0, 1500),
    score: r.score,
  }));
  db.prepare("INSERT OR REPLACE INTO tavily_cache (query_hash, query, response_json) VALUES (?, ?, ?)").run(
    hash,
    query,
    JSON.stringify(results),
  );
  return results;
}

/** Used by the seed script to preload fixtures. */
export function cacheTavilyFixture(query: string, results: TavilyResult[]): void {
  const hash = crypto.createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
  db.prepare("INSERT OR REPLACE INTO tavily_cache (query_hash, query, response_json) VALUES (?, ?, ?)").run(
    hash,
    query,
    JSON.stringify(results),
  );
}
