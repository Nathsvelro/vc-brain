import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{children}</h2>;
}

const badgeTones: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-50 text-slate-600 border-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};

export function Badge({ tone = "slate", children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeTones[tone] ?? badgeTones.slate}`}
    >
      {children}
    </span>
  );
}

export function trustTone(score: number | null | undefined): string {
  if (score == null) return "slate";
  if (score >= 70) return "emerald";
  if (score >= 40) return "amber";
  return "rose";
}

export function TrustBadge({ score, status }: { score: number | null; status: string }) {
  return (
    <Badge
      tone={trustTone(score)}
      title="Trust Score is a deterministic mapping: verified externally 80–95 (more corroboration → higher) · deck-only 45 · unverifiable 50 · contradicted 10–25"
    >
      {status} · {score ?? "—"}
    </Badge>
  );
}

export function verdictTone(verdict: string): string {
  if (verdict === "bullish" || verdict === "invest") return "emerald";
  if (verdict === "neutral" || verdict === "watch") return "amber";
  if (verdict === "bear" || verdict === "pass") return "rose";
  return "slate";
}

export const trendGlyph: Record<string, string> = {
  improving: "▲",
  declining: "▼",
  stable: "→",
  new: "●",
};

export function SourceBadge({ source }: { source: string }) {
  return <Badge tone={source === "outbound" ? "violet" : "indigo"}>{source === "outbound" ? "outbound · sourced" : "inbound"}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "analyzed" ? "emerald" : status === "analyzing" ? "indigo" : status === "screened_filtered" ? "amber" : status === "error" ? "rose" : "slate";
  const label = status === "screened_filtered" ? "filtered at screen" : status;
  return <Badge tone={tone}>{label}</Badge>;
}

export function CompanyLink({ id, name }: { id: number; name: string }) {
  return (
    <Link href={`/opportunities/${id}`} className="font-medium text-foreground hover:text-accent hover:underline">
      {name}
    </Link>
  );
}

/** Inline SVG sparkline with uncertainty band — no chart library needed. */
export function Sparkline({
  points,
  width = 220,
  height = 56,
}: {
  points: Array<{ score: number; low: number; high: number }>;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;
  const pad = 6;
  const xs = (i: number) => (points.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (points.length - 1));
  const ys = (v: number) => height - pad - (v / 100) * (height - 2 * pad);
  const line = points.map((p, i) => `${xs(i)},${ys(p.score)}`).join(" ");
  const band = [
    ...points.map((p, i) => `${xs(i)},${ys(p.high)}`),
    ...[...points].reverse().map((p, i) => `${xs(points.length - 1 - i)},${ys(p.low)}`),
  ].join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={band} fill="#4f46e5" opacity={0.12} />
      <polyline points={line} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p.score)} r={3} fill="#4f46e5" />
      ))}
    </svg>
  );
}
