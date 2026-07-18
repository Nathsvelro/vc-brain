import { db } from "./db";

/**
 * Every pipeline stage runs inside withStep(). The rows double as the live
 * progress view on the apply page AND the Trace tab (agentic traceability).
 */
export async function withStep<T>(
  runId: string,
  opportunityId: number | null,
  step: string,
  summary: string,
  fn: () => Promise<T>,
  detailFn?: (out: T) => unknown,
): Promise<T> {
  const row = db
    .prepare("INSERT INTO reasoning_log (run_id, opportunity_id, step, status, summary) VALUES (?, ?, ?, 'running', ?)")
    .run(runId, opportunityId, step, summary);
  const id = row.lastInsertRowid as number;
  try {
    const out = await fn();
    const detail = detailFn ? detailFn(out) : out;
    db.prepare("UPDATE reasoning_log SET status='done', detail_json=?, finished_at=datetime('now') WHERE id=?").run(
      JSON.stringify(detail ?? null).slice(0, 8000),
      id,
    );
    return out;
  } catch (err) {
    db.prepare("UPDATE reasoning_log SET status='error', detail_json=?, finished_at=datetime('now') WHERE id=?").run(
      JSON.stringify({ error: String(err).slice(0, 1000) }),
      id,
    );
    throw err;
  }
}

export function updateStepSummary(runId: string, step: string, summary: string): void {
  db.prepare("UPDATE reasoning_log SET summary=? WHERE run_id=? AND step=?").run(summary, runId, step);
}
