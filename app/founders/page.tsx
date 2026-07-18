import Link from "next/link";
import { db } from "@/lib/db";
import type { FounderRow } from "@/lib/model";
import { Badge, Card, trustTone } from "@/components/ui";

export const dynamic = "force-dynamic";

type FounderWithCount = FounderRow & { opp_count: number };

export default function FoundersPage() {
  const founders = db
    .prepare(
      `SELECT f.*, COUNT(o.id) AS opp_count
       FROM founders f
       LEFT JOIN opportunities o ON o.founder_id = f.id
       GROUP BY f.id
       ORDER BY (f.current_score IS NULL), f.current_score DESC, f.id DESC`,
    )
    .all() as FounderWithCount[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Founders</h1>
        <p className="text-sm text-muted">The persistent memory. Scores follow the person, never reset.</p>
      </div>

      {founders.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No founders in Memory yet — they appear as soon as an application or sourced candidate is analyzed.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {founders.map((f) => (
          <Card key={f.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/founders/${f.id}`} className="font-medium text-foreground hover:text-accent hover:underline">
                    {f.name}
                  </Link>
                  {f.cold_start === 1 && (
                    <Badge tone="amber" title="Cold start — limited external footprint; wider uncertainty by design">
                      cold start
                    </Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted">{f.bio ?? "No bio on file yet."}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>
                    {f.opp_count} {f.opp_count === 1 ? "opportunity" : "opportunities"}
                  </span>
                  <span>·</span>
                  <span>first seen {f.created_at.slice(0, 10)}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {f.current_score != null ? (
                  <>
                    <Badge tone={trustTone(f.current_score)}>Founder Score {Math.round(f.current_score)}</Badge>
                    {f.score_low != null && f.score_high != null && (
                      <p className="mt-1 text-xs text-muted">
                        band [{Math.round(f.score_low)}–{Math.round(f.score_high)}]
                      </p>
                    )}
                  </>
                ) : (
                  <Badge tone="slate">not yet scored</Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
