/**
 * Demo seed script — `npm run seed` (tsx scripts/seed.ts).
 *
 * Wipes the database, preloads every Tavily fixture into tavily_cache (so the
 * whole run is deterministic and does ZERO live Tavily calls), then pushes each
 * corpus seed through the real analysis pipeline in demo order:
 *
 *   0. MeshCart (Priya Sharma's failed 2024 venture) — analyzed, then backdated
 *      8 months so her Founder Score history predates everything else.
 *   1-5. NeuraForge, QuantumLeap Analytics (analyzed TWICE for axis trend
 *      movement), Willow & Sage Health, TerraBloom Biotech, Mosaic Memory.
 *   6. Ledgerly — Priya's second venture; the returning-founder score update.
 *   7. Parsec Robotics — outbound-sourced, with generated outreach email.
 *
 * Requires OPENAI_API_KEY (all LLM stages are live). TAVILY_API_KEY is NOT
 * required: every enrichment query is served from the fixture cache.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal, requireOpenAIKey } from "./lib";
import {
  ALL_TEMPLATES,
  MESHCART_SEED,
  SEED_CORPUS,
  fixtureQuery,
  type SeedDefinition,
} from "../data/fixtures/tavily/corpus";

interface SeedOutcome {
  company: string;
  oppId: number | null;
  error: string | null;
}

async function main(): Promise<void> {
  loadEnvLocal();
  requireOpenAIKey();

  // 1. Fresh database: delete BEFORE the db singleton is imported/opened.
  const dbPath = path.join(process.cwd(), "data", "vcbrain.db");
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    fs.rmSync(p, { force: true });
  }
  console.log(`Removed ${dbPath} (+wal/shm) — seeding from scratch.`);

  // 2. Import app modules only now (env loaded, old DB gone, singleton fresh).
  const { db, json } = await import("../lib/db");
  const { getThesis } = await import("../lib/thesis");
  const { cacheTavilyFixture } = await import("../lib/tavily");
  const { analyzeOpportunity } = await import("../lib/pipeline/run");
  const { callStructured, MODEL_FAST } = await import("../lib/openai");
  const { OutreachSchema } = await import("../lib/schemas");

  const thesis = getThesis();
  console.log(`Thesis ensured: ${thesis.fund_name}`);

  // 3. Preload EVERY fixture query — including empty ones — so no template
  //    query ever falls through to a live Tavily call (cold start included).
  const allSeeds: SeedDefinition[] = [MESHCART_SEED, ...SEED_CORPUS];
  let cachedQueries = 0;
  for (const seed of allSeeds) {
    for (const template of ALL_TEMPLATES) {
      const fixture = seed.fixtures.find((f) => f.queryTemplate === template);
      cacheTavilyFixture(fixtureQuery(seed, template), fixture ? fixture.results : []);
      cachedQueries++;
    }
  }
  console.log(`Preloaded ${cachedQueries} Tavily queries into tavily_cache (fixtures, incl. empty cold-start ones).`);

  const outcomes: SeedOutcome[] = [];

  function insertOpportunity(seed: SeedDefinition): number {
    const res = db
      .prepare(
        "INSERT INTO opportunities (company_name, source, status, deck_text, source_signal) VALUES (?, ?, 'received', ?, ?)",
      )
      .run(seed.companyName, seed.sourceType, seed.deckText, seed.sourceSignal ?? null);
    return Number(res.lastInsertRowid);
  }

  function markSynthetic(seed: SeedDefinition, oppId: number): void {
    const urls = seed.fixtures.flatMap((f) => f.results.map((r) => r.url));
    if (urls.length === 0) return;
    const placeholders = urls.map(() => "?").join(", ");
    db.prepare(`UPDATE evidence SET synthetic=1 WHERE opportunity_id=? AND source_ref IN (${placeholders})`).run(
      oppId,
      ...urls,
    );
  }

  function statusOf(oppId: number): string {
    const row = db.prepare("SELECT status FROM opportunities WHERE id=?").get(oppId) as { status: string };
    return row.status;
  }

  async function seedAndAnalyze(seed: SeedDefinition, label: string): Promise<number> {
    console.log(`\n=== ${label}: ${seed.companyName} — ${seed.founderName} (${seed.sourceType}) ===`);
    const oppId = insertOpportunity(seed);
    console.log(`  inserted opportunity #${oppId}, running pipeline...`);
    await analyzeOpportunity(oppId);
    markSynthetic(seed, oppId);
    const status = statusOf(oppId);
    console.log(`  pipeline finished — status: ${status}`);
    if (status === "error") {
      throw new Error(`pipeline ended in status=error for ${seed.companyName} (see reasoning_log)`);
    }
    return oppId;
  }

  function bySeedName(name: string): SeedDefinition {
    const seed = SEED_CORPUS.find((s) => s.companyName === name);
    if (!seed) throw new Error(`seed not found in corpus: ${name}`);
    return seed;
  }

  // --- Seed 0: MeshCart — Priya's failed first venture, backdated ----------
  try {
    const oppId = await seedAndAnalyze(MESHCART_SEED, "Seed 0/8 (backdated history)");
    const past = "datetime('now','-8 months')";
    db.prepare(`UPDATE opportunities SET created_at=${past} WHERE id=?`).run(oppId);
    db.prepare(`UPDATE evidence SET retrieved_at=${past} WHERE opportunity_id=?`).run(oppId);
    db.prepare(`UPDATE claims SET created_at=${past} WHERE opportunity_id=?`).run(oppId);
    db.prepare(`UPDATE axis_scores SET created_at=${past} WHERE opportunity_id=?`).run(oppId);
    db.prepare(`UPDATE reasoning_log SET started_at=${past}, finished_at=${past} WHERE opportunity_id=?`).run(oppId);
    db.prepare(`UPDATE founder_score_history SET created_at=${past} WHERE opportunity_id=?`).run(oppId);
    const owner = db.prepare("SELECT founder_id FROM opportunities WHERE id=?").get(oppId) as {
      founder_id: number | null;
    };
    if (owner.founder_id != null) {
      db.prepare(`UPDATE founders SET created_at=${past} WHERE id=?`).run(owner.founder_id);
    }
    console.log("  backdated MeshCart (opportunity, evidence, claims, axes, log, score history, founder) by 8 months.");
    outcomes.push({ company: MESHCART_SEED.companyName, oppId, error: null });
  } catch (err) {
    console.error(`  FAILED: ${String(err)}`);
    outcomes.push({ company: MESHCART_SEED.companyName, oppId: null, error: String(err) });
  }

  // --- Seeds 1,2,3,5,7: first inbound wave ---------------------------------
  const firstWave = [
    "NeuraForge",
    "QuantumLeap Analytics",
    "Willow & Sage Health",
    "TerraBloom Biotech",
    "Mosaic Memory",
  ];
  let n = 1;
  for (const name of firstWave) {
    const seed = bySeedName(name);
    try {
      const oppId = await seedAndAnalyze(seed, `Seed ${n}/8`);
      if (name === "QuantumLeap Analytics") {
        console.log("  re-running analysis for a second axis snapshot (trend-over-time demo)...");
        await analyzeOpportunity(oppId);
        markSynthetic(seed, oppId);
        console.log(`  second pass finished — status: ${statusOf(oppId)}`);
      }
      outcomes.push({ company: seed.companyName, oppId, error: null });
    } catch (err) {
      console.error(`  FAILED: ${String(err)}`);
      outcomes.push({ company: seed.companyName, oppId: null, error: String(err) });
    }
    n++;
  }

  // --- Seed 4 (run 7th on purpose): Ledgerly — the returning founder --------
  {
    const seed = bySeedName("Ledgerly");
    try {
      const oppId = await seedAndAnalyze(seed, "Seed 6/8 (returning founder — Priya Sharma)");
      outcomes.push({ company: seed.companyName, oppId, error: null });
    } catch (err) {
      console.error(`  FAILED: ${String(err)}`);
      outcomes.push({ company: seed.companyName, oppId: null, error: String(err) });
    }
  }

  // --- Seed 6 (run last): Parsec Robotics — outbound sourced + outreach -----
  {
    const seed = bySeedName("Parsec Robotics");
    try {
      const oppId = await seedAndAnalyze(seed, "Seed 7/8 (outbound sourced)");
      const row = db.prepare("SELECT one_liner FROM opportunities WHERE id=?").get(oppId) as {
        one_liner: string | null;
      };
      const summary = row.one_liner ?? "open-source toolkit for debugging warehouse-robot fleets";
      const outreach = await callStructured(
        "outreach",
        OutreachSchema,
        `Fund: ${thesis.fund_name}. We write cold outreach whose only goal is to trigger a real application — cold outreach, not cold investment.\nCandidate: ${seed.founderName} (${seed.companyName}) — ${summary}\nThe exact signal that surfaced them: ${seed.sourceSignal}\n\nWrite a short, personal email (under 120 words) that names the specific signal, says we can decide on a $100K check within 24 hours of an application, and links to our application page. No flattery padding.`,
        { model: MODEL_FAST },
      );
      db.prepare("UPDATE opportunities SET outreach_json=? WHERE id=?").run(JSON.stringify(outreach), oppId);
      console.log(`  outreach drafted — subject: "${outreach.subject}"`);
      outcomes.push({ company: seed.companyName, oppId, error: null });
    } catch (err) {
      console.error(`  FAILED: ${String(err)}`);
      outcomes.push({ company: seed.companyName, oppId: null, error: String(err) });
    }
  }

  // --- Final summary --------------------------------------------------------
  console.log("\n=== Seed summary ===");
  const rows = db
    .prepare(
      `SELECT o.id, o.company_name, o.status, o.recommendation_json, f.name AS founder_name, f.current_score
       FROM opportunities o LEFT JOIN founders f ON f.id = o.founder_id
       ORDER BY o.id`,
    )
    .all() as Array<{
    id: number;
    company_name: string;
    status: string;
    recommendation_json: string | null;
    founder_name: string | null;
    current_score: number | null;
  }>;
  console.table(
    rows.map((r) => ({
      id: r.id,
      company: r.company_name,
      status: r.status,
      verdict: json<{ verdict: string } | null>(r.recommendation_json, null)?.verdict ?? "—",
      founder: r.founder_name ?? "—",
      "founder score": r.current_score == null ? "—" : Math.round(r.current_score),
    })),
  );

  const failures = outcomes.filter((o) => o.error != null);
  if (failures.length > 0) {
    console.error(`\n${failures.length} seed(s) failed:`);
    for (const f of failures) console.error(`  - ${f.company}: ${f.error}`);
    process.exitCode = 1;
  } else {
    console.log("\nAll seeds completed. Start the app with `npm run dev` and open http://localhost:3000");
  }
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
