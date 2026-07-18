/**
 * Single-seed pipeline debugger — `npm run run-one [-- "Company Name"]`.
 *
 * Seeds ONE corpus company into the EXISTING database (no wipe), caches its
 * Tavily fixtures, runs the full analysis pipeline, and pretty-prints the
 * resulting claims, axes, and recommendation. Defaults to seed 1 (NeuraForge).
 *
 * Examples:
 *   npm run run-one
 *   npm run run-one -- "QuantumLeap Analytics"
 */
import { loadEnvLocal, requireOpenAIKey } from "./lib";
import {
  ALL_TEMPLATES,
  MESHCART_SEED,
  SEED_CORPUS,
  fixtureQuery,
  type SeedDefinition,
} from "../data/fixtures/tavily/corpus";
import type { Recommendation, Screen } from "../lib/schemas";

async function main(): Promise<void> {
  loadEnvLocal();
  requireOpenAIKey();

  const allSeeds: SeedDefinition[] = [...SEED_CORPUS, MESHCART_SEED];
  const wanted = process.argv[2];
  const seed = wanted
    ? allSeeds.find((s) => s.companyName.toLowerCase() === wanted.toLowerCase())
    : SEED_CORPUS[0];
  if (!seed) {
    console.error(
      `Unknown company "${wanted}". Available seeds:\n  ${allSeeds.map((s) => s.companyName).join("\n  ")}`,
    );
    process.exit(1);
  }

  // Import app modules only after env is loaded.
  const { db, json } = await import("../lib/db");
  const { cacheTavilyFixture } = await import("../lib/tavily");
  const { analyzeOpportunity } = await import("../lib/pipeline/run");
  const { getOpportunity, getFounder, listClaims, latestAxes } = await import("../lib/model");

  // Cache all four template queries (empty where the corpus has no results) so
  // this run does zero live Tavily calls.
  for (const template of ALL_TEMPLATES) {
    const fixture = seed.fixtures.find((f) => f.queryTemplate === template);
    cacheTavilyFixture(fixtureQuery(seed, template), fixture ? fixture.results : []);
  }
  console.log(`Cached ${ALL_TEMPLATES.length} fixture queries for ${seed.companyName}.`);

  const res = db
    .prepare(
      "INSERT INTO opportunities (company_name, source, status, deck_text, source_signal) VALUES (?, ?, 'received', ?, ?)",
    )
    .run(seed.companyName, seed.sourceType, seed.deckText, seed.sourceSignal ?? null);
  const oppId = Number(res.lastInsertRowid);
  console.log(`Inserted opportunity #${oppId} (${seed.companyName}) into the existing DB — analyzing...`);

  await analyzeOpportunity(oppId);

  const urls = seed.fixtures.flatMap((f) => f.results.map((r) => r.url));
  if (urls.length > 0) {
    const placeholders = urls.map(() => "?").join(", ");
    db.prepare(`UPDATE evidence SET synthetic=1 WHERE opportunity_id=? AND source_ref IN (${placeholders})`).run(
      oppId,
      ...urls,
    );
  }

  const opp = getOpportunity(oppId);
  if (!opp) throw new Error(`opportunity #${oppId} vanished`);

  console.log(`\n${opp.company_name} — ${opp.one_liner ?? "(no one-liner)"}`);
  console.log(
    `status: ${opp.status} · sector: ${opp.sector ?? "?"} · geo: ${opp.geo ?? "?"} · stage: ${opp.stage ?? "?"}`,
  );

  const founder = opp.founder_id != null ? getFounder(opp.founder_id) : undefined;
  if (founder) {
    console.log(
      `founder: ${founder.name} — Founder Score ${founder.current_score ?? "—"} [${founder.score_low ?? "—"}–${founder.score_high ?? "—"}]${founder.cold_start ? " (cold start)" : ""}`,
    );
  }

  const screen = json<Screen | null>(opp.screen_json, null);
  if (screen && !screen.pass) {
    console.log(`filtered at screen: ${screen.reason}`);
  }

  const claims = listClaims(oppId);
  if (claims.length > 0) {
    console.log("\nClaims:");
    console.table(
      claims.map((c) => ({
        id: c.id,
        category: c.category,
        status: c.status,
        trust: c.trust_score ?? "—",
        text: c.text.length > 72 ? `${c.text.slice(0, 69)}...` : c.text,
      })),
    );
  } else {
    console.log("\nClaims: none recorded.");
  }

  const axes = latestAxes(oppId);
  if (axes.length > 0) {
    console.log("Axes:");
    console.table(
      axes.map((a) => ({
        axis: a.axis,
        verdict: a.verdict,
        score: Math.round(a.score),
        trend: a.trend,
        confidence: a.confidence,
      })),
    );
  } else {
    console.log("Axes: none (filtered at screen or pipeline error).");
  }

  const rec = json<Recommendation | null>(opp.recommendation_json, null);
  if (rec) {
    const check = rec.check_size_usd == null ? "—" : `$${rec.check_size_usd.toLocaleString("en-US")}`;
    console.log(`Recommendation: ${rec.verdict.toUpperCase()} · check ${check} · confidence ${rec.confidence}`);
    console.log(`  ${rec.rationale}`);
    console.log("  Diligence questions:");
    rec.diligence_questions.forEach((q, i) => console.log(`    ${i + 1}. ${q}`));
  } else {
    console.log("Recommendation: none (filtered at screen or pipeline error).");
  }
}

main().catch((err) => {
  console.error("run-one failed:", err);
  process.exit(1);
});
