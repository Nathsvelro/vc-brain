import { db } from "./db";

export interface ThesisConfig {
  fund_name: string;
  sectors: string[];
  stages: string[];
  geographies: string[];
  check_size_usd: { min: number; max: number };
  ownership_target_pct: number;
  risk_appetite: "conservative" | "balanced" | "aggressive";
  notes: string;
}

export const DEFAULT_THESIS: ThesisConfig = {
  fund_name: "Maschmeyer Group — AI Fund I",
  sectors: ["AI infrastructure", "developer tools", "applied AI / vertical SaaS"],
  stages: ["pre-seed", "seed"],
  geographies: ["Europe", "North America", "Latin America"],
  check_size_usd: { min: 100_000, max: 100_000 },
  ownership_target_pct: 6,
  risk_appetite: "aggressive",
  notes:
    "Back exceptional technical founders before they formally fundraise. $100K checks decided within 24 hours. Cold-start founders welcome — judge the footprint, not the network.",
};

export function getThesis(): ThesisConfig {
  const row = db.prepare("SELECT config_json FROM thesis WHERE id = 1").get() as
    | { config_json: string }
    | undefined;
  if (!row) {
    setThesis(DEFAULT_THESIS);
    return DEFAULT_THESIS;
  }
  return JSON.parse(row.config_json) as ThesisConfig;
}

export function setThesis(config: ThesisConfig): void {
  db.prepare(
    "INSERT INTO thesis (id, config_json, updated_at) VALUES (1, ?, datetime('now')) " +
      "ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, updated_at = datetime('now')",
  ).run(JSON.stringify(config));
}

export function thesisPrompt(t: ThesisConfig): string {
  return [
    `Fund: ${t.fund_name}`,
    `Sectors: ${t.sectors.join(", ")}`,
    `Stages: ${t.stages.join(", ")}`,
    `Geographies: ${t.geographies.join(", ")}`,
    `Check size: $${t.check_size_usd.min.toLocaleString()}–$${t.check_size_usd.max.toLocaleString()}`,
    `Ownership target: ${t.ownership_target_pct}%`,
    `Risk appetite: ${t.risk_appetite}`,
    `Notes: ${t.notes}`,
  ].join("\n");
}
