import { db } from "./db";

export interface FounderRow {
  id: number;
  name: string;
  normalized_name: string;
  email: string | null;
  links_json: string;
  tags_json: string;
  bio: string | null;
  current_score: number | null;
  score_low: number | null;
  score_high: number | null;
  cold_start: number;
  created_at: string;
}

export interface OpportunityRow {
  id: number;
  company_name: string;
  founder_id: number | null;
  source: "inbound" | "outbound";
  status: string;
  one_liner: string | null;
  sector: string | null;
  geo: string | null;
  stage: string | null;
  tags_json: string;
  deck_path: string | null;
  deck_text: string | null;
  screen_json: string | null;
  memo_json: string | null;
  recommendation_json: string | null;
  outreach_json: string | null;
  source_signal: string | null;
  linked_opportunity_id: number | null;
  created_at: string;
}

export interface EvidenceRow {
  id: number;
  opportunity_id: number | null;
  founder_id: number | null;
  source_type: "deck" | "web" | "github" | "application";
  source_ref: string | null;
  title: string | null;
  snippet: string | null;
  synthetic: number;
  retrieved_at: string;
}

export interface ClaimRow {
  id: number;
  opportunity_id: number;
  text: string;
  category: string;
  status: string;
  trust_score: number | null;
  evidence_ids_json: string;
  verification_note: string | null;
  created_at: string;
}

export interface AxisScoreRow {
  id: number;
  opportunity_id: number;
  axis: string;
  verdict: string;
  score: number;
  confidence: string;
  trend: string;
  rationale: string | null;
  evidence_ids_json: string;
  created_at: string;
}

export interface ReasoningLogRow {
  id: number;
  run_id: string;
  opportunity_id: number | null;
  step: string;
  status: string;
  summary: string | null;
  detail_json: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface FounderScoreHistoryRow {
  id: number;
  founder_id: number;
  score: number;
  low: number;
  high: number;
  components_json: string;
  rationale: string | null;
  trigger_event: string;
  opportunity_id: number | null;
  created_at: string;
}

export function getOpportunity(id: number): OpportunityRow | undefined {
  return db.prepare("SELECT * FROM opportunities WHERE id = ?").get(id) as OpportunityRow | undefined;
}

export function getFounder(id: number): FounderRow | undefined {
  return db.prepare("SELECT * FROM founders WHERE id = ?").get(id) as FounderRow | undefined;
}

export function listClaims(opportunityId: number): ClaimRow[] {
  return db.prepare("SELECT * FROM claims WHERE opportunity_id = ? ORDER BY id").all(opportunityId) as ClaimRow[];
}

export function listEvidence(opportunityId: number): EvidenceRow[] {
  return db.prepare("SELECT * FROM evidence WHERE opportunity_id = ? ORDER BY id").all(opportunityId) as EvidenceRow[];
}

export function listFounderEvidence(founderId: number): EvidenceRow[] {
  return db
    .prepare(
      "SELECT * FROM evidence WHERE founder_id = ? OR opportunity_id IN (SELECT id FROM opportunities WHERE founder_id = ?) ORDER BY id",
    )
    .all(founderId, founderId) as EvidenceRow[];
}

/** Latest snapshot per axis (axis_scores is append-only). */
export function latestAxes(opportunityId: number): AxisScoreRow[] {
  return db
    .prepare(
      `SELECT a.* FROM axis_scores a
       JOIN (SELECT axis, MAX(id) AS max_id FROM axis_scores WHERE opportunity_id = ? GROUP BY axis) m
         ON a.id = m.max_id ORDER BY a.axis`,
    )
    .all(opportunityId) as AxisScoreRow[];
}

export function founderHistory(founderId: number): FounderScoreHistoryRow[] {
  return db
    .prepare("SELECT * FROM founder_score_history WHERE founder_id = ? ORDER BY id")
    .all(founderId) as FounderScoreHistoryRow[];
}

export function latestRunLog(opportunityId: number): ReasoningLogRow[] {
  const latest = db
    .prepare("SELECT run_id FROM reasoning_log WHERE opportunity_id = ? ORDER BY id DESC LIMIT 1")
    .get(opportunityId) as { run_id: string } | undefined;
  if (!latest) return [];
  return db
    .prepare("SELECT * FROM reasoning_log WHERE opportunity_id = ? AND run_id = ? ORDER BY id")
    .all(opportunityId, latest.run_id) as ReasoningLogRow[];
}
