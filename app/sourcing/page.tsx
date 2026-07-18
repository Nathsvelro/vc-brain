"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CompanyLink, SectionTitle, StatusBadge } from "@/components/ui";

interface Play {
  title: string;
  rationale: string;
  queries: string[];
}

interface Candidate {
  id: number;
  company_name: string;
  one_liner: string | null;
  source: string;
  status: string;
  source_signal: string | null;
  outreach_json?: string | null;
  linked_opportunity_id: number | null;
  founder_name: string | null;
  founder_score: number | null;
  score_low: number | null;
  score_high: number | null;
}

export default function SourcingPage() {
  const [plays, setPlays] = useState<Play[]>([]);
  const [loadingPlays, setLoadingPlays] = useState(false);
  const [playsErr, setPlaysErr] = useState<string | null>(null);
  const [runningIdx, setRunningIdx] = useState<number | null>(null);
  const [runResults, setRunResults] = useState<Record<number, string>>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const loadCandidates = useCallback(async () => {
    const res = await fetch("/api/opportunities");
    if (!res.ok) return;
    const data = await res.json();
    const outbound = (data.opportunities as Candidate[]).filter((o) => o.source === "outbound");
    // The list endpoint omits outreach_json — enrich from the detail endpoint.
    const enriched = await Promise.all(
      outbound.map(async (c) => {
        try {
          const d = await fetch(`/api/opportunities/${c.id}`);
          if (!d.ok) return c;
          const detail = await d.json();
          return { ...c, outreach_json: detail.opportunity?.outreach_json ?? null };
        } catch {
          return c;
        }
      }),
    );
    setCandidates(enriched);
  }, []);

  useEffect(() => {
    loadCandidates();
    const t = setInterval(loadCandidates, 5000);
    return () => clearInterval(t);
  }, [loadCandidates]);

  async function generatePlays() {
    setLoadingPlays(true);
    setPlaysErr(null);
    try {
      const res = await fetch("/api/sourcing/plays", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setPlays(data.plays);
      setRunResults({});
    } catch (err) {
      setPlaysErr(String(err));
    } finally {
      setLoadingPlays(false);
    }
  }

  async function runPlay(play: Play, idx: number) {
    setRunningIdx(idx);
    try {
      const res = await fetch("/api/sourcing/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ play }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setRunResults((prev) => ({
        ...prev,
        [idx]: `${data.candidatesFound} candidates found, ${data.createdOpportunityIds.length} added to pipeline`,
      }));
      await loadCandidates();
    } catch (err) {
      setRunResults((prev) => ({ ...prev, [idx]: `Error: ${String(err)}` }));
    } finally {
      setRunningIdx(null);
    }
  }

  async function simulateApply(candidateId: number) {
    setApplyingId(candidateId);
    try {
      const res = await fetch(`/api/sourcing/${candidateId}/apply`, { method: "POST" });
      if (res.ok) await loadCandidates();
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sourcing</h1>
        <p className="text-sm text-muted">Outbound deal flow, generated straight from the fund thesis.</p>
      </div>

      {/* Sourcing plays */}
      <div className="mb-8">
        <SectionTitle>Sourcing plays</SectionTitle>
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted">The thesis itself generates the hunt — change the thesis and the plays change.</p>
          <button
            onClick={generatePlays}
            disabled={loadingPlays}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loadingPlays ? "Generating…" : "Generate plays from thesis"}
          </button>
        </div>
        {playsErr && <p className="mb-3 text-sm text-rose-600">{playsErr}</p>}
        {plays.length === 0 && !loadingPlays && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            No plays yet — generate them from the thesis to start the hunt.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {plays.map((play, idx) => (
            <Card key={idx}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{play.title}</p>
                  <p className="mt-1 text-sm text-muted">{play.rationale}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {play.queries.map((q) => (
                      <span
                        key={q}
                        className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground/80"
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => runPlay(play, idx)}
                  disabled={runningIdx !== null}
                  className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
                >
                  {runningIdx === idx ? "Running…" : "Run play"}
                </button>
              </div>
              {runResults[idx] && (
                <p
                  className={`mt-2 rounded-md px-2 py-1 text-xs ${
                    runResults[idx].startsWith("Error") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {runResults[idx]}
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Sourced candidates */}
      <div>
        <SectionTitle>Sourced candidates</SectionTitle>
        {candidates.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Scans hackathons, launches, papers and accelerator cohorts; scored by the exact same pipeline as inbound
            applications.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {candidates.map((c) => {
            const outreach = c.outreach_json
              ? (JSON.parse(c.outreach_json) as { subject: string; body: string })
              : null;
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CompanyLink id={c.id} name={c.company_name} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={c.status} />
                    {c.linked_opportunity_id != null ? (
                      <Link href={`/opportunities/${c.linked_opportunity_id}`}>
                        <Badge tone="violet">converged ↔</Badge>
                      </Link>
                    ) : (
                      <button
                        onClick={() => simulateApply(c.id)}
                        disabled={applyingId !== null}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:border-violet-400 disabled:opacity-50"
                      >
                        {applyingId === c.id ? "Converging…" : "Simulate: candidate applies"}
                      </button>
                    )}
                  </div>
                </div>
                {c.source_signal && <p className="mt-1 text-sm text-muted">Signal: {c.source_signal}</p>}
                {c.founder_name && (
                  <p className="mt-1 text-xs text-muted">
                    {c.founder_name}
                    {c.founder_score != null && (
                      <>
                        {" · Founder Score "}
                        <span className="font-semibold text-foreground">{Math.round(c.founder_score)}</span>
                        {c.score_low != null && ` [${Math.round(c.score_low)}–${Math.round(c.score_high ?? 0)}]`}
                      </>
                    )}
                  </p>
                )}
                {outreach && (
                  <details className="mt-2 rounded-lg border border-border bg-background px-3 py-2">
                    <summary className="cursor-pointer text-sm">
                      <span className="font-semibold">{outreach.subject}</span>
                      <span className="ml-2 text-xs text-muted">outreach preview</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{outreach.body}</p>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
