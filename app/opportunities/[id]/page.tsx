"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Badge,
  Card,
  SectionTitle,
  SourceBadge,
  StatusBadge,
  TrustBadge,
  trendGlyph,
  verdictTone,
} from "@/components/ui";
import type { Memo, Recommendation } from "@/lib/schemas";
import type {
  AxisScoreRow,
  ClaimRow,
  EvidenceRow,
  FounderRow,
  OpportunityRow,
  ReasoningLogRow,
} from "@/lib/model";

interface Bundle {
  opportunity: OpportunityRow;
  founder: FounderRow | null;
  claims: ClaimRow[];
  evidence: EvidenceRow[];
  axes: AxisScoreRow[];
  log: ReasoningLogRow[];
}

type Tab = "overview" | "claims" | "memo" | "trace";

// ---- helpers ---------------------------------------------------------------

function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function parseTs(s: string | null): number | null {
  if (!s) return null;
  const iso = s.includes("T") ? s : `${s.replace(" ", "T")}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function fmtTime(s: string | null): string {
  const t = parseTs(s);
  return t == null ? (s ?? "—") : new Date(t).toLocaleTimeString();
}

function stepState(s: ReasoningLogRow): "done" | "error" | "running" {
  if (s.status === "error" || s.status === "failed") return "error";
  if (s.finished_at != null || ["done", "ok", "success", "completed"].includes(s.status)) return "done";
  return "running";
}

function elapsedLabel(s: ReasoningLogRow): string {
  const start = parseTs(s.started_at);
  if (start == null) return "";
  const end = parseTs(s.finished_at) ?? Date.now();
  return `${Math.max(0, (end - start) / 1000).toFixed(1)}s`;
}

function prettyDetail(s: string | null): string | null {
  if (!s) return null;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

const categoryTone: Record<string, string> = {
  traction: "emerald",
  revenue: "emerald",
  team: "indigo",
  market: "violet",
  product: "indigo",
  funding: "amber",
  other: "slate",
};

const sourceTypeTone: Record<string, string> = {
  deck: "slate",
  web: "indigo",
  github: "violet",
  application: "slate",
};

// ---- small components ------------------------------------------------------

function StepIcon({ state }: { state: "done" | "error" | "running" }) {
  if (state === "done") return <span className="font-semibold text-emerald-600">✓</span>;
  if (state === "error") return <span className="font-semibold text-rose-600">✗</span>;
  return <span className="animate-pulse text-indigo-600">●</span>;
}

function EvidenceChips({
  ids,
  evidence,
  onJump,
}: {
  ids: number[];
  evidence: EvidenceRow[];
  onJump: (id: number) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {ids.map((id) => {
        const ev = evidence.find((e) => e.id === id);
        const tip = ev ? [ev.title, ev.snippet].filter(Boolean).join(" — ") : `evidence #${id}`;
        return (
          <button
            key={id}
            type="button"
            title={tip}
            onClick={() => onJump(id)}
            className="rounded border border-border bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-muted hover:border-accent hover:text-accent"
          >
            e{id}
          </button>
        );
      })}
    </span>
  );
}

function EvidencePool({ evidence, highlightId }: { evidence: EvidenceRow[]; highlightId: number | null }) {
  return (
    <div className="mt-8">
      <SectionTitle>Evidence pool</SectionTitle>
      {evidence.length === 0 && <p className="text-sm text-muted">No evidence gathered yet.</p>}
      <div className="space-y-2">
        {evidence.map((e) => {
          const isUrl = e.source_ref != null && /^https?:\/\//.test(e.source_ref);
          return (
            <div
              key={e.id}
              id={`evidence-${e.id}`}
              className={`rounded-xl border p-3 shadow-sm transition-colors ${
                highlightId === e.id ? "border-amber-400 bg-amber-50" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-muted">e{e.id}</span>
                <Badge tone={sourceTypeTone[e.source_type] ?? "slate"}>{e.source_type}</Badge>
                {e.synthetic === 1 && <Badge tone="amber">demo corpus</Badge>}
                {e.title && <span className="text-sm font-medium">{e.title}</span>}
              </div>
              {e.source_ref &&
                (isUrl ? (
                  <a
                    href={e.source_ref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-xs text-accent hover:underline"
                  >
                    {e.source_ref}
                  </a>
                ) : (
                  <p className="mt-1 break-all text-xs text-muted">{e.source_ref}</p>
                ))}
              {e.snippet && <p className="mt-1 text-xs text-muted">{e.snippet}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CitedBullets({
  items,
  evidence,
  onJump,
}: {
  items: Array<{ text: string; evidence_ids: number[] }>;
  evidence: EvidenceRow[];
  onJump: (id: number) => void;
}) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      {items.map((b, i) => (
        <li key={i}>
          {b.text} <EvidenceChips ids={b.evidence_ids} evidence={evidence} onJump={onJump} />
        </li>
      ))}
    </ul>
  );
}

// ---- page ------------------------------------------------------------------

export default function OpportunityDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [highlightEv, setHighlightEv] = useState<number | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/opportunities/${id}`);
    if (res.ok) {
      setBundle(await res.json());
      setNotFound(false);
    } else if (res.status === 404) {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const status = bundle?.opportunity.status;
  const isRunning = status === "received" || status === "analyzing";

  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [isRunning, load]);

  const jumpToEvidence = useCallback((evId: number) => {
    setHighlightEv(evId);
    const el = document.getElementById(`evidence-${evId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  async function rerun() {
    setRerunning(true);
    try {
      await fetch(`/api/opportunities/${id}/analyze`, { method: "POST" });
      await load();
    } finally {
      setRerunning(false);
    }
  }

  async function simulateApply() {
    setApplying(true);
    try {
      const res = await fetch(`/api/sourcing/${id}/apply`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.inboundOppId != null) router.push(`/opportunities/${data.inboundOppId}`);
    } finally {
      setApplying(false);
    }
  }

  if (notFound) {
    return (
      <div className="py-16 text-center text-sm text-muted">
        Opportunity not found.{" "}
        <Link href="/" className="text-accent hover:underline">
          Back to pipeline
        </Link>
      </div>
    );
  }

  if (!bundle) {
    return <div className="py-16 text-center text-sm text-muted">Loading opportunity…</div>;
  }

  const { opportunity: opp, founder, claims, evidence, axes, log } = bundle;
  const rec = parseJson<Recommendation>(opp.recommendation_json);
  const memo = parseJson<Memo>(opp.memo_json);
  const screen = parseJson<{ pass: boolean; reason: string }>(opp.screen_json);
  const outreach = parseJson<{ subject: string; body: string }>(opp.outreach_json);

  const meta = [opp.sector, opp.geo, opp.stage].filter(Boolean).join(" · ");

  const claimRank = (c: ClaimRow) => (c.status === "contradicted" ? 0 : c.status === "verified" ? 1 : 2);
  const sortedClaims = [...claims].sort((a, b) => claimRank(a) - claimRank(b) || a.id - b.id);

  const axisSpec: Array<{ axis: string; title: string }> = [
    { axis: "founder", title: "Founder" },
    { axis: "market", title: "Market" },
    { axis: "idea_market", title: "Idea vs Market" },
  ];

  const swotSpec = [
    { key: "strengths" as const, title: "Strengths", headingClass: "text-emerald-700" },
    { key: "weaknesses" as const, title: "Weaknesses", headingClass: "text-rose-700" },
    { key: "opportunities" as const, title: "Opportunities", headingClass: "text-indigo-700" },
    { key: "risks" as const, title: "Risks", headingClass: "text-amber-700" },
  ];

  const tabs: Tab[] = ["overview", "claims", "memo", "trace"];

  return (
    <div>
      {/* ---- header ---- */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{opp.company_name}</h1>
            <SourceBadge source={opp.source} />
            <StatusBadge status={opp.status} />
            {founder?.cold_start === 1 && <Badge tone="amber">cold start</Badge>}
            {opp.linked_opportunity_id != null && (
              <Link href={`/opportunities/${opp.linked_opportunity_id}`}>
                <Badge tone="violet">converged ↔ view linked</Badge>
              </Link>
            )}
          </div>
          {(opp.one_liner || meta) && (
            <p className="mt-1 text-sm text-muted">
              {opp.one_liner ?? opp.source_signal}
              {meta && <span className="ml-2 text-xs">· {meta}</span>}
            </p>
          )}
          {founder && (
            <p className="mt-1.5 text-sm text-muted">
              <Link href={`/founders/${founder.id}`} className="font-medium text-foreground hover:text-accent hover:underline">
                {founder.name}
              </Link>
              {founder.current_score != null && (
                <>
                  {" · Founder Score "}
                  <span className="font-semibold text-foreground">{Math.round(founder.current_score)}</span>
                  {founder.score_low != null && founder.score_high != null && (
                    <span> [{Math.round(founder.score_low)}–{Math.round(founder.score_high)}]</span>
                  )}
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={rerun}
          disabled={rerunning || isRunning}
          className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          {rerunning || isRunning ? "Analyzing…" : "Re-run analysis"}
        </button>
      </div>

      {/* ---- live progress hero ---- */}
      {isRunning && (
        <Card className="mb-4 border-indigo-200">
          <div className="mb-3 flex items-center gap-2">
            <span className="animate-pulse text-indigo-600">●</span>
            <span className="text-sm font-semibold">Watching the VC Brain think</span>
            <span className="text-xs text-muted">— this progress view IS the reasoning log (agentic traceability)</span>
          </div>
          {log.length === 0 && <p className="text-sm text-muted">Spinning up the analysis pipeline…</p>}
          <div className="space-y-2">
            {log.map((s) => {
              const state = stepState(s);
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <StepIcon state={state} />
                  <span className="font-medium capitalize">{s.step.replaceAll("_", " ")}</span>
                  <span className="text-muted">{s.summary}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted">{elapsedLabel(s)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ---- recommendation ---- */}
      {rec && (
        <Card className="mb-4 border-2">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={verdictTone(rec.verdict)}>{rec.verdict.toUpperCase()}</Badge>
            <span className="text-sm">
              <span className="text-muted">Check size </span>
              <span className="font-semibold">
                {rec.check_size_usd && rec.verdict !== "pass"
                  ? `$${Math.round(rec.check_size_usd).toLocaleString("en-US")}`
                  : "—"}
              </span>
            </span>
            <span className="text-sm">
              <span className="text-muted">Confidence </span>
              <span className="font-semibold">{rec.confidence}</span>
            </span>
          </div>
          <p className="mt-2 text-sm">{rec.rationale}</p>
          {rec.diligence_questions.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Diligence questions</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {rec.diligence_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}

      {/* ---- screen filter notice ---- */}
      {opp.status === "screened_filtered" && screen && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Filtered at quick screen — kept in Memory, never discarded</p>
          <p className="mt-1 text-sm text-amber-700">{screen.reason}</p>
        </Card>
      )}

      {/* ---- outreach draft ---- */}
      {outreach && opp.source === "outbound" && (
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionTitle>Outreach draft</SectionTitle>
              <p className="text-sm font-medium">{outreach.subject}</p>
            </div>
            {opp.linked_opportunity_id == null && (
              <button
                onClick={simulateApply}
                disabled={applying}
                className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {applying ? "Converting…" : "Simulate: candidate applies"}
              </button>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{outreach.body}</p>
          <p className="mt-3 text-xs text-muted">Cold outreach, not cold investment — the goal is a real application.</p>
        </Card>
      )}

      {/* ---- tabs ---- */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---- overview ---- */}
      {tab === "overview" && (
        <div>
          <p className="mb-3 text-xs text-muted">Three independent verdicts — never averaged. Disagreement is signal.</p>
          <div className="grid grid-cols-3 gap-4">
            {axisSpec.map(({ axis, title }) => {
              const a = axes.find((x) => x.axis === axis);
              if (!a) {
                return (
                  <div key={axis} className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    {title} — pending analysis
                  </div>
                );
              }
              const evIds = parseJson<number[]>(a.evidence_ids_json) ?? [];
              return (
                <Card key={axis}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{title}</span>
                    <Badge tone={verdictTone(a.verdict)}>{a.verdict.toUpperCase()}</Badge>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{Math.round(a.score)}</span>
                    <span className="text-sm text-muted">/100</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    confidence {a.confidence} · trend {trendGlyph[a.trend] ?? "●"} {a.trend}
                  </p>
                  {a.rationale && <p className="mt-2 text-sm text-muted">{a.rationale}</p>}
                  <div className="mt-2">
                    <EvidenceChips ids={evIds} evidence={evidence} onJump={jumpToEvidence} />
                  </div>
                </Card>
              );
            })}
          </div>
          <EvidencePool evidence={evidence} highlightId={highlightEv} />
        </div>
      )}

      {/* ---- claims ---- */}
      {tab === "claims" && (
        <div>
          <p className="mb-3 text-xs text-muted">
            Every claim is verified against gathered evidence.{" "}
            <span
              title="Trust Score is a deterministic mapping: verified externally 80–95 (more corroboration → higher) · deck-only 45 · unverifiable 50 · contradicted 10–25"
              className="cursor-help underline decoration-dotted"
            >
              How is the trust score computed?
            </span>{" "}
            Contradicted claims sort first — they matter most.
          </p>
          {sortedClaims.length === 0 && <p className="text-sm text-muted">Claims appear as extraction completes.</p>}
          {sortedClaims.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-semibold">Claim</th>
                    <th className="px-2 py-2.5 font-semibold">Category</th>
                    <th className="px-2 py-2.5 font-semibold">Trust</th>
                    <th className="px-2 py-2.5 font-semibold">Verification</th>
                    <th className="px-4 py-2.5 font-semibold">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClaims.map((c) => {
                    const evIds = parseJson<number[]>(c.evidence_ids_json) ?? [];
                    return (
                      <tr key={c.id} className="border-b border-border align-top last:border-b-0">
                        <td className="px-4 py-2.5">{c.text}</td>
                        <td className="px-2 py-2.5">
                          <Badge tone={categoryTone[c.category] ?? "slate"}>{c.category}</Badge>
                        </td>
                        <td className="px-2 py-2.5">
                          <TrustBadge score={c.trust_score} status={c.status} />
                        </td>
                        <td className="px-2 py-2.5 text-xs text-muted">{c.verification_note ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <EvidenceChips ids={evIds} evidence={evidence} onJump={jumpToEvidence} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <EvidencePool evidence={evidence} highlightId={highlightEv} />
        </div>
      )}

      {/* ---- memo ---- */}
      {tab === "memo" && (
        <div>
          {!memo && <p className="text-sm text-muted">Memo appears when analysis completes.</p>}
          {memo && (
            <div className="space-y-6">
              <Card>
                <SectionTitle>Company snapshot</SectionTitle>
                <p className="text-sm">{memo.company_snapshot}</p>
              </Card>

              <Card>
                <SectionTitle>Investment hypotheses</SectionTitle>
                <CitedBullets items={memo.investment_hypotheses} evidence={evidence} onJump={jumpToEvidence} />
              </Card>

              <div className="grid grid-cols-2 gap-4">
                {swotSpec.map(({ key, title, headingClass }) => (
                  <Card key={key}>
                    <h3 className={`mb-2 text-sm font-semibold uppercase tracking-wider ${headingClass}`}>{title}</h3>
                    {memo.swot[key].length === 0 ? (
                      <p className="text-sm text-muted">None identified.</p>
                    ) : (
                      <CitedBullets items={memo.swot[key]} evidence={evidence} onJump={jumpToEvidence} />
                    )}
                  </Card>
                ))}
              </div>

              <Card>
                <SectionTitle>Problem &amp; product</SectionTitle>
                <p className="text-sm">{memo.problem_and_product}</p>
              </Card>

              <Card>
                <SectionTitle>Traction &amp; KPIs</SectionTitle>
                {memo.traction_and_kpis.length === 0 ? (
                  <p className="text-sm text-muted">No traction claims yet.</p>
                ) : (
                  <CitedBullets items={memo.traction_and_kpis} evidence={evidence} onJump={jumpToEvidence} />
                )}
              </Card>

              <Card>
                <SectionTitle>Key unknowns — flagged, not fabricated</SectionTitle>
                {memo.key_unknowns.length === 0 ? (
                  <p className="text-sm text-muted">Nothing flagged.</p>
                ) : (
                  <div className="space-y-2">
                    {memo.key_unknowns.map((u, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                      >
                        {u}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ---- trace ---- */}
      {tab === "trace" && (
        <div>
          <p className="mb-3 text-xs text-muted">Every conclusion traces to the exact step and evidence that produced it.</p>
          {log.length === 0 && <p className="text-sm text-muted">No reasoning log yet — run the analysis.</p>}
          <div className="space-y-2">
            {log.map((s) => {
              const state = stepState(s);
              const detail = prettyDetail(s.detail_json);
              return (
                <Card key={s.id}>
                  <div className="flex items-center gap-2 text-sm">
                    <StepIcon state={state} />
                    <span className="font-medium capitalize">{s.step.replaceAll("_", " ")}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted">
                      {fmtTime(s.started_at)} → {s.finished_at ? fmtTime(s.finished_at) : "…"} · {elapsedLabel(s)}
                    </span>
                  </div>
                  {s.summary && <p className="mt-1 text-sm text-muted">{s.summary}</p>}
                  {detail && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted hover:text-foreground">detail</summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed">
                        {detail}
                      </pre>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
