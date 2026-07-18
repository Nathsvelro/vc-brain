import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env.local loader (dotenv is not installed). Parses KEY=value lines,
 * ignores comments/blanks, strips optional `export ` prefixes and surrounding
 * quotes, and never overrides variables already present in process.env.
 *
 * MUST run before any app module from lib/ is imported: lib/openai.ts reads
 * MODEL_SMART/MODEL_FAST at import time, so the scripts import lib/* only
 * dynamically, after calling this.
 */
export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key !== "" && process.env[key] === undefined) process.env[key] = value;
  }
}

/** Exit with a clear message when the OpenAI key is missing. */
export function requireOpenAIKey(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "OPENAI_API_KEY is missing. Copy .env.example to .env.local and set a real key, then re-run.",
    );
    process.exit(1);
  }
}
