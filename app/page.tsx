"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CompanyLink, SourceBadge, StatusBadge, verdictTone } from "@/components/ui";

interface OppSummary {
  id: number;
  company_name: string;
  one_liner: string | null;
  sector: string | null;
  geo: string | null;
  stage: string | null;
  source: string;
  status: string;
  screen_json: string | null;
  recommendation_json: string | null;
  source_signal: string | null;
  linked_opportunity_id: number | null;
  founder_id: number | null;
  founder_name: string | null;
  founder_score: number | null;
  score_low: number | null;
  score_high: number | null;
  cold_start: number | null;
}

interface QueryCriterion {
  criterion: string;
  status: "met" | "not_met" | "unknown";
  note: string;
}

interface QueryResult {
  opportunity: { id: number; company_name: string; one_liner: string | null };
  founder_name: string | null;
  founder_score: number | null;
  overall_fit: number;
  criteria: QueryCriterion[];
}

interface QueryResponse {
  parsed: {
    filters: { sectors: string[]; geos: string[]; stages: string[]; source: string; text_terms: string[] };
    criteria: string[];
  };
  results: QueryResult[];
}

function OppCard({ o }: { o: OppSummary }) {
  const rec = o.recommendation_json
    ? (JSON.parse(o.recommendation_json) as { verdict: string; check_size_usd: number | null })
    : null;
  const screen = o.screen_json ? (JSON.parse(o.screen_json) as { pass: boolean; reason: string }) : null;
  return (
    <Card className="mb-3">
      <div className="flex items-start justify-between gap-2">
        <CompanyLink id={o.id} name={o.company_name} />
        {rec && <Badge tone={verdictTone(rec.verdict)}>{rec.verdict.toUpperCase()}</Badge>}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{o.one_liner ?? o.source_signal ?? "Awaiting analysis"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SourceBadge source={o.source} />
        <StatusBadge status={o.status} />
        {o.cold_start === 1 && <Badge tone="amber">cold start</Badge>}
        {o.linked_opportunity_id != null && <Badge tone="violet">converged ↔</Badge>}
      </div>
      {o.founder_name && (
        <div className="mt-2 text-xs text-muted">
          {o.founder_id ? (
            <Link href={`/founders/${o.founder_id}`} className="hover:text-accent hover:underline">
              {o.founder_name}
            </Link>
          ) : (
            o.founder_name
          )}
          {o.founder_score != null && (
            <>
              {" · Founder Score "}
              <span className="font-semibold text-foreground">{Math.round(o.founder_score)}</span>
              {o.score_low != null && ` [${Math.round(o.score_low)}–${Math.round(o.score_high ?? 0)}]`}
            </>
          )}
        </div>
      )}
      {o.status === "screened_filtered" && screen && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Filtered: {screen.reason}</p>
      )}
    </Card>
  );
}

const chipTone: Record<string, string> = { met: "emerald", not_met: "rose", unknown: "amber" };

export default function Dashboard() {
  const [opps, setOpps] = useState<OppSummary[]>([]);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [queryRes, setQueryRes] = useState<QueryResponse | null>(null);
  const [queryErr, setQueryErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/opportunities");
    if (res.ok) setOpps((await res.json()).opportunities);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) {
      setQueryRes(null);
      return;
    }
    setSearching(true);
    setQueryErr(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setQueryRes(data);
    } catch (err) {
      setQueryErr(String(err));
      setQueryRes(null);
    } finally {
      setSearching(false);
    }
  }

  const isSourcedCol = (o: OppSummary) => o.source === "outbound" && o.linked_opportunity_id == null;
  const columns: Array<{ title: string; hint: string; items: OppSummary[] }> = [
    {
      title: "Sourced",
      hint: "Outbound — found before they applied",
      items: opps.filter(isSourcedCol),
    },
    {
      title: "Screening",
      hint: "Application received — analysis running",
      items: opps.filter((o) => !isSourcedCol(o) && ["received", "analyzing"].includes(o.status)),
    },
    {
      title: "Filtered",
      hint: "Stopped at quick screen — kept, never discarded",
      items: opps.filter((o) => !isSourcedCol(o) && o.status === "screened_filtered"),
    },
    {
      title: "Decision",
      hint: "Full memo & recommendation ready",
      items: opps.filter((o) => !isSourcedCol(o) && ["analyzed", "error"].includes(o.status)),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted">
            Sourcing → Screening → Diligence → Decision. One funnel for inbound and outbound.
          </p>
        </div>
        <Link href="/apply" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          New application
        </Link>
      </div>

      <form onSubmit={search} className="mb-2 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Ask Memory anything — e.g. "technical founder, Berlin, AI infra, no prior VC backing"'
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          {searching ? "Reasoning…" : "Search"}
        </button>
      </form>

      {queryErr && <p className="mb-4 text-sm text-rose-600">{queryErr}</p>}

      {queryRes && (
        <Card className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="font-semibold text-foreground">Parsed as:</span>
            {[
              ...queryRes.parsed.filters.sectors,
              ...queryRes.parsed.filters.geos,
              ...queryRes.parsed.filters.stages,
              ...queryRes.parsed.filters.text_terms,
            ].map((t) => (
              <Badge key={t} tone="indigo">
                {t}
              </Badge>
            ))}
            {queryRes.parsed.filters.source !== "any" && <Badge tone="violet">{queryRes.parsed.filters.source}</Badge>}
            <button onClick={() => setQueryRes(null)} className="ml-auto text-muted hover:text-foreground">
              ✕ clear
            </button>
          </div>
          {queryRes.results.length === 0 && <p className="text-sm text-muted">No matches in Memory for this query.</p>}
          {queryRes.results.map((r) => (
            <div key={r.opportunity.id} className="border-t border-border py-3 first:border-t-0">
              <div className="flex items-center justify-between">
                <CompanyLink id={r.opportunity.id} name={r.opportunity.company_name} />
                <Badge tone="indigo">fit {Math.round(r.overall_fit)}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {r.opportunity.one_liner} {r.founder_name && `· ${r.founder_name}`}
                {r.founder_score != null && ` (score ${Math.round(r.founder_score)})`}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.criteria.map((c) => (
                  <Badge key={c.criterion} tone={chipTone[c.status]} title={c.note}>
                    {c.status === "met" ? "✓" : c.status === "not_met" ? "✗" : "?"} {c.criterion}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.title}>
            <div className="mb-3">
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-muted">{col.items.length}</span>
              <p className="mt-0.5 text-[11px] text-muted">{col.hint}</p>
            </div>
            {col.items.map((o) => (
              <OppCard key={o.id} o={o} />
            ))}
            {col.items.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">Empty</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
