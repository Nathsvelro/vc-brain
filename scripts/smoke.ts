/**
 * Smoke test — `npm run smoke` (tsx scripts/smoke.ts).
 *
 * Verifies the two live dependencies before a demo:
 *   (a) one tiny structured-output call on MODEL_FAST and one on MODEL_SMART
 *   (b) one live Tavily search, only if TAVILY_API_KEY is set
 *
 * Prints ✓/✗ per check (with the exact model ids used) and exits non-zero if
 * any check fails.
 */
import { z } from "zod";
import { loadEnvLocal } from "./lib";

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.OPENAI_API_KEY) {
    console.error("✗ OPENAI_API_KEY missing — copy .env.example to .env.local and set it.");
    process.exit(1);
  }

  // Import lib/openai only after env is loaded (MODEL_* are read at import time).
  const { callStructured, MODEL_FAST, MODEL_SMART } = await import("../lib/openai");

  const OkSchema = z.object({ ok: z.boolean() });
  let failed = 0;

  const modelChecks: Array<[string, string]> = [
    ["MODEL_FAST", MODEL_FAST],
    ["MODEL_SMART", MODEL_SMART],
  ];
  for (const [label, model] of modelChecks) {
    try {
      const out = await callStructured("smoke_check", OkSchema, "Health check: reply with ok set to true.", {
        model,
      });
      if (out.ok) {
        console.log(`✓ callStructured on ${label} (${model}) → { ok: true }`);
      } else {
        console.error(`✗ callStructured on ${label} (${model}) returned { ok: false } — unexpected.`);
        failed++;
      }
    } catch (err) {
      console.error(`✗ callStructured on ${label} (${model}) failed: ${String(err)}`);
      failed++;
    }
  }

  if (process.env.TAVILY_API_KEY) {
    try {
      const { tavilySearch } = await import("../lib/tavily");
      // Unique query per run: tavilySearch is cache-first, and a cached hit
      // would falsely certify a revoked/mistyped key.
      const query = `AI startup funding news ${new Date().toISOString().slice(0, 16)}`;
      const results = await tavilySearch(query, 3);
      console.log(
        `✓ live tavilySearch → ${results.length} result(s)${results[0] ? ` — first: ${results[0].url}` : ""}`,
      );
    } catch (err) {
      console.error(`✗ live tavilySearch failed: ${String(err)}`);
      failed++;
    }
  } else {
    console.log("- TAVILY_API_KEY not set — skipping live Tavily check (seeded fixtures in tavily_cache still work).");
  }

  if (failed > 0) {
    console.error(`\n${failed} smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
