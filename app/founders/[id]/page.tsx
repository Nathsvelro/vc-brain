import { notFound } from "next/navigation";
import { db, json } from "@/lib/db";
import {
  founderHistory,
  getFounder,
  listFounderEvidence,
  type OpportunityRow,
} from "@/lib/model";
import type { Recommendation } from "@/lib/schemas";
import { Badge, Card, CompanyLink, SectionTitle, SourceBadge, Sparkline, StatusBadge, verdictTone } from "@/components/ui";

export const dynamic = "force-dynamic";

const evidenceTone: Record<string, string> = {
  deck: "slate",
  web: "indigo",
  github: "violet",
  application: "emerald",
};

export default async function FounderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const founderId = Number(id);
  const founder = Number.isInteger(founderId) ? getFounder(founderId) : undefined;
  if (!founder) notFound();

  const history = founderHistory(founder.id);
  const evidence = listFounderEvidence(founder.id);
  const opportunities = db
    .prepare("SELECT * FROM opportunities WHERE founder_id = ? ORDER BY id DESC")
    .all(founder.id) as OpportunityRow[];
  const links = json<string[]>(founder.links_json, []);

  const last = history.length > 0 ? history[history.length - 1] : null;
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const improved = last != null && prev != null && last.score > prev.score;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{founder.name}</h1>
            {founder.cold_start === 1 && (
              <Badge tone="amber" title="Cold start — limited external footprint; wider uncertainty by design">
                cold start
              </Badge>
            )}
            {history.length > 1 && <Badge tone="violet">returning founder</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">{founder.bio ?? "No bio on file yet."}</p>
          {links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {links.map((l) => (
                <a
                  key={l}
                  href={l}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {l}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Founder Score</div>
          <div className="text-5xl font-bold tracking-tight">
            {founder.current_score != null ? Math.round(founder.current_score) : "—"}
          </div>
          {founder.score_low != null && founder.score_high != null && (
            <div className="mt-1 text-sm text-muted">
              band [{Math.round(founder.score_low)}–{Math.round(founder.score_high)}]
            </div>
          )}
        </div>
      </div>

      {/* Score history */}
      <Card className="mb-4">
        <SectionTitle>Score history</SectionTitle>
        {history.length === 0 && <p className="text-sm text-muted">No score events yet.</p>}
        {history.length > 0 && (
          <>
            <Sparkline points={history.map((h) => ({ score: h.score, low: h.low, high: h.high }))} />
            {improved && (
              <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                ▲ improved since last evaluation — the system never forgets, and it never stops updating.
              </p>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted">
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Score</th>
                    <th className="py-2 pr-4 font-semibold">Trigger</th>
                    <th className="py-2 font-semibold">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap py-2 pr-4 text-muted">{h.created_at.slice(0, 10)}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        <span className="font-semibold">{Math.round(h.score)}</span>{" "}
                        <span className="text-xs text-muted">
                          [{Math.round(h.low)}–{Math.round(h.high)}]
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone="indigo">{h.trigger_event}</Badge>
                      </td>
                      <td className="py-2 text-muted">{h.rationale ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Opportunities */}
      <Card className="mb-4">
        <SectionTitle>Opportunities</SectionTitle>
        {opportunities.length === 0 && <p className="text-sm text-muted">No opportunities linked to this founder yet.</p>}
        {opportunities.map((o) => {
          const rec = json<Recommendation | null>(o.recommendation_json, null);
          return (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <CompanyLink id={o.id} name={o.company_name} />
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">{o.one_liner ?? o.source_signal ?? "Awaiting analysis"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <SourceBadge source={o.source} />
                <StatusBadge status={o.status} />
                {rec && <Badge tone={verdictTone(rec.verdict)}>{rec.verdict.toUpperCase()}</Badge>}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Evidence timeline */}
      <Card>
        <SectionTitle>Evidence timeline</SectionTitle>
        {evidence.length === 0 && <p className="text-sm text-muted">No evidence collected yet.</p>}
        {evidence.map((e) => (
          <div key={e.id} className="border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={evidenceTone[e.source_type] ?? "slate"}>{e.source_type}</Badge>
              <span className="text-sm font-medium">{e.title ?? "Untitled evidence"}</span>
              {e.synthetic === 1 && <Badge tone="amber">demo corpus</Badge>}
            </div>
            {e.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.snippet}</p>}
            {e.source_ref &&
              (e.source_ref.startsWith("http") ? (
                <a
                  href={e.source_ref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all text-xs text-accent hover:underline"
                >
                  {e.source_ref}
                </a>
              ) : (
                <p className="mt-1 break-all text-xs text-muted">{e.source_ref}</p>
              ))}
          </div>
        ))}
      </Card>
    </div>
  );
}
